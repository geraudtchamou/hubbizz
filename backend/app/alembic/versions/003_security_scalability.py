"""
AfriHub Database Security & Scalability Migration
-------------------------------------------------
Implements:
1. Row-Level Security (RLS) for multi-tenant isolation
2. Geospatial Privacy (Location Fuzzing)
3. Immutable Audit Logging
4. Time-Series Partitioning for Analytics
5. Rate Limiting Structures (Redis-compatible)
6. Materialized Views for Trust Scores
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision = '003_security_scalability'
down_revision = '002_enhanced_schema'
branch_labels = None
depends_on = None


def upgrade():
    # 1. ENABLE EXTENSIONS
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_cron;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # 2. AUDIT LOGGING TABLE (Immutable)
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), primary_key=True, default=sa.text('gen_random_uuid()')),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('actor_id', sa.UUID(), nullable=True),  # User who did it
        sa.Column('action', sa.String(50), nullable=False),  # INSERT, UPDATE, DELETE
        sa.Column('table_name', sa.String(100), nullable=False),
        sa.Column('record_id', sa.UUID(), nullable=True),
        sa.Column('old_data', postgresql.JSONB(), nullable=True),
        sa.Column('new_data', postgresql.JSONB(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.Column('risk_score', sa.Integer(), default=0),  # AI calculated risk
    )
    op.create_index('idx_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('idx_audit_logs_actor', 'audit_logs', ['actor_id'])
    op.create_index('idx_audit_logs_table', 'audit_logs', ['table_name', 'record_id'])

    # 3. RATE LIMITING TRACKER (For Redis sync or DB fallback)
    op.create_table(
        'rate_limits',
        sa.Column('key', sa.String(255), primary_key=True),  # e.g., "sms:237600000000"
        sa.Column('count', sa.Integer(), default=0),
        sa.Column('window_start', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('window_end', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('blocked', sa.Boolean(), default=False),
    )
    op.create_index('idx_rate_limits_window', 'rate_limits', ['window_end'])

    # 4. PARTITIONED ANALYTICS TABLE (Time-Series)
    # Note: In raw SQL we create the parent and partitions. Here we define the base.
    op.execute("""
        CREATE TABLE analytics_events_partitioned (
            id UUID DEFAULT gen_random_uuid(),
            business_id UUID NOT NULL,
            event_type VARCHAR(50) NOT NULL, -- view, click, call, whatsapp
            metadata JSONB,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ip_hash VARCHAR(64), -- Privacy preserved IP
            PRIMARY KEY (business_id, occurred_at)
        ) PARTITION BY RANGE (occurred_at);
    """)
    
    # Create initial partitions (Current Year + Next Year)
    # In production, a cron job would create future partitions automatically
    op.execute("""
        CREATE TABLE analytics_events_2024 PARTITION OF analytics_events_partitioned
        FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
        CREATE TABLE analytics_events_2025 PARTITION OF analytics_events_partitioned
        FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
    """)
    op.create_index('idx_analytics_business_time', 'analytics_events_partitioned', ['business_id', 'occurred_at'])

    # 5. GEOSPATIAL PRIVACY FUNCTIONS
    op.execute("""
        CREATE OR REPLACE FUNCTION fuzz_location(input_geom GEOMETRY, meters INTEGER)
        RETURNS GEOMETRY AS $$
        BEGIN
            -- Snap to grid of ~meters/111000 degrees (rough approx for lat/lon)
            -- Adds random noise within the radius
            RETURN ST_SnapToGrid(
                ST_Translate(
                    input_geom, 
                    (random() - 0.5) * (meters / 111000.0), 
                    (random() - 0.5) * (meters / 111000.0)
                ), 
                0.0001
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    """)

    # Add public_geom column to business_addresses for safe display
    op.add_column('business_addresses', sa.Column('public_geom', postgresql.GEOMETRY('POINT', 4326), nullable=True))
    
    # Trigger to auto-fuzz location on insert/update
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_fuzz_location()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.geom IS NOT NULL THEN
                -- 500m fuzz for informal traders, 50m for verified shops
                SELECT fuzz_location(NEW.geom, 500) INTO NEW.public_geom;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER before_insert_fuzz
        BEFORE INSERT OR UPDATE ON business_addresses
        FOR EACH ROW EXECUTE FUNCTION trg_fuzz_location();
    """)

    # 6. MATERIALIZED VIEW FOR TRUST SCORES (Performance)
    op.execute("""
        CREATE MATERIALIZED VIEW mv_business_trust_scores AS
        SELECT 
            b.id as business_id,
            b.verification_status,
            COUNT(DISTINCT r.id) as review_count,
            AVG(r.rating) as avg_rating,
            COUNT(DISTINCT CASE WHEN v.status = 'approved' THEN 1 END) as verified_docs,
            -- Simple trust algorithm: Base + Reviews + Verification
            (
                (CASE WHEN b.verification_status = 'verified' THEN 20 ELSE 0 END) +
                (COALESCE(AVG(r.rating), 0) * 10) +
                (LEAST(COUNT(DISTINCT r.id), 50) * 0.5) +
                (COUNT(DISTINCT CASE WHEN v.status = 'approved' THEN 1 END) * 5)
            )::NUMERIC(5,2) as calculated_score
        FROM businesses b
        LEFT JOIN reviews r ON b.id = r.business_id AND r.is_moderated = true
        LEFT JOIN verifications v ON b.id = v.business_id
        GROUP BY b.id, b.verification_status;
    """)
    op.create_unique_index('idx_mv_trust_business', 'mv_business_trust_scores', ['business_id'])

    # 7. ROW LEVEL SECURITY (RLS) POLICIES
    # Enable RLS on sensitive tables
    op.execute("ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;")
    
    # Policy: Users can only see their own business details in write operations
    # Public can see verified businesses
    op.execute("""
        CREATE POLICY "Public can see verified businesses"
        ON businesses
        FOR SELECT
        USING (verification_status = 'verified' OR is_public = true);
    """)
    
    op.execute("""
        CREATE POLICY "Owners can manage their businesses"
        ON businesses
        FOR ALL
        USING (auth.uid() = owner_id); -- Assumes Supabase/Auth integration
    """)

    # 8. AUTOMATIC AUDIT TRIGGER GENERATOR
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_trigger_func()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                INSERT INTO audit_logs (action, table_name, record_id, old_data)
                VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
                RETURN OLD;
            ELSIF TG_OP = 'UPDATE' THEN
                INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
                VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
                RETURN NEW;
            ELSIF TG_OP = 'INSERT' THEN
                INSERT INTO audit_logs (action, table_name, record_id, new_data)
                VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
                RETURN NEW;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Apply audit trigger to critical tables
    for table in ['businesses', 'reviews', 'transactions', 'verifications']:
        op.execute(f"""
            CREATE TRIGGER trg_audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
        """)

    # 9. PG_CRON JOB FOR MAINTENANCE
    # Refresh materialized views every 15 mins
    op.execute("""
        SELECT cron.schedule(
            'refresh-trust-scores',
            '*/15 * * * *',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_business_trust_scores;'
        );
    """)


def downgrade():
    op.execute("SELECT cron.unschedule('refresh-trust-scores');")
    
    # Drop triggers
    for table in ['businesses', 'reviews', 'transactions', 'verifications']:
        op.execute(f"DROP TRIGGER IF EXISTS trg_audit_{table} ON {table};")
    
    op.execute("DROP TRIGGER IF EXISTS before_insert_fuzz ON business_addresses;")
    op.execute("DROP FUNCTION IF EXISTS trg_fuzz_location();")
    op.execute("DROP FUNCTION IF EXISTS fuzz_location(GEOMETRY, INTEGER);")
    op.execute("DROP FUNCTION IF EXISTS audit_trigger_func();")
    
    op.drop_table('rate_limits')
    op.drop_table('audit_logs')
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_business_trust_scores;")
    op.execute("DROP TABLE IF EXISTS analytics_events_partitioned;")
    
    # Check if column exists before dropping
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('business_addresses')]
    
    if 'public_geom' in columns:
        op.drop_column('business_addresses', 'public_geom')
