"""
AfriHub Database Partitioning & Maintenance
Implements time-series partitioning for analytics and automated maintenance jobs.
"""
from datetime import datetime, timedelta
from typing import List
import asyncpg
from app.core.config import settings


async def create_partitioned_tables(pool: asyncpg.Pool):
    """
    Create partitioned tables for high-volume time-series data.
    Run during initial migration or schema setup.
    """
    async with pool.acquire() as conn:
        # Create analytics_events partitioned table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                id UUID DEFAULT gen_random_uuid(),
                business_id UUID NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                event_data JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            ) PARTITION BY RANGE (created_at);
        """)
        
        # Create location_logs partitioned table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS location_logs (
                id UUID DEFAULT gen_random_uuid(),
                business_id UUID NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                accuracy_meters FLOAT,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            ) PARTITION BY RANGE (recorded_at);
        """)
        
        print("✅ Partitioned tables created successfully")


async def create_monthly_partitions(
    pool: asyncpg.Pool,
    months_ahead: int = 3
):
    """
    Create monthly partitions for the next N months.
    Should be run monthly via cron job.
    """
    async with pool.acquire() as conn:
        current_date = datetime.utcnow()
        
        for i in range(months_ahead):
            # Calculate month boundaries
            if current_date.month == 12:
                start_date = current_date.replace(year=current_date.year + 1, month=1, day=1)
                end_date = start_date.replace(month=2, day=1)
            else:
                start_date = current_date.replace(month=current_date.month + 1, day=1)
                end_date = start_date.replace(
                    month=start_date.month + 1 if start_date.month < 12 else 1,
                    year=start_date.year + 1 if start_date.month == 12 else start_date.year,
                    day=1
                )
            
            start_str = start_date.strftime("%Y%m%d")
            end_str = end_date.strftime("%Y%m%d")
            
            # Create analytics_events partition
            partition_name = f"analytics_events_{start_str}"
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {partition_name}
                PARTITION OF analytics_events
                FOR VALUES FROM ('{start_date.isoformat()}') TO ('{end_date.isoformat()}');
            """)
            
            # Create location_logs partition
            partition_name = f"location_logs_{start_str}"
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {partition_name}
                PARTITION OF location_logs
                FOR VALUES FROM ('{start_date.isoformat()}') TO ('{end_date.isoformat()}');
            """)
            
            print(f"✅ Created partitions for {start_date.strftime('%B %Y')}")
            
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1, day=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1, day=1)


async def archive_old_partitions(
    pool: asyncpg.Pool,
    months_to_keep: int = 12
):
    """
    Archive partitions older than N months.
    Detaches and renames partitions for archival storage.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=months_to_keep * 30)
    
    async with pool.acquire() as conn:
        # Get list of analytics_events partitions
        partitions = await conn.fetch("""
            SELECT inhrelid::regclass::text AS partition_name
            FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid = child.oid
            WHERE parent.relname = 'analytics_events'
            ORDER BY partition_name;
        """)
        
        for row in partitions:
            partition_name = row["partition_name"]
            
            # Extract date from partition name (analytics_events_YYYYMMDD)
            try:
                date_str = partition_name.split("_")[-1]
                partition_date = datetime.strptime(date_str, "%Y%m%d")
                
                if partition_date < cutoff_date:
                    # Detach partition
                    archive_name = f"{partition_name}_archived"
                    await conn.execute(f"""
                        ALTER TABLE analytics_events DETACH PARTITION {partition_name};
                        ALTER TABLE {partition_name} RENAME TO {archive_name};
                    """)
                    
                    print(f"📦 Archived partition: {partition_name} -> {archive_name}")
                    
                    # Note: In production, move archived table to cold storage
                    # or export to S3/GCS and DROP TABLE
                    
            except Exception as e:
                print(f"⚠️  Error processing partition {partition_name}: {str(e)}")


async def vacuum_analyze_partitions(pool: asyncpg.Pool):
    """
    Run VACUUM ANALYZE on all partitions.
    Should be run weekly for optimal performance.
    """
    async with pool.acquire() as conn:
        # Get all partitions
        tables = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE 'analytics_events_%'
               OR tablename LIKE 'location_logs_%'
            ORDER BY tablename;
        """)
        
        for row in tables:
            table_name = row["tablename"]
            await conn.execute(f"VACUUM ANALYZE {table_name};")
            print(f"🧹 Vacuumed: {table_name}")


async def refresh_materialized_views(pool: asyncpg.Pool):
    """
    Refresh materialized views for trust scores and analytics.
    Should be run every 15 minutes via cron.
    """
    async with pool.acquire() as conn:
        views = [
            "v_business_stats",
            "v_location_hotspots",
            "v_category_trends",
            "v_trust_scores"
        ]
        
        for view in views:
            try:
                await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view};")
                print(f"🔄 Refreshed: {view}")
            except Exception as e:
                print(f"⚠️  Failed to refresh {view}: {str(e)}")


async def cleanup_stale_sessions(pool: asyncpg.Pool):
    """
    Remove stale rate limiting keys and expired sessions from Redis.
    This is handled automatically by Redis TTL, but can be used for
    additional cleanup logic.
    """
    # Redis handles TTL automatically, but we can log stats
    print("🧹 Redis TTL cleanup runs automatically")


async def run_maintenance_jobs(pool: asyncpg.Pool):
    """
    Main maintenance orchestrator.
    Call this from a cron job or scheduled task.
    """
    print("🔧 Starting AfriHub database maintenance...")
    
    try:
        # Create future partitions if needed
        await create_monthly_partitions(pool, months_ahead=3)
        
        # Vacuum and analyze
        await vacuum_analyze_partitions(pool)
        
        # Refresh materialized views
        await refresh_materialized_views(pool)
        
        # Archive old data (monthly)
        if datetime.utcnow().day <= 7:  # First week of month
            await archive_old_partitions(pool, months_to_keep=12)
        
        print("✅ Maintenance completed successfully")
        
    except Exception as e:
        print(f"❌ Maintenance failed: {str(e)}")
        raise
