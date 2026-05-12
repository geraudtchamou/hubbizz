"""
SQLAlchemy models for AfriHub platform
Includes PostGIS support for geospatial queries
Enhanced for high-volume diverse queries with address normalization, social links, and optimized indexing
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, Numeric, Index, Table, MetaData
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP, JSONB, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import uuid
from app.db import Base

class User(Base):
    """User model - consumers, SME owners, B2B buyers"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, index=True, nullable=False)  # Primary identifier in Africa
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500))
    is_verified = Column(Boolean, default=False)
    verification_level = Column(Integer, default=0)  # 0-5 scale
    country = Column(String(2))  # ISO country code (CM, NG, KE, GH, etc.)
    language = Column(String(2), default="en")  # en, fr, pt, sw, etc.
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    last_login = Column(TIMESTAMP(timezone=True))
    extras = Column(JSONB, default=dict)  # Flexible user preferences
    
    # Relationships
    businesses = relationship("Business", back_populates="owner", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_user_country', 'country'),
        Index('idx_user_verified', 'is_verified'),
    )

class Business(Base):
    """Business/SME profile with trust scoring"""
    __tablename__ = "businesses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    slug = Column(String(200), unique=True, index=True)
    description = Column(Text)
    category = Column(String(100), index=True)  # Primary category
    subcategories = Column(JSONB, default=list)  # Multiple subcategories
    
    # Location (PostGIS)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    address = Column(String(500))
    city = Column(String(100), index=True)
    region = Column(String(100), index=True)
    country = Column(String(2), nullable=False, index=True)
    postal_code = Column(String(20))
    location = Column(Geometry('POINT'))  # PostGIS geometry column
    
    # Contact
    phone = Column(String(20), nullable=False)
    whatsapp_number = Column(String(20), index=True)  # For WhatsApp commerce
    email = Column(String(255))
    website = Column(String(500))
    
    # Trust & Verification
    trust_score = Column(Float, default=0.0, index=True)  # 0-100 calculated score
    is_verified = Column(Boolean, default=False, index=True)
    verification_badges = Column(JSONB, default=list)  # ["phone_verified", "license_verified", etc.]
    license_number = Column(String(100))
    tax_id = Column(String(100))
    
    # Business metrics
    response_time_avg = Column(Float, default=0.0)  # Average response time in minutes
    completion_rate = Column(Float, default=0.0)  # Order completion rate
    total_reviews = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    total_leads = Column(Integer, default=0)
    
    # Operating hours (JSON: {"monday": {"open": "09:00", "close": "18:00"}, ...})
    operating_hours = Column(JSONB, default=dict)
    is_open_now = Column(Boolean, default=True)  # Computed field cached
    
    # Media (compressed for low-bandwidth)
    logo_url = Column(String(500))
    gallery_urls = Column(JSONB, default=list)
    
    # Payment methods accepted
    payment_methods = Column(JSONB, default=list)  # ["mobile_money", "card", "cash", "escrow"]
    
    # Status
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    premium_tier = Column(Integer, default=0)  # 0=free, 1=basic, 2=premium, 3=enterprise
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    last_active = Column(TIMESTAMP(timezone=True))
    extras = Column(JSONB, default=dict)
    
    # Relationships
    owner = relationship("User", back_populates="businesses")
    products = relationship("Product", back_populates="business", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="business", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="business", cascade="all, delete-orphan")
    verifications = relationship("Verification", back_populates="business", cascade="all, delete-orphan")
    addresses = relationship("BusinessAddress", back_populates="business", cascade="all, delete-orphan")
    social_links = relationship("BusinessSocialLink", back_populates="business", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_business_category_country', 'category', 'country'),
        Index('idx_business_trust_score', 'trust_score', postgresql_using='btree'),
        Index('idx_business_location', 'latitude', 'longitude'),
    )


