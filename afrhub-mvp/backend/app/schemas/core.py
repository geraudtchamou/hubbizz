"""
Pydantic schemas for API request/response validation
Optimized for low-bandwidth with selective field serialization
"""

from pydantic import BaseModel, Field, HttpUrl, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

# ============== USER SCHEMAS ==============

class UserBase(BaseModel):
    """Base user schema"""
    full_name: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., pattern="^[A-Z]{2}$")  # ISO country code
    language: Optional[str] = "en"

class UserCreate(UserBase):
    """Schema for user registration"""
    phone: str = Field(..., min_length=8, max_length=20)
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[HttpUrl] = None
    language: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class UserResponse(UserBase):
    """User response schema (excludes sensitive data)"""
    id: uuid.UUID
    phone: str
    email: Optional[EmailStr] = None
    avatar_url: Optional[HttpUrl] = None
    is_verified: bool
    verification_level: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============== BUSINESS SCHEMAS ==============

class BusinessBase(BaseModel):
    """Base business schema"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=100)
    subcategories: Optional[List[str]] = []
    
    # Location
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None
    city: str
    region: Optional[str] = None
    country: str = Field(..., pattern="^[A-Z]{2}$")
    postal_code: Optional[str] = None
    
    # Contact
    phone: str = Field(..., min_length=8, max_length=20)
    whatsapp_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[HttpUrl] = None
    
    # Operating hours
    operating_hours: Optional[Dict[str, Dict[str, str]]] = None

class BusinessCreate(BusinessBase):
    """Schema for creating a business"""
    payment_methods: Optional[List[str]] = ["cash"]

class BusinessUpdate(BaseModel):
    """Schema for updating business profile"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategories: Optional[List[str]] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[HttpUrl] = None
    operating_hours: Optional[Dict[str, Dict[str, str]]] = None
    logo_url: Optional[HttpUrl] = None
    gallery_urls: Optional[List[HttpUrl]] = None
    payment_methods: Optional[List[str]] = None
    is_active: Optional[bool] = None

class BusinessResponse(BusinessBase):
    """Business response schema with trust metrics"""
    id: uuid.UUID
    owner_id: uuid.UUID
    slug: str
    trust_score: float
    is_verified: bool
    verification_badges: List[str]
    response_time_avg: float
    completion_rate: float
    total_reviews: int
    average_rating: float
    total_leads: int
    is_open_now: bool
    logo_url: Optional[HttpUrl] = None
    gallery_urls: List[HttpUrl] = []
    payment_methods: List[str] = []
    is_featured: bool
    premium_tier: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BusinessSearchResult(BaseModel):
    """Lightweight search result for low-bandwidth"""
    id: uuid.UUID
    name: str
    category: str
    city: str
    country: str
    latitude: float
    longitude: float
    trust_score: float
    is_verified: bool
    average_rating: float
    total_reviews: int
    logo_url: Optional[HttpUrl] = None
    distance_km: Optional[float] = None  # Calculated during search
    
    class Config:
        from_attributes = True

# ============== PRODUCT SCHEMAS ==============

class ProductBase(BaseModel):
    """Base product schema"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: str
    price: float = Field(..., gt=0)
    currency: str = Field(default="XAF", pattern="^[A-Z]{3}$")
    unit: Optional[str] = None
    stock_quantity: int = Field(default=0, ge=0)
    tags: Optional[List[str]] = []

class ProductCreate(ProductBase):
    """Schema for creating a product"""
    image_urls: Optional[List[HttpUrl]] = []

class ProductUpdate(BaseModel):
    """Schema for updating a product"""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_available: Optional[bool] = None
    image_urls: Optional[List[HttpUrl]] = None
    tags: Optional[List[str]] = None

class ProductResponse(ProductBase):
    """Product response schema"""
    id: uuid.UUID
    business_id: uuid.UUID
    thumbnail_url: Optional[HttpUrl] = None
    image_urls: List[HttpUrl] = []
    is_available: bool
    is_featured: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============== LEAD SCHEMAS ==============

class LeadCreate(BaseModel):
    """Schema for creating a lead"""
    lead_type: str = Field(..., pattern="^(whatsapp_click|call|quote_request|visit)$")
    source: Optional[str] = None
    message: Optional[str] = None
    product_id: Optional[uuid.UUID] = None
    channel: Optional[str] = None

class LeadResponse(BaseModel):
    """Lead response schema"""
    id: uuid.UUID
    business_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    lead_type: str
    source: Optional[str] = None
    message: Optional[str] = None
    status: str
    channel: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============== REVIEW SCHEMAS ==============

class ReviewCreate(BaseModel):
    """Schema for creating a review"""
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    comment: Optional[str] = None
    image_urls: Optional[List[HttpUrl]] = []

class ReviewUpdate(BaseModel):
    """Schema for updating a review"""
    rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = None
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    """Review response schema"""
    id: uuid.UUID
    business_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str  # Denormalized for performance
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    is_verified_purchase: bool
    helpful_count: int
    image_urls: List[HttpUrl] = []
    owner_response: Optional[str] = None
    owner_response_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============== VERIFICATION SCHEMAS ==============

class VerificationCreate(BaseModel):
    """Schema for requesting verification"""
    verification_type: str = Field(..., pattern="^(phone|email|license|address|tax)$")
    document_url: Optional[HttpUrl] = None

class VerificationResponse(BaseModel):
    """Verification response schema"""
    id: uuid.UUID
    business_id: uuid.UUID
    verification_type: str
    status: str
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============== TRANSACTION SCHEMAS ==============

class TransactionCreate(BaseModel):
    """Schema for creating a transaction"""
    amount: float = Field(..., gt=0)
    currency: str = Field(..., pattern="^[A-Z]{3}$")
    payment_method: str
    lead_id: Optional[uuid.UUID] = None
    is_escrow: bool = False
    release_conditions: Optional[Dict[str, Any]] = None

class TransactionResponse(BaseModel):
    """Transaction response schema"""
    id: uuid.UUID
    business_id: uuid.UUID
    user_id: uuid.UUID
    amount: float
    currency: str
    payment_method: str
    payment_provider_id: Optional[str] = None
    is_escrow: bool
    escrow_status: Optional[str] = None
    status: str
    delivery_status: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# ============== SEARCH & MAP SCHEMAS ==============

class SearchQuery(BaseModel):
    """Search query parameters"""
    query: Optional[str] = None
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = Field(default=10, ge=0.1, le=100)
    country: Optional[str] = Field(None, pattern="^[A-Z]{2}$")
    city: Optional[str] = None
    is_verified: Optional[bool] = None
    is_open_now: Optional[bool] = None
    min_rating: Optional[float] = Field(None, ge=0, le=5)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

class MapCluster(BaseModel):
    """Map cluster for marker clustering"""
    latitude: float
    longitude: float
    count: int
    businesses: List[BusinessSearchResult] = []

# ============== ANALYTICS SCHEMAS ==============

class AnalyticsSummary(BaseModel):
    """Analytics summary for dashboard"""
    total_views: int
    total_leads: int
    total_conversions: int
    conversion_rate: float
    total_revenue: float
    top_products: List[Dict[str, Any]]
    demographics: Dict[str, Any]
    period: str  # "7d", "30d", "90d"

class AnalyticsEvent(BaseModel):
    """Analytics event tracking"""
    event_type: str
    event_source: Optional[str] = None
    action_details: Optional[Dict[str, Any]] = None

# ============== AUTH SCHEMAS ==============

class LoginRequest(BaseModel):
    """Login request"""
    phone: str
    password: str

class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
