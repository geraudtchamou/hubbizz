"""
Business API endpoints for AfriHub
CRUD operations, search, and trust score management
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
from geoalchemy2.functions import ST_Distance_Sphere
import uuid

from app.db import get_db
from app.models.core import Business, User, Verification, Review, Product, Lead
from app.schemas.core import (
    BusinessCreate, BusinessUpdate, BusinessResponse, BusinessSearchResult,
    SearchQuery, ProductCreate, ProductResponse, ProductUpdate,
    LeadCreate, LeadResponse
)
from app.services.trust_score import calculate_trust_score
from app.services.image_optimizer import optimize_image_url

router = APIRouter()

# ============== BUSINESS CRUD ==============

@router.post("/", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(
    business_data: BusinessCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)  # Auth dependency
):
    """Create a new business profile"""
    # Generate slug from name
    slug = generate_slug(business_data.name)
    
    # Check slug uniqueness
    result = await db.execute(select(Business).where(Business.slug == slug))
    if result.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    
    # Create business
    business = Business(
        owner_id=current_user.id,
        slug=slug,
        **business_data.model_dump(),
        trust_score=0.0,
        is_verified=False,
        verification_badges=[],
    )
    
    # Set PostGIS location
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    business.location = from_shape(Point(business_data.longitude, business_data.latitude))
    
    db.add(business)
    await db.commit()
    await db.refresh(business)
    
    return business

@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get business by ID"""
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if not business.is_active:
        raise HTTPException(status_code=404, detail="Business is inactive")
    
    return business