class BusinessAddress(Base):
    """Normalized business addresses - supports multiple locations per business"""
    __tablename__ = "business_addresses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Address type
    address_type = Column(String(50), nullable=False, index=True)  # "headquarters", "branch", "warehouse", "pickup_point", "service_area"
    is_primary = Column(Boolean, default=False, index=True)
    
    # Structured address fields for normalization
    street_number = Column(String(20))
    street_name = Column(String(200))
    neighborhood = Column(String(100), index=True)  # Local area/district
    landmark = Column(String(200))  # Common in African addressing ("Near Central Market")
    
    # Administrative divisions
    city = Column(String(100), nullable=False, index=True)
    municipality = Column(String(100))  # Local government area
    region = Column(String(100), index=True)  # State/Province/Region
    country = Column(String(2), nullable=False, index=True)  # ISO country code
    postal_code = Column(String(20), index=True)
    
    # Geospatial (PostGIS)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    location = Column(Geometry('POINT'))  # PostGIS geometry column
    geohash = Column(String(12), index=True)  # For fast proximity searches
    
    # Delivery & Service info
    is_delivery_available = Column(Boolean, default=True)
    delivery_radius_km = Column(Float, default=5.0)  # Service radius
    delivery_fee = Column(Numeric(10, 2), default=0.0)
    delivery_time_estimate = Column(String(50))  # "30-60 mins", "2-3 days"
    
    # Accessibility
    wheelchair_accessible = Column(Boolean, default=False)
    parking_available = Column(Boolean, default=False)
    
    # Contact for this specific address
    phone = Column(String(20))
    email = Column(String(255))
    instructions = Column(Text)  # Special delivery/pickup instructions
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verification_method = Column(String(50))  # "gps", "document", "manual"
    verified_at = Column(TIMESTAMP(timezone=True))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    extras = Column(JSONB, default=dict)
    
    # Relationships
    business = relationship("Business", back_populates="addresses")
    
    __table_args__ = (
        Index('idx_address_business_type', 'business_id', 'address_type'),
        Index('idx_address_city_country', 'city', 'country'),
        Index('idx_address_location', 'latitude', 'longitude'),
        Index('idx_address_geohash', 'geohash'),
        Index('idx_address_neighborhood', 'neighborhood'),
    )


class BusinessSocialLink(Base):
    """Social media links for businesses - supports multiple platforms"""
    __tablename__ = "business_social_links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Platform identification
    platform = Column(String(50), nullable=False, index=True)  # "whatsapp", "facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube", "telegram", "snapchat"
    username = Column(String(200), index=True)  # Platform username/handle
    url = Column(String(500), nullable=False)  # Full profile URL
    
    # Engagement metrics (cached for performance)
    followers_count = Column(Integer, default=0)
    is_verified_platform = Column(Boolean, default=False)  # Verified on the social platform
    
    # Business usage
    is_primary_contact = Column(Boolean, default=False)  # Preferred contact channel
    response_rate = Column(Float, default=0.0)  # Response rate on this platform
    response_time_avg = Column(Float, default=0.0)  # Average response time in minutes
    
    # Integration status
    is_connected_api = Column(Boolean, default=False)  # API connected for automation
    api_last_sync = Column(TIMESTAMP(timezone=True))
    webhook_url = Column(String(500))  # For real-time notifications
    
    # Display preferences
    display_order = Column(Integer, default=0)
    is_public = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    extras = Column(JSONB, default=dict)  # Platform-specific data
    
    # Relationships
    business = relationship("Business", back_populates="social_links")
    
    __table_args__ = (
        Index('idx_social_business_platform', 'business_id', 'platform'),
        Index('idx_social_platform_username', 'platform', 'username'),
        Index('idx_social_primary', 'is_primary_contact'),
    )

