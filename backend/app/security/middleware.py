"""
AfriHub API Middleware
Implements security headers, request logging, and performance monitoring.
"""
import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses for protection against common attacks.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy (adjust for your needs)
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.afrihub.io; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' https://api.afrihub.io wss://*.afrihub.io; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp_policy
        
        # HSTS (only in production)
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Log request/response metrics for performance monitoring.
    Tracks latency, status codes, and slow queries.
    """
    
    SLOW_REQUEST_THRESHOLD = 2.0  # seconds
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Extract client info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log metrics
        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "client_ip": client_ip,
            "user_agent": user_agent[:100]  # Truncate long user agents
        }
        
        # Log slow requests as warnings
        if duration > self.SLOW_REQUEST_THRESHOLD:
            logger.warning(f"⚠️  Slow request: {log_data}")
        else:
            logger.info(f"✅ Request: {log_data}")
        
        # Add timing header for debugging
        response.headers["X-Response-Time-Ms"] = str(round(duration * 1000, 2))
        
        return response


class RateLimitLoggingMiddleware(BaseHTTPMiddleware):
    """
    Log rate limit hits for fraud detection and analytics.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if this is a rate-limited endpoint
        path = request.url.path
        
        # High-risk endpoints that need extra monitoring
        high_risk_paths = [
            "/api/v1/auth/sms",
            "/api/v1/auth/otp",
            "/api/v1/businesses/search",
            "/api/v1/leads"
        ]
        
        if any(path.startswith(p) for p in high_risk_paths):
            client_ip = request.client.host if request.client else "unknown"
            logger.debug(f"🔍 High-risk endpoint accessed: {path} from {client_ip}")
        
        return await call_next(request)


class CORSConfigMiddleware(BaseHTTPMiddleware):
    """
    Configure CORS for African market domains and mobile apps.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
            self._set_cors_headers(response, request)
            return response
        
        # Process normal request
        response = await call_next(request)
        self._set_cors_headers(response, request)
        
        return response
    
    def _set_cors_headers(self, response: Response, request: Request):
        # Allow specific domains in production
        allowed_origins = [
            "https://afrihub.io",
            "https://www.afrihub.io",
            "https://app.afrihub.io",
        ]
        
        # Add staging/dev origins
        if settings.ENVIRONMENT != "production":
            allowed_origins.extend([
                "http://localhost:3000",
                "http://localhost:8000",
                "http://127.0.0.1:3000",
            ])
        
        origin = request.headers.get("origin", "")
        
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "86400"  # 24 hours
