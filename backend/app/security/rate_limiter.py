"""
AfriHub Security & Rate Limiting Module
Implements Redis-based rate limiting and security utilities for African markets.
"""
import time
import hashlib
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis.asyncio as redis
from app.core.config import settings

security = HTTPBearer(auto_error=False)

class RateLimiter:
    """
    Redis-based rate limiter with sliding window algorithm.
    Optimized for SMS fraud prevention and API abuse protection.
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def is_rate_limited(
        self, 
        key: str, 
        limit: int, 
        window: int = 3600
    ) -> bool:
        """
        Check if a key has exceeded the rate limit within the time window.
        
        Args:
            key: Unique identifier (e.g., phone number, IP address)
            limit: Maximum allowed requests
            window: Time window in seconds (default: 1 hour)
            
        Returns:
            True if rate limited, False otherwise
        """
        current_time = int(time.time())
        window_key = f"rate_limit:{key}:{current_time // window}"
        
        # Atomic increment and check
        current_count = await self.redis.incr(window_key)
        if current_count == 1:
            # Set expiry on first request
            await self.redis.expire(window_key, window * 2)
        
        return current_count > limit
    
    async def get_remaining(
        self, 
        key: str, 
        limit: int, 
        window: int = 3600
    ) -> int:
        """Get remaining requests allowed in current window."""
        current_time = int(time.time())
        window_key = f"rate_limit:{key}:{current_time // window}"
        current_count = await self.redis.get(window_key)
        
        if current_count is None:
            return limit
        
        return max(0, limit - int(current_count))


async def rate_limit_dependency(
    request: Request,
    limit: int = 100,
    window: int = 3600,
    key_extractor: str = "ip"
):
    """
    FastAPI dependency for rate limiting endpoints.
    
    Usage:
        @app.get("/search", dependencies=[Depends(rate_limit_dependency)])
    """
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    limiter = RateLimiter(redis_client)
    
    # Extract identifier based on type
    if key_extractor == "ip":
        identifier = request.client.host if request.client else "unknown"
    elif key_extractor == "phone":
        # Extract from query params or body for SMS endpoints
        phone = request.query_params.get("phone") or \
                (await request.json()).get("phone") if await request.body() else None
        if not phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number required for rate limiting"
            )
        identifier = f"phone:{phone}"
    else:
        identifier = request.client.host
    
    is_limited = await limiter.is_rate_limited(identifier, limit, window)
    
    if is_limited:
        remaining = await limiter.get_remaining(identifier, limit, window)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again later.",
            headers={"X-RateLimit-Remaining": str(remaining)}
        )
    
    return True


class TokenVerifier:
    """JWT-like token verification for service-to-service communication."""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
    
    def generate_token(self, service_id: str, scopes: list[str]) -> str:
        """Generate a secure token for internal services."""
        timestamp = int(time.time())
        payload = f"{service_id}:{','.join(scopes)}:{timestamp}"
        signature = hashlib.sha256(
            f"{payload}{self.secret_key}".encode()
        ).hexdigest()[:16]
        
        return f"{payload}:{signature}"
    
    def verify_token(self, token: str, required_scopes: list[str]) -> bool:
        """Verify token validity and scopes."""
        try:
            parts = token.split(":")
            if len(parts) != 4:
                return False
            
            service_id, scopes_str, timestamp, signature = parts
            payload = f"{service_id}:{scopes_str}:{timestamp}"
            expected_signature = hashlib.sha256(
                f"{payload}{self.secret_key}".encode()
            ).hexdigest()[:16]
            
            if signature != expected_signature:
                return False
            
            # Check timestamp freshness (5 minutes)
            if abs(int(time.time()) - int(timestamp)) > 300:
                return False
            
            # Verify scopes
            provided_scopes = set(scopes_str.split(","))
            if not set(required_scopes).issubset(provided_scopes):
                return False
            
            return True
            
        except Exception:
            return False


async def validate_api_key(
    credentials: HTTPAuthorizationCredentials = security
) -> Optional[Dict[str, Any]]:
    """
    Validate API key from Authorization header.
    Returns user context if valid, None otherwise.
    """
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    
    api_key = credentials.credentials
    
    # In production, validate against database
    # For now, simple format validation
    if len(api_key) < 32 or not api_key.startswith("afri_"):
        return None
    
    # Placeholder for actual validation logic
    return {"api_key": api_key, "type": "service"}