class Verification(Base):
    """Business verification records"""
    __tablename__ = "verifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    verification_type = Column(String(50), nullable=False)  # "phone", "email", "license", "address", "tax"
    status = Column(String(20), default="pending")  # pending, approved, rejected
    document_url = Column(String(500))  # Uploaded document (compressed)
    verified_by = Column(String(100))  # Admin/AI verifier
    verified_at = Column(TIMESTAMP(timezone=True))
    rejection_reason = Column(Text)
    expires_at = Column(TIMESTAMP(timezone=True))
    extras = Column(JSONB, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Relationships
    business = relationship("Business", back_populates="verifications")
    
    __table_args__ = (
        Index('idx_verification_business_type', 'business_id', 'verification_type'),
        Index('idx_verification_status', 'status'),
    )

class Product(Base):
    """Product/Service catalog for businesses"""
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    category = Column(String(100), index=True)
    price = Column(Numeric(12, 2), nullable=False)  # Stored in smallest currency unit
    currency = Column(String(3), default="XAF")  # XAF, NGN, KES, GHS, etc.
    unit = Column(String(50))  # piece, kg, hour, etc.
    
    # Inventory
    stock_quantity = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    
    # Media (optimized)
    image_urls = Column(JSONB, default=list)
    thumbnail_url = Column(String(500))  # Compressed thumbnail
    
    # SEO & Discovery
    tags = Column(JSONB, default=list)
    is_featured = Column(Boolean, default=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    extras = Column(JSONB, default=dict)
    
    # Relationships
    business = relationship("Business", back_populates="products")
    
    __table_args__ = (
        Index('idx_product_business_category', 'business_id', 'category'),
        Index('idx_product_price', 'price'),
        Index('idx_product_available', 'is_available'),
    )

class Lead(Base):
    """Customer leads/inquiries (WhatsApp clicks, quote requests, etc.)"""
    __tablename__ = "leads"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    lead_type = Column(String(50), nullable=False)  # "whatsapp_click", "call", "quote_request", "visit"
    source = Column(String(50))  # "search", "map", "qr_code", "referral"
    
    # Lead details
    message = Column(Text)  # User message for quote requests
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    status = Column(String(20), default="new")  # new, contacted, converted, lost
    
    # Conversion tracking
    converted_at = Column(TIMESTAMP(timezone=True))
    conversion_value = Column(Numeric(12, 2))  # Final transaction value
    
    # Communication channel used
    channel = Column(String(50))  # "whatsapp", "phone", "email", "in_app"
    whatsapp_session_id = Column(String(100))  # For WhatsApp Business API tracking
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    extras = Column(JSONB, default=dict)
    
    # Relationships
    business = relationship("Business", back_populates="leads")
    product = relationship("Product")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_lead_business_type', 'business_id', 'lead_type'),
        Index('idx_lead_created_at', 'created_at'),
        Index('idx_lead_status', 'status'),
    )

class Review(Base):
    """Customer reviews with anti-spam measures"""
    __tablename__ = "reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Review content
    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String(200))
    comment = Column(Text)
    
    # Moderation & Trust
    is_verified_purchase = Column(Boolean, default=False)  # Via escrow transactions
    is_moderated = Column(Boolean, default=False)
    moderation_status = Column(String(20), default="pending")  # pending, approved, rejected, flagged
    spam_score = Column(Float, default=0.0)  # AI-calculated spam probability
    
    # Engagement
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    
    # Images (compressed)
    image_urls = Column(JSONB, default=list)
    
    # Response from business
    owner_response = Column(Text)
    owner_response_at = Column(TIMESTAMP(timezone=True))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    extras = Column(JSONB, default=dict)
    
    # Relationships
    business = relationship("Business", back_populates="reviews")
    user = relationship("User", back_populates="reviews")
    
    __table_args__ = (
        Index('idx_review_business_rating', 'business_id', 'rating'),
        Index('idx_review_created_at', 'created_at'),
        Index('idx_review_moderation', 'moderation_status'),
    )