@router.put("/{business_id}", response_model=BusinessResponse)
async def update_business(
    business_id: uuid.UUID,
    business_data: BusinessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update business profile (owner only)"""
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check ownership
    if business.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this business")
    
    # Update fields
    update_data = business_data.model_dump(exclude_unset=True)
    
    # Handle location update
    if 'latitude' in update_data or 'longitude' in update_data:
        lat = update_data.get('latitude', business.latitude)
        lng = update_data.get('longitude', business.longitude)
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point
        business.location = from_shape(Point(lng, lat))
    
    for field, value in update_data.items():
        if field not in ['latitude', 'longitude']:
            setattr(business, field, value)
    
    # Recalculate trust score if needed
    business.trust_score = await calculate_trust_score(db, business)
    
    await db.commit()
    await db.refresh(business)
    
    return business

@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business(
    business_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete business (owner only)"""
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if business.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this business")
    
    business.is_active = False
    await db.commit()

# ============== SEARCH & DISCOVERY ==============

@router.get("/search", response_model=List[BusinessSearchResult])
async def search_businesses(
    query_params: SearchQuery = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Search businesses with filters
    Optimized for low-bandwidth with lightweight responses
    """
    stmt = select(
        Business,
        (ST_Distance_Sphere(
            Business.location,
            func.ST_MakePoint(query_params.longitude, query_params.latitude)
        ).label('distance_meters'))
        if query_params.latitude and query_params.longitude
        else (None).label('distance_meters')
    ).where(Business.is_active == True)
    
    # Apply filters
    filters = []
    
    if query_params.query:
        # Full-text search on name and description
        search_filter = or_(
            Business.name.ilike(f"%{query_params.query}%"),
            Business.description.ilike(f"%{query_params.query}%")
        )
        filters.append(search_filter)
    
    if query_params.category:
        filters.append(Business.category == query_params.category)
    
    if query_params.country:
        filters.append(Business.country == query_params.country)
    
    if query_params.city:
        filters.append(Business.city.ilike(f"%{query_params.city}%"))
    
    if query_params.is_verified is not None:
        filters.append(Business.is_verified == query_params.is_verified)
    
    if query_params.is_open_now is not None:
        filters.append(Business.is_open_now == query_params.is_open_now)
    
    if query_params.min_rating is not None:
        filters.append(Business.average_rating >= query_params.min_rating)
    
    # Geospatial filter
    if query_params.latitude and query_params.longitude:
        radius_meters = query_params.radius_km * 1000
        geofilter = ST_Distance_Sphere(
            Business.location,
            func.ST_MakePoint(query_params.longitude, query_params.latitude)
        ) <= radius_meters
        filters.append(geofilter)
    
    if filters:
        stmt = stmt.where(and_(*filters))
    
    # Order by relevance (trust score + distance + rating)
    if query_params.latitude and query_params.longitude:
        stmt = stmt.order_by(
            Business.trust_score.desc(),
            'distance_meters',
            Business.average_rating.desc()
        )
    else:
        stmt = stmt.order_by(
            Business.trust_score.desc(),
            Business.average_rating.desc()
        )
    
    # Pagination
    stmt = stmt.offset(query_params.offset).limit(query_params.limit)
    
    result = await db.execute(stmt)
    businesses = result.scalars().all()
    
    # Format results with distance calculation
    results = []
    for business in businesses:
        result_dict = {
            "id": business.id,
            "name": business.name,
            "category": business.category,
            "city": business.city,
            "country": business.country,
            "latitude": business.latitude,
            "longitude": business.longitude,
            "trust_score": business.trust_score,
            "is_verified": business.is_verified,
            "average_rating": business.average_rating,
            "total_reviews": business.total_reviews,
            "logo_url": await optimize_image_url(business.logo_url) if business.logo_url else None,
        }
        
        if query_params.latitude and query_params.longitude:
            # Convert meters to km
            row = dict(result._mapping)
            distance_m = row.get('distance_meters')
            result_dict['distance_km'] = round(distance_m / 1000, 2) if distance_m else None
        
        results.append(result_dict)
    
    return results

@router.get("/nearby", response_model=List[BusinessSearchResult])
async def get_nearby_businesses(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=5, ge=0.1, le=50),
    category: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get businesses near a location (optimized for map view)"""
    radius_meters = radius_km * 1000
    
    stmt = select(
        Business,
        ST_Distance_Sphere(
            Business.location,
            func.ST_MakePoint(longitude, latitude)
        ).label('distance_meters')
    ).where(
        Business.is_active == True,
        ST_Distance_Sphere(
            Business.location,
            func.ST_MakePoint(longitude, latitude)
        ) <= radius_meters
    )
    
    if category:
        stmt = stmt.where(Business.category == category)
    
    stmt = stmt.order_by('distance_meters').limit(limit)
    
    result = await db.execute(stmt)
    businesses = result.all()
    
    results = []
    for business, distance_m in businesses:
        results.append({
            "id": business.id,
            "name": business.name,
            "category": business.category,
            "city": business.city,
            "country": business.country,
            "latitude": business.latitude,
            "longitude": business.longitude,
            "trust_score": business.trust_score,
            "is_verified": business.is_verified,
            "average_rating": business.average_rating,
            "total_reviews": business.total_reviews,
            "logo_url": await optimize_image_url(business.logo_url) if business.logo_url else None,
            "distance_km": round(distance_m / 1000, 2),
        })
    
    return results

# ============== PRODUCTS ==============

@router.post("/{business_id}/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    business_id: uuid.UUID,
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a product to business catalog"""
    # Verify ownership
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if business.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    product = Product(
        business_id=business_id,
        **product_data.model_dump(),
        thumbnail_url=product_data.image_urls[0] if product_data.image_urls else None
    )
    
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return product

@router.get("/{business_id}/products", response_model=List[ProductResponse])
async def get_business_products(
    business_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all products for a business"""
    stmt = select(Product).where(
        Product.business_id == business_id,
        Product.is_available == True
    ).order_by(Product.created_at.desc())
    
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    return products

# ============== LEADS ==============

@router.post("/{business_id}/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    business_id: uuid.UUID,
    lead_data: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Create a lead (WhatsApp click, quote request, etc.)"""
    # Verify business exists
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    lead = Lead(
        business_id=business_id,
        user_id=current_user.id if current_user else None,
        **lead_data.model_dump()
    )
    
    # Increment business lead count
    business.total_leads += 1
    
    # Track response time metric if WhatsApp
    if lead_data.lead_type == "whatsapp_click":
        # Logic to track average response time
        pass
    
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    
    return lead

# ============== TRUST SCORE ==============

@router.post("/{business_id}/recalculate-trust")
async def recalculate_trust_score(
    business_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually recalculate trust score (admin/owner)"""
    result = await db.execute(select(Business).where(Business.id == business_id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    if business.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_score = await calculate_trust_score(db, business)
    business.trust_score = new_score
    
    await db.commit()
    
    return {"business_id": str(business_id), "trust_score": new_score}

# ============== HELPER FUNCTIONS ==============

def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from business name"""
    import re
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug

# Placeholder auth dependencies (to be implemented in auth module)
async def get_current_user():
    """Get authenticated user from JWT token"""
    # Implementation in auth module
    pass

async def get_current_user_optional():
    """Get user if authenticated, otherwise None"""
    try:
        return await get_current_user()
    except:
        return None
