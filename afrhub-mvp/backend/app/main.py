"""
AfriHub Backend - FastAPI Application
Low-bandwidth optimized API for African SME platform
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
import logging

from app.api import businesses, auth, payments, maps, reviews
from app.utils.logging_config import setup_logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting AfriHub API...")
    setup_logging()
    yield
    # Shutdown
    logger.info("Shutting down AfriHub API...")

app = FastAPI(
    title="AfriHub API",
    description="Verified business directory & commerce platform for African SMEs",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure per environment in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing middleware for performance monitoring
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(businesses.router, prefix="/api/v1/businesses", tags=["Businesses"])
app.include_router(maps.router, prefix="/api/v1/maps", tags=["Maps & Geospatial"])
app.include_router(reviews.router, prefix="/api/v1/reviews", tags=["Reviews & Trust"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "message": "Welcome to AfriHub API",
        "version": "1.0.0",
        "docs": "/docs",
        "features": [
            "Verified business profiles",
            "Geospatial discovery (OpenStreetMap)",
            "Trust scoring & AI fraud detection",
            "WhatsApp commerce integration",
            "Low-bandwidth optimized"
        ]
    }