class Transaction(Base):
    """Payment transactions (escrow, direct payments)"""
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"))
    
    # Transaction details
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    payment_method = Column(String(50), nullable=False)  # "flutterwave", "paystack", "mobile_money", "escrow"
    payment_provider_id = Column(String(100))  # External provider transaction ID
    
    # Escrow specific
    is_escrow = Column(Boolean, default=False)
    escrow_status = Column(String(20), default="pending")  # pending, held, released, refunded
    release_conditions = Column(JSONB)  # Conditions for escrow release
    
    # Status
    status = Column(String(20), default="pending")  # pending, completed, failed, refunded
    failure_reason = Column(Text)
    
    # Delivery tracking (if applicable)
    delivery_status = Column(String(20))  # pending, in_transit, delivered
    delivery_tracking_id = Column(String(100))
    delivery_rider_id = Column(UUID(as_uuid=True))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True))
    extras = Column(JSONB, default=dict)
    
    # Relationships
    business = relationship("Business")
    user = relationship("User")
    lead = relationship("Lead")
    
    __table_args__ = (
        Index('idx_transaction_business_status', 'business_id', 'status'),
        Index('idx_transaction_user', 'user_id'),
        Index('idx_transaction_created_at', 'created_at'),
    )

class AnalyticsEvent(Base):
    """Analytics events for BI dashboard"""
    __tablename__ = "analytics_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), index=True)
    event_type = Column(String(50), nullable=False, index=True)  # "view", "click", "lead", "conversion"
    event_source = Column(String(50))  # "web", "mobile", "whatsapp", "qr"
    
    # Event data
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    session_id = Column(String(100))
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(String(500))
    
    # Geolocation
    latitude = Column(Float)
    longitude = Column(Float)
    country = Column(String(2))
    city = Column(String(100))
    
    # Event specifics
    referrer = Column(String(500))
    landing_page = Column(String(500))
    action_details = Column(JSONB)  # Flexible event-specific data
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), index=True)
    
    __table_args__ = (
        Index('idx_analytics_business_type_date', 'business_id', 'event_type', 'created_at'),
        Index('idx_analytics_country', 'country'),
    )


# ============================================================================
# DATABASE VIEWS (Materialized for High-Performance Analytics)
# ============================================================================

class BusinessStatsView(Base):
    """Materialized view: Aggregated business statistics for fast dashboard queries"""
    __tablename__ = "v_business_stats"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    business_id = Column(UUID(as_uuid=True), index=True)
    
    # Review stats
    total_reviews = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    rating_distribution = Column(JSONB, default=dict)  # {"5": 10, "4": 5, ...}
    verified_reviews_count = Column(Integer, default=0)
    
    # Lead stats
    total_leads = Column(Integer, default=0)
    leads_last_30_days = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    avg_response_time_minutes = Column(Float, default=0.0)
    
    # Engagement stats
    profile_views_30d = Column(Integer, default=0)
    whatsapp_clicks_30d = Column(Integer, default=0)
    call_clicks_30d = Column(Integer, default=0)
    website_clicks_30d = Column(Integer, default=0)
    
    # Transaction stats
    total_transactions = Column(Integer, default=0)
    total_revenue = Column(Numeric(15, 2), default=0.0)
    revenue_last_30_days = Column(Numeric(15, 2), default=0.0)
    escrow_success_rate = Column(Float, default=0.0)
    
    # Trust metrics
    trust_score = Column(Float, default=0.0)
    verification_count = Column(Integer, default=0)
    active_verifications = Column(Integer, default=0)
    
    # Social metrics
    social_links_count = Column(Integer, default=0)
    total_social_followers = Column(Integer, default=0)
    
    updated_at = Column(TIMESTAMP(timezone=True))
    
    __table_args__ = (
        Index('idx_biz_stats_business', 'business_id'),
        Index('idx_biz_stats_rating', 'average_rating'),
        Index('idx_biz_stats_trust', 'trust_score'),
        Index('idx_biz_stats_revenue', 'revenue_last_30_days'),
    )


