# AfriHub Enhanced Database Schema

## Phase 2 Enhancement: High-Volume Tables, Views & Indexes

This document details the enhanced database schema for AfriHub, optimized for high-volume diverse queries across African markets.

---

## 📊 New Tables Added

### 1. `business_addresses` - Normalized Address Management
**Purpose**: Support multiple locations per business with African-specific addressing patterns.

**Key Features**:
- Multiple address types: headquarters, branch, warehouse, pickup_point, service_area
- Structured fields: street_number, street_name, neighborhood, landmark (critical for African addressing)
- Geospatial: PostGIS POINT + Geohash for fast proximity searches
- Delivery info: radius, fees, time estimates
- Accessibility: wheelchair, parking flags

**Indexes**:
- `idx_address_business_type` - Composite (business_id, address_type)
- `idx_address_city_country` - Location filtering
- `idx_address_location` - Lat/long queries
- `idx_address_geohash` - Proximity searches
- `idx_address_neighborhood` - Local area searches

---

### 2. `business_social_links` - Social Media Integration
**Purpose**: Multi-platform social presence tracking with engagement metrics.

**Supported Platforms**: WhatsApp, Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube, Telegram, Snapchat

**Key Features**:
- Platform-specific usernames and URLs
- Follower counts and verification status
- Response rate/time tracking per platform
- API integration status and webhooks
- Display ordering and visibility controls

**Indexes**:
- `idx_social_business_platform` - Quick lookup by business+platform
- `idx_social_platform_username` - Cross-platform search
- `idx_social_primary` - Find primary contact channel

---

### 3. `search_queries` - Search Analytics
**Purpose**: Log and analyze search behavior for autocomplete optimization and BI.

**Key Features**:
- Query text + normalized version (lowercase, stemmed)
- Location context: country, city, lat/long, radius
- Applied filters: category, price range, rating, verified-only, open-now
- Results tracking: count, clicked business, position clicked
- User context: device type, network type (3G/4G/WiFi)
- Performance: response time, cache hit flag

**Indexes**:
- `idx_search_query_text` - Autocomplete suggestions
- `idx_search_location` - Geographic trend analysis
- `idx_search_created_at` - Time-series analysis
- `idx_search_results` - Zero-result query detection

---

### 4. `notifications` - Multi-Channel Notification System
**Purpose**: Unified notification delivery across channels.

**Channels**: In-app, Push, Email, SMS, WhatsApp

**Key Features**:
- Notification types: lead, review, payment, system, promotion
- Action URLs and deep linking
- Read/unread tracking with timestamps
- Priority levels: low, normal, high, urgent
- Expiration dates for time-sensitive notifications

**Indexes**:
- `idx_notification_user_unread` - Fast unread count
- `idx_notification_type` - Filtering by type
- `idx_notification_created` - Chronological ordering

---

### 5. `coupons` - Promotional Campaigns
**Purpose**: Discount code management for SME marketing.

**Key Features**:
- Discount types: percentage, fixed, buy-X-get-Y
- Usage limits: total, per-user caps
- Conditions: minimum purchase, category/product restrictions
- Targeting: audience segments, country-specific
- Validity periods with timezone support

**Indexes**:
- `idx_coupon_business_active` - Active coupons per business
- `idx_coupon_validity` - Date range queries
- `idx_coupon_code` - Unique code lookup

---

### 6. `bookmarks` - Saved Businesses
**Purpose**: User collections of favorite businesses.

**Key Features**:
- User-defined collection names
- Personal notes per bookmark
- Source tracking (search, map, profile, QR)

**Indexes**:
- `idx_bookmark_user_business` - Unique constraint
- `idx_bookmark_collection` - Collection grouping

---

### 7. `reports` - Content Moderation
**Purpose**: User-reported fraud, spam, and inappropriate content.

**Report Reasons**: fraud, spam, inappropriate, fake_review, closed_business

**Key Features**:
- Evidence URL attachments
- Moderation workflow: pending → under_review → resolved/dismissed
- Reviewer assignment and notes
- Business notification and response tracking

**Indexes**:
- `idx_report_entity` - Reports by entity type/id
- `idx_report_status` - Moderation queue
- `idx_report_created` - Time-based analysis

---

## 📈 Materialized Views (Analytics Optimization)

### 1. `v_business_stats` - Business Dashboard Aggregates
**Pre-computed Metrics**:
- Review stats: total, average rating, distribution, verified count
- Lead stats: total, last 30 days, conversion rate, avg response time
- Engagement: profile views, WhatsApp/call/website clicks (30d)
- Transactions: total, revenue, last 30 days, escrow success rate
- Trust: score, verification counts
- Social: link count, total followers

**Use Case**: Instant dashboard loading without complex JOINs.

