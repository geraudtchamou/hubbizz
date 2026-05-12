"""Add business addresses, social links, and high-volume analytics tables

Revision ID: 002_enhanced_schema
Revises: 001_initial_schema
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_enhanced_schema'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Create business_addresses table
    op.create_table('business_addresses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('address_type', sa.String(50), nullable=False),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.Column('street_number', sa.String(20)),
        sa.Column('street_name', sa.String(200)),
        sa.Column('neighborhood', sa.String(100)),
        sa.Column('landmark', sa.String(200)),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('municipality', sa.String(100)),
        sa.Column('region', sa.String(100)),
        sa.Column('country', sa.String(2), nullable=False),
        sa.Column('postal_code', sa.String(20)),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('location', postgresql.GEOMETRY(geometry_type='POINT')),
        sa.Column('geohash', sa.String(12)),
        sa.Column('is_delivery_available', sa.Boolean(), default=True),
        sa.Column('delivery_radius_km', sa.Float(), default=5.0),
        sa.Column('delivery_fee', sa.Numeric(10, 2), default=0.0),
        sa.Column('delivery_time_estimate', sa.String(50)),
        sa.Column('wheelchair_accessible', sa.Boolean(), default=False),
        sa.Column('parking_available', sa.Boolean(), default=False),
        sa.Column('phone', sa.String(20)),
        sa.Column('email', sa.String(255)),
        sa.Column('instructions', sa.Text()),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('verification_method', sa.String(50)),
        sa.Column('verified_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text())),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for business_addresses
    op.create_index('idx_address_business_type', 'business_addresses', ['business_id', 'address_type'])
    op.create_index('idx_address_city_country', 'business_addresses', ['city', 'country'])
    op.create_index('idx_address_location', 'business_addresses', ['latitude', 'longitude'])
    op.create_index('idx_address_geohash', 'business_addresses', ['geohash'])
    op.create_index('idx_address_neighborhood', 'business_addresses', ['neighborhood'])
    
    # Create business_social_links table
    op.create_table('business_social_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('username', sa.String(200)),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('followers_count', sa.Integer(), default=0),
        sa.Column('is_verified_platform', sa.Boolean(), default=False),
        sa.Column('is_primary_contact', sa.Boolean(), default=False),
        sa.Column('response_rate', sa.Float(), default=0.0),
        sa.Column('response_time_avg', sa.Float(), default=0.0),
        sa.Column('is_connected_api', sa.Boolean(), default=False),
        sa.Column('api_last_sync', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('webhook_url', sa.String(500)),
        sa.Column('display_order', sa.Integer(), default=0),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text())),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for business_social_links
    op.create_index('idx_social_business_platform', 'business_social_links', ['business_id', 'platform'])
    op.create_index('idx_social_platform_username', 'business_social_links', ['platform', 'username'])
    op.create_index('idx_social_primary', 'business_social_links', ['is_primary_contact'])
    
    # Create search_queries table
    op.create_table('search_queries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('query_text', sa.String(500), nullable=False),
        sa.Column('normalized_query', sa.String(500)),
        sa.Column('language', sa.String(2), default='en'),
        sa.Column('country', sa.String(2)),
        sa.Column('city', sa.String(100)),
        sa.Column('latitude', sa.Float()),
        sa.Column('longitude', sa.Float()),
        sa.Column('radius_km', sa.Float(), default=10.0),
        sa.Column('category_filter', sa.String(100)),
        sa.Column('price_min', sa.Numeric(12, 2)),
        sa.Column('price_max', sa.Numeric(12, 2)),
        sa.Column('min_rating', sa.Float()),
        sa.Column('is_verified_only', sa.Boolean(), default=False),
        sa.Column('is_open_now', sa.Boolean(), default=False),
        sa.Column('filters_json', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('results_count', sa.Integer(), default=0),
        sa.Column('clicked_business_id', postgresql.UUID(as_uuid=True)),
        sa.Column('position_clicked', sa.Integer()),
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('session_id', sa.String(100)),
        sa.Column('device_type', sa.String(50)),
        sa.Column('network_type', sa.String(50)),
        sa.Column('response_time_ms', sa.Integer()),
        sa.Column('cache_hit', sa.Boolean(), default=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for search_queries
    op.create_index('idx_search_query_text', 'search_queries', ['normalized_query'])
    op.create_index('idx_search_location', 'search_queries', ['country', 'city'])
    op.create_index('idx_search_created_at', 'search_queries', ['created_at'])
    op.create_index('idx_search_results', 'search_queries', ['results_count'])
    
    # Create notifications table
    op.create_table('notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True)),
        sa.Column('notification_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('action_url', sa.String(500)),
        sa.Column('action_type', sa.String(50)),
        sa.Column('action_data', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('channel_in_app', sa.Boolean(), default=True),
        sa.Column('channel_push', sa.Boolean(), default=False),
        sa.Column('channel_email', sa.Boolean(), default=False),
        sa.Column('channel_sms', sa.Boolean(), default=False),
        sa.Column('channel_whatsapp', sa.Boolean(), default=False),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('read_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('is_sent', sa.Boolean(), default=False),
        sa.Column('sent_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('failed_reason', sa.Text()),
        sa.Column('priority', sa.String(20), default='normal'),
        sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True)),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notifications
    op.create_index('idx_notification_user_unread', 'notifications', ['user_id', 'is_read'])
    op.create_index('idx_notification_type', 'notifications', ['notification_type'])
    op.create_index('idx_notification_created', 'notifications', ['created_at'])
    
    # Create coupons table
    op.create_table('coupons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('discount_type', sa.String(20), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('max_discount_amount', sa.Numeric(10, 2)),
        sa.Column('usage_limit', sa.Integer(), default=0),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.Column('usage_limit_per_user', sa.Integer(), default=1),
        sa.Column('min_purchase_amount', sa.Numeric(10, 2), default=0.0),
        sa.Column('applicable_categories', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('applicable_products', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('valid_from', postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('valid_until', postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('target_audience', sa.String(50)),
        sa.Column('target_countries', postgresql.ARRAY(sa.String(2))),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True)),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    
    # Create indexes for coupons
    op.create_index('idx_coupon_business_active', 'coupons', ['business_id', 'is_active'])
    op.create_index('idx_coupon_validity', 'coupons', ['valid_from', 'valid_until'])
    op.create_index('idx_coupon_code', 'coupons', ['code'])
    
    # Create bookmarks table
    op.create_table('bookmarks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_name', sa.String(100), default='default'),
        sa.Column('notes', sa.Text()),
        sa.Column('added_via', sa.String(50)),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for bookmarks
    op.create_index('idx_bookmark_user_business', 'bookmarks', ['user_id', 'business_id'], unique=True)
    op.create_index('idx_bookmark_collection', 'bookmarks', ['user_id', 'collection_name'])
    
    # Create reports table
    op.create_table('reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reporter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reported_type', sa.String(50), nullable=False),
        sa.Column('reported_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('report_reason', sa.String(50), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('evidence_urls', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True)),
        sa.Column('review_notes', sa.Text()),
        sa.Column('resolution', sa.String(200)),
        sa.Column('action_taken', sa.String(200)),
        sa.Column('business_notified', sa.Boolean(), default=False),
        sa.Column('business_response', sa.Text()),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('reviewed_at', postgresql.TIMESTAMP(timezone=True)),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for reports
    op.create_index('idx_report_entity', 'reports', ['reported_type', 'reported_id'])
    op.create_index('idx_report_status', 'reports', ['status'])
    op.create_index('idx_report_created', 'reports', ['created_at'])
    
    # Add foreign key constraints
    op.create_foreign_key('fk_address_business', 'business_addresses', 'businesses', ['business_id'], ['id'])
    op.create_foreign_key('fk_social_business', 'business_social_links', 'businesses', ['business_id'], ['id'])
    op.create_foreign_key('fk_search_clicked_business', 'search_queries', 'businesses', ['clicked_business_id'], ['id'])
    op.create_foreign_key('fk_search_user', 'search_queries', 'users', ['user_id'], ['id'])
    op.create_foreign_key('fk_notification_user', 'notifications', 'users', ['user_id'], ['id'])
    op.create_foreign_key('fk_notification_business', 'notifications', 'businesses', ['business_id'], ['id'])
    op.create_foreign_key('fk_coupon_business', 'coupons', 'businesses', ['business_id'], ['id'])
    op.create_foreign_key('fk_bookmark_user', 'bookmarks', 'users', ['user_id'], ['id'])
    op.create_foreign_key('fk_bookmark_business', 'bookmarks', 'businesses', ['business_id'], ['id'])
    op.create_foreign_key('fk_report_reporter', 'reports', 'users', ['reporter_id'], ['id'])
    op.create_foreign_key('fk_report_reviewer', 'reports', 'users', ['reviewed_by'], ['id'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('reports')
    op.drop_table('bookmarks')
    op.drop_table('coupons')
    op.drop_table('notifications')
    op.drop_table('search_queries')
    op.drop_table('business_social_links')
    op.drop_table('business_addresses')