class LocationHotspotView(Base):
    """Materialized view: Geographic hotspots for business density analysis"""
    __tablename__ = "v_location_hotspots"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    
    # Location identifiers
    country = Column(String(2), index=True)
    region = Column(String(100), index=True)
    city = Column(String(100), index=True)
    neighborhood = Column(String(100), index=True)
    
    # Geospatial
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geohash = Column(String(12), index=True)
    
    # Business density
    total_businesses = Column(Integer, default=0)
    verified_businesses = Column(Integer, default=0)
    businesses_open_now = Column(Integer, default=0)
    
    # Category breakdown
    top_categories = Column(JSONB, default=list)  # [{"category": "restaurant", "count": 50}, ...]
    
    # Performance metrics
    avg_trust_score = Column(Float, default=0.0)
    avg_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    
    # Economic indicators
    total_monthly_revenue = Column(Numeric(15, 2), default=0.0)
    avg_delivery_radius = Column(Float, default=0.0)
    
    updated_at = Column(TIMESTAMP(timezone=True))
    
    __table_args__ = (
        Index('idx_hotspot_city_country', 'city', 'country'),
        Index('idx_hotspot_geohash', 'geohash'),
        Index('idx_hotspot_density', 'total_businesses'),
    )


class CategoryTrendView(Base):
    """Materialized view: Category performance trends over time"""
    __tablename__ = "v_category_trends"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    
    # Category identification
    category = Column(String(100), nullable=False, index=True)
    subcategory = Column(String(100), index=True)
    country = Column(String(2), index=True)
    
    # Time period
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    period_type = Column(String(20), nullable=False)  # "daily", "weekly", "monthly"
    
    # Business metrics
    new_businesses = Column(Integer, default=0)
    closed_businesses = Column(Integer, default=0)
    active_businesses = Column(Integer, default=0)
    
    # Engagement metrics
    total_searches = Column(Integer, default=0)
    total_profile_views = Column(Integer, default=0)
    total_leads = Column(Integer, default=0)
    avg_conversion_rate = Column(Float, default=0.0)
    
    # Financial metrics
    total_transaction_volume = Column(Numeric(15, 2), default=0.0)
    avg_transaction_value = Column(Numeric(12, 2), default=0.0)
    
    # Quality metrics
    avg_trust_score = Column(Float, default=0.0)
    avg_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    
    # Growth indicators
    growth_rate = Column(Float, default=0.0)  # Percentage growth vs previous period
    trend_direction = Column(String(20))  # "rising", "stable", "declining"
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_trend_category_period', 'category', 'period_start'),
        Index('idx_trend_country_category', 'country', 'category'),
        Index('idx_trend_growth', 'growth_rate'),
    )


# ============================================================================
# ADDITIONAL HIGH-VOLUME TABLES
# ============================================================================

class SearchQuery(Base):
    """Search query logs for analytics and autocomplete optimization"""
    __tablename__ = "search_queries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Query details
    query_text = Column(String(500), nullable=False, index=True)
    normalized_query = Column(String(500), index=True)  # Lowercase, stemmed
    language = Column(String(2), default="en")
    
    # Location context
    country = Column(String(2), index=True)
    city = Column(String(100), index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    radius_km = Column(Float, default=10.0)
    
    # Filters applied
    category_filter = Column(String(100))
    price_min = Column(Numeric(12, 2))
    price_max = Column(Numeric(12, 2))
    min_rating = Column(Float)
    is_verified_only = Column(Boolean, default=False)
    is_open_now = Column(Boolean, default=False)
    filters_json = Column(JSONB, default=dict)
    
    # Results
    results_count = Column(Integer, default=0)
    clicked_business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"))
    position_clicked = Column(Integer)  # Position in results where user clicked
    
    # User context
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    session_id = Column(String(100), index=True)
    device_type = Column(String(50))  # "mobile", "desktop", "tablet"
    network_type = Column(String(50))  # "3g", "4g", "wifi", "offline"
    
    # Performance
    response_time_ms = Column(Integer)  # Query execution time
    cache_hit = Column(Boolean, default=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    clicked_business = relationship("Business")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_search_query_text', 'normalized_query'),
        Index('idx_search_location', 'country', 'city'),
        Index('idx_search_created_at', 'created_at'),
        Index('idx_search_results', 'results_count'),
    )


class Notification(Base):
    """Notification system for users and businesses"""
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Recipient
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), index=True)
    
    # Notification details
    notification_type = Column(String(50), nullable=False, index=True)  # "lead", "review", "payment", "system", "promotion"
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # Action
    action_url = Column(String(500))  # Deep link or URL
    action_type = Column(String(50))  # "open_profile", "view_lead", "respond_review"
    action_data = Column(JSONB, default=dict)
    
    # Delivery channels
    channel_in_app = Column(Boolean, default=True)
    channel_push = Column(Boolean, default=False)
    channel_email = Column(Boolean, default=False)
    channel_sms = Column(Boolean, default=False)
    channel_whatsapp = Column(Boolean, default=False)
    
    # Status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(TIMESTAMP(timezone=True))
    is_sent = Column(Boolean, default=False)
    sent_at = Column(TIMESTAMP(timezone=True))
    failed_reason = Column(Text)
    
    # Priority
    priority = Column(String(20), default="normal")  # "low", "normal", "high", "urgent"
    expires_at = Column(TIMESTAMP(timezone=True))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    business = relationship("Business")
    
    __table_args__ = (
        Index('idx_notification_user_unread', 'user_id', 'is_read'),
        Index('idx_notification_type', 'notification_type'),
        Index('idx_notification_created', 'created_at'),
    )