---

### 2. `v_location_hotspots` - Geographic Business Density
**Pre-computed Metrics**:
- Business density: total, verified, open now
- Category breakdown (top categories JSONB)
- Performance: avg trust score, avg rating, total reviews
- Economic: monthly revenue, avg delivery radius

**Use Case**: Map clustering, market expansion analysis, heatmaps.

---

### 3. `v_category_trends` - Category Performance Over Time
**Pre-computed Metrics**:
- Business metrics: new, closed, active counts
- Engagement: searches, views, leads, conversion rate
- Financial: transaction volume, avg value
- Quality: trust score, rating, reviews
- Growth: growth rate %, trend direction

**Time Periods**: Daily, Weekly, Monthly

**Use Case**: Trend analysis, investment decisions, category recommendations.

---

## 🔍 Index Strategy Summary

### Geospatial Indexes
| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| businesses | idx_business_location | latitude, longitude | Nearby search |
| business_addresses | idx_address_location | latitude, longitude | Multi-location search |
| business_addresses | idx_address_geohash | geohash | Proximity clustering |
| v_location_hotspots | idx_hotspot_geohash | geohash | Hotspot mapping |

### High-Volume Query Indexes
| Table | Index | Columns | Query Pattern |
|-------|-------|---------|---------------|
| search_queries | idx_search_query_text | normalized_query | Autocomplete |
| search_queries | idx_search_location | country, city | Geographic trends |
| notifications | idx_notification_user_unread | user_id, is_read | Unread count |
| bookmarks | idx_bookmark_user_business | user_id, business_id | Unique save check |
| reports | idx_report_entity | reported_type, reported_id | Entity reports |

### Composite Indexes for Filtering
| Table | Index | Columns | Use Case |
|-------|-------|---------|----------|
| businesses | idx_business_category_country | category, country | Category browsing |
| business_addresses | idx_address_business_type | business_id, address_type | Location filtering |
| business_social_links | idx_social_business_platform | business_id, platform | Social lookup |
| coupons | idx_coupon_business_active | business_id, is_active | Active promotions |

---

## 🚀 Performance Optimizations

### 1. Connection Pooling
- **Pool Size**: 20 connections
- **Max Overflow**: 40 additional connections
- **Pool Pre-ping**: Enabled (connection health checks)
- **Pool Recycle**: 1 hour

### 2. JSONB for Flexible Data
- Subcategories, tags, payment methods
- Metadata/extras for extensibility
- Rating distributions, top categories
- Filter configurations, action data

### 3. Integer Currency Storage
- All amounts stored as `Numeric(12,2)` or `Numeric(15,2)`
- Prevents floating-point precision errors
- Supports multiple African currencies (XAF, NGN, KES, GHS)

### 4. UUID Primary Keys
- Distributed ID generation
- No sequential ID exposure
- Merge-friendly for future sharding

### 5. Timestamp Standardization
- All timestamps: `TIMESTAMP(timezone=True)`
- Server defaults for created_at
- Auto-updates for updated_at

---

## 🌍 Africa-Specific Features

### Address Normalization
```sql
-- Landmark-based addressing (common in Africa)
landmark VARCHAR(200)  -- "Near Central Market", "Opposite GTBank"
neighborhood VARCHAR(100)  -- Local district/area name
```

### Network-Aware Search Logging
```python
network_type: "3g" | "4g" | "wifi" | "offline"
# Enables optimization for low-connectivity areas
```

### Multi-Country Support
```python
country: String(2)  # ISO codes: CM, NG, KE, GH, SN, CI, CD
target_countries: ARRAY(String(2))  # For coupon targeting
```

### Mobile-First Design
- Phone numbers as primary user identifiers
- WhatsApp integration fields throughout
- SMS notification channel support

---

## 📝 Migration Instructions

### Apply Migration
```bash
cd backend
alembic upgrade head
```

### Rollback (if needed)
```bash
alembic downgrade -1
```

### Verify Tables
```sql
-- List all tables
\dt

-- Check indexes on a table
\d business_addresses

-- View materialized view
SELECT * FROM v_business_stats LIMIT 10;
```

---

## 🔮 Future Enhancements

1. **Partitioning**: Time-based partitioning for `search_queries`, `analytics_events`
2. **Full-Text Search**: PostgreSQL TSVECTOR for query text indexing
3. **Read Replicas**: Separate read/write databases for scaling
4. **Caching Layer**: Redis integration for materialized view refreshes
5. **Data Archival**: Automated archival of old search/query data

---

**Schema Version**: 002_enhanced_schema  
**Last Updated**: 2024-01-15  
**Total Tables**: 18 (15 base + 3 materialized views)  
**Total Indexes**: 50+ optimized indexes
