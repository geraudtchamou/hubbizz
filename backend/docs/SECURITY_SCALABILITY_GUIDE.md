# AfriHub Security & Scalability Implementation Guide

This document details the security and scalability features implemented in Migration 003.

## 1. ROW-LEVEL SECURITY (RLS)

### Purpose
Prevents data leaks between SMEs and ensures multi-tenant isolation at the database level.

### Implementation
- Enabled RLS on `businesses` and `audit_logs` tables
- Policy: "Public can see verified businesses" - Allows SELECT only for verified/public businesses
- Policy: "Owners can manage their businesses" - Full CRUD access only to owner_id match

### Usage in FastAPI
```python
# Even if API logic fails, database enforces isolation
# No SME can query another SME's private data via SQL injection or bugs
```

### Compliance
Meets requirements for NDPR (Nigeria) and Kenyan Data Protection Act by design.

---

## 2. GEOSPATIAL PRIVACY (Location Fuzzing)

### Purpose
Protects informal traders and home-based businesses from exact location exposure.

### Implementation
- `fuzz_location(geometry, meters)` function adds random noise within radius
- `public_geom` column stores fuzzed coordinates (500m for informal, 50m for verified)
- Trigger `before_insert_fuzz` automatically fuzzes on INSERT/UPDATE

### Algorithm
```sql
ST_SnapToGrid(
    ST_Translate(
        exact_geom, 
        random_offset_lat, 
        random_offset_lon
    ), 
    0.0001 -- ~10m grid
)
```

### Frontend Integration
Always use `public_geom` for map display, never `geom`.

---

## 3. IMMUTABLE AUDIT LOGGING

### Purpose
Creates tamper-proof trail for compliance, fraud detection, and dispute resolution.

### Table: `audit_logs`
- id, timestamp, actor_id, action, table_name, record_id
- old_data (JSONB), new_data (JSONB)
- ip_address, user_agent, risk_score

### Auto-Trigger
`audit_trigger_func()` automatically logs all changes to:
- businesses
- reviews
- transactions
- verifications

### AI Fraud Detection
`risk_score` field populated by async AI service analyzing:
- Unusual edit patterns
- Rapid review deletions
- Score manipulation attempts

---

## 4. TIME-SERIES PARTITIONING

### Purpose
Handles millions of analytics events without performance degradation.

### Table: `analytics_events_partitioned`
- Partitioned by RANGE on `occurred_at` (monthly/yearly)
- Pre-created partitions: 2024, 2025
- Future partitions auto-created via pg_cron

### Benefits
- DROP old partitions instantly (no VACUUM needed)
- Queries scan only relevant partitions (partition pruning)
- Indexes are smaller and more efficient

### Query Example
```sql
-- Automatically scans only 2024 partition
SELECT * FROM analytics_events_partitioned
WHERE occurred_at BETWEEN '2024-06-01' AND '2024-06-30';
```

---

## 5. RATE LIMITING STRUCTURES

### Purpose
Prevents SMS pumping fraud, API abuse, and brute-force attacks.

### Table: `rate_limits`
- key: Unique identifier (e.g., "sms:237600000000", "search:ip:1.2.3.4")
- count: Request count in window
- window_start, window_end: Sliding window boundaries
- blocked: Boolean flag for hard blocks

### Redis Integration Pattern
```python
# Check DB fallback if Redis unavailable
async def check_rate_limit(key: str, limit: int, window_seconds: int):
    # Prefer Redis INCR with EXPIRE
    # Fallback to PostgreSQL row locking
    pass
```

### Common Limits for Africa Markets
- SMS OTP: 3 per hour, 10 per day
- Search: 60 per minute
- WhatsApp leads: 20 per hour (prevent spam)

---

## 6. MATERIALIZED VIEWS FOR TRUST SCORES

### Purpose
Pre-calculates complex trust score joins for instant API responses (<100ms).

### View: `mv_business_trust_scores`
Aggregates:
- Verification status (20 points)
- Average rating × 10 (max 50 points)
- Review count capped at 50 (25 points)
- Verified documents × 5 (unlimited)

### Refresh Strategy
- pg_cron job: `*/15 * * * *` (every 15 minutes)
- CONCURRENTLY option prevents read locks during refresh

### API Usage
```python
# Instant lookup instead of 5-table JOIN
score = await db.fetchval(
    "SELECT calculated_score FROM mv_business_trust_scores WHERE business_id = $1",
    business_id
)
```

---

## 7. EXTENSIONS ENABLED

### pg_cron
- Scheduled jobs inside PostgreSQL
- Used for: Materialized view refresh, partition creation, cleanup

### pgcrypto
- Cryptographic functions
- Used for: PII encryption, secure token generation

---

## DEPLOYMENT CHECKLIST

1. [ ] Run migration: `alembic upgrade head`
2. [ ] Verify extensions: `SELECT * FROM pg_extension;`
3. [ ] Test RLS policies with different user roles
4. [ ] Confirm audit triggers firing on test updates
5. [ ] Validate partition pruning with EXPLAIN ANALYZE
6. [ ] Set up monitoring for rate_limits table growth
7. [ ] Configure alerting on high risk_score entries

---

## MONITORING QUERIES

### Audit Log Volume
```sql
SELECT table_name, action, COUNT(*) 
FROM audit_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY table_name, action;
```

### Rate Limit Violations
```sql
SELECT key, count, blocked 
FROM rate_limits 
WHERE blocked = true 
ORDER BY window_end DESC;
```

### Trust Score Distribution
```sql
SELECT 
    CASE 
        WHEN calculated_score >= 80 THEN 'High'
        WHEN calculated_score >= 50 THEN 'Medium'
        ELSE 'Low'
    END as tier,
    COUNT(*)
FROM mv_business_trust_scores
GROUP BY tier;
```

---

## NEXT STEPS

1. Implement Redis rate limiter middleware in FastAPI
2. Add AI risk scoring service for audit_logs
3. Create automated partition management cron
4. Build admin dashboard for audit log exploration
5. Integrate PII encryption for phone numbers at rest