class Coupon(Base):
    """Promotional coupons and discount codes for businesses"""
    __tablename__ = "coupons"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Coupon details
    code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Discount type
    discount_type = Column(String(20), nullable=False)  # "percentage", "fixed", "buy_x_get_y"
    discount_value = Column(Numeric(10, 2), nullable=False)
    max_discount_amount = Column(Numeric(10, 2))  # Cap for percentage discounts
    
    # Usage limits
    usage_limit = Column(Integer, default=0)  # 0 = unlimited
    usage_count = Column(Integer, default=0)
    usage_limit_per_user = Column(Integer, default=1)
    
    # Conditions
    min_purchase_amount = Column(Numeric(10, 2), default=0.0)
    applicable_categories = Column(JSONB, default=list)
    applicable_products = Column(JSONB, default=list)
    
    # Validity
    valid_from = Column(TIMESTAMP(timezone=True), nullable=False)
    valid_until = Column(TIMESTAMP(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    
    # Targeting
    target_audience = Column(String(50))  # "all", "new_users", "returning", "vip"
    target_countries = Column(ARRAY(String(2)))  # Country codes
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
    
    # Relationships
    business = relationship("Business")
    
    __table_args__ = (
        Index('idx_coupon_business_active', 'business_id', 'is_active'),
        Index('idx_coupon_validity', 'valid_from', 'valid_until'),
        Index('idx_coupon_code', 'code'),
    )


class Bookmark(Base):
    """User bookmarks/saved businesses"""
    __tablename__ = "bookmarks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Organization
    collection_name = Column(String(100), default="default")  # User-defined collections
    notes = Column(Text)
    
    # Metadata
    added_via = Column(String(50))  # "search", "map", "profile", "qr"
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    business = relationship("Business")
    
    __table_args__ = (
        Index('idx_bookmark_user_business', 'user_id', 'business_id', unique=True),
        Index('idx_bookmark_collection', 'user_id', 'collection_name'),
    )


class Report(Base):
    """User reports for fraud, spam, or inappropriate content"""
    __tablename__ = "reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Reporter
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Reported entity
    reported_type = Column(String(50), nullable=False, index=True)  # "business", "review", "user", "product"
    reported_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Report details
    report_reason = Column(String(50), nullable=False)  # "fraud", "spam", "inappropriate", "fake_review", "closed_business"
    description = Column(Text)
    evidence_urls = Column(JSONB, default=list)
    
    # Moderation
    status = Column(String(20), default="pending", index=True)  # "pending", "under_review", "resolved", "dismissed"
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # Admin user
    review_notes = Column(Text)
    resolution = Column(String(200))
    
    # Actions taken
    action_taken = Column(String(200))  # Description of moderation action
    business_notified = Column(Boolean, default=False)
    business_response = Column(Text)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    reviewed_at = Column(TIMESTAMP(timezone=True))
    
    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    
    __table_args__ = (
        Index('idx_report_entity', 'reported_type', 'reported_id'),
        Index('idx_report_status', 'status'),
        Index('idx_report_created', 'created_at'),
    )
