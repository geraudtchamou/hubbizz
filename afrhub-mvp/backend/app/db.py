"""
Database configuration with PostgreSQL + PostGIS support
Optimized for African markets with connection pooling
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://user:password@localhost:5432/afrhub_db"
)

# Create engine with optimized pool settings for high concurrency
# Note: asyncpg uses its own pool, so we don't specify poolclass
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,  # Adjust based on load
    max_overflow=40,
    pool_pre_ping=True,  # Enable connection health checks
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()

# Dependency for getting database session
async def get_db():
    """Yield database session for dependency injection"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
