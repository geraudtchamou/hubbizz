"""
AfriHub Rate Limiter Middleware
-------------------------------
Implements sliding window rate limiting with Redis primary and PostgreSQL fallback.
Protects against SMS pumping, API abuse, and brute-force attacks common in African markets.
"""

import time
import hashlib
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional, Dict, Tuple
import redis.asyncio as redis
from datetime import datetime, timedelta


class RateLimitConfig:
    """Configuration for different rate limit tiers"""
    
    # SMS/OTP limits (prevent pumping fraud)
    SMS_OTP = {"limit": 3, "window": 3600}  # 3 per hour
    SMS_DAILY = {"limit": 10, "window": 86400}  # 10 per day
    
    # Search limits (prevent scraping)
    SEARCH = {"limit": 60, "window": 60}  # 60 per minute
    
    # WhatsApp lead limits (prevent spam)
    WHATSAPP_LEAD = {"limit": 20, "window": 3600}  # 20 per hour
    
    # Authentication limits
    LOGIN_ATTEMPT = {"limit": 5, "window": 900}  # 5 per 15 min
    REGISTER_ATTEMPT = {"limit": 3, "window": 3600}  # 3 per hour
    
    # Generic API limits
    API_DEFAULT = {"limit": 100, "window": 60}  # 100 per minute


class RateLimiter:
    """Sliding window rate limiter with Redis + PostgreSQL fallback"""
    
    def __init__(self, redis_url: Optional[str] = None, db_pool=None):
        self.redis: Optional[redis.Redis] = None
        self.db_pool = db_pool
        self.redis_url = redis_url
        
    async def connect(self):
        """Initialize Redis connection"""
        if self.redis_url:
            try:
                self.redis = redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self.redis.ping()
                print("✅ Redis rate limiter connected")
            except Exception as e:
                print(f"⚠️  Redis unavailable, using PostgreSQL fallback: {e}")
                self.redis = None
    
    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
    
    def _generate_key(self, identifier: str, endpoint: str) -> str:
        """Generate unique rate limit key"""
        return f"ratelimit:{endpoint}:{identifier}"
    
    def _get_client_identifier(self, request: Request) -> str:
        """Extract client identifier (IP, phone, user_id)"""
        # Priority: User ID > Phone > IP
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        
        phone = request.headers.get("X-Phone-Number")
        if phone:
            return f"phone:{phone}"
        
        # Fallback to IP (hash for privacy)
        ip = request.client.host if request.client else "unknown"
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
        return f"ip:{ip_hash}"
    
    async def _check_redis(self, key: str, limit: int, window: int) -> Tuple[bool, int, int]:
        """Check rate limit using Redis atomic operations"""
        pipe = self.redis.pipeline()
        now = int(time.time())
        window_start = now - window
        
        # Remove old entries outside window
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests in window
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiry on key
        pipe.expire(key, window + 60)
        
        results = await pipe.execute()
        current_count = results[1]
        
        allowed = current_count < limit
        remaining = max(0, limit - current_count - 1) if allowed else 0
        reset_time = now + window
        
        return allowed, remaining, reset_time
    
    async def _check_postgres(self, key: str, limit: int, window: int) -> Tuple[bool, int, int]:
        """Fallback rate limit check using PostgreSQL"""
        if not self.db_pool:
            return True, limit, int(time.time()) + window
        
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window)
        
        async with self.db_pool.acquire() as conn:
            # Upsert rate limit record
            await conn.execute("""
                INSERT INTO rate_limits (key, count, window_start, window_end, blocked)
                VALUES ($1, 1, $2, $3, false)
                ON CONFLICT (key) 
                DO UPDATE SET 
                    count = CASE 
                        WHEN rate_limits.window_end < $2 
                        THEN 1 
                        ELSE rate_limits.count + 1 
                    END,
                    window_start = CASE 
                        WHEN rate_limits.window_end < $2 
                        THEN $2 
                        ELSE rate_limits.window_start 
                    END,
                    window_end = CASE 
                        WHEN rate_limits.window_end < $2 
                        THEN $3 
                        ELSE rate_limits.window_end 
                    END,
                    blocked = (rate_limits.count + 1 > $4)
                WHERE rate_limits.key = $1
            """, key, window_start, now, limit)
            
            # Fetch current state
            row = await conn.fetchrow(
                "SELECT count, blocked, window_end FROM rate_limits WHERE key = $1",
                key
            )
            
            if not row:
                return True, limit, int(now.timestamp()) + window
            
            count = row["count"]
            blocked = row["blocked"]
            reset_time = int(row["window_end"].timestamp()) if row["window_end"] else int(now.timestamp()) + window
            
            allowed = not blocked and count <= limit
            remaining = max(0, limit - count) if allowed else 0
            
            return allowed, remaining, reset_time
    
    async def is_allowed(
        self, 
        request: Request, 
        endpoint: str, 
        config: Dict[str, int]
    ) -> Tuple[bool, int, int]:
        """
        Check if request is allowed under rate limit
        
        Returns: (allowed, remaining_requests, reset_timestamp)
        """
        identifier = self._get_client_identifier(request)
        key = self._generate_key(identifier, endpoint)
        limit = config["limit"]
        window = config["window"]
        
        # Try Redis first (fastest)
        if self.redis:
            try:
                return await self._check_redis(key, limit, window)
            except Exception as e:
                print(f"Redis error, falling back to Postgres: {e}")
        
        # Fallback to PostgreSQL
        return await self._check_postgres(key, limit, window)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for automatic rate limiting"""
    
    def __init__(self, app, limiter: RateLimiter):
        super().__init__(app)
        self.limiter = limiter
        
        # Define endpoint-specific limits
        self.endpoint_map = {
            "/api/v1/auth/sms": RateLimitConfig.SMS_OTP,
            "/api/v1/auth/register": RateLimitConfig.REGISTER_ATTEMPT,
            "/api/v1/auth/login": RateLimitConfig.LOGIN_ATTEMPT,
            "/api/v1/search": RateLimitConfig.SEARCH,
            "/api/v1/businesses/*/whatsapp": RateLimitConfig.WHATSAPP_LEAD,
            "/api/v1/businesses/*/call": RateLimitConfig.WHATSAPP_LEAD,
        }
    
    def _match_endpoint(self, path: str) -> Optional[Dict[str, int]]:
        """Match request path to rate limit config"""
        # Exact match
        if path in self.endpoint_map:
            return self.endpoint_map[path]
        
        # Pattern match (simple wildcard)
        for pattern, config in self.endpoint_map.items():
            if "*" in pattern:
                prefix = pattern.split("*")[0]
                if path.startswith(prefix):
                    return config
        
        # Default
        return RateLimitConfig.API_DEFAULT
    
    async def dispatch(self, request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/ready"]:
            return await call_next(request)
        
        # Get rate limit config for endpoint
        config = self._match_endpoint(request.url.path)
        
        # Check rate limit
        allowed, remaining, reset_time = await self.limiter.is_allowed(
            request, 
            request.url.path, 
            config
        )
        
        # Add rate limit headers to all responses
        headers = {
            "X-RateLimit-Limit": str(config["limit"]),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_time),
        }
        
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Too many requests. Please try again later.",
                    "retry_after": reset_time - int(time.time())
                },
                headers=headers
            )
        
        # Process request
        response = await call_next(request)
        
        # Add headers to response
        for key, value in headers.items():
            response.headers[key] = value
        
        return response


# Dependency for manual rate limiting in specific endpoints
async def get_rate_limiter() -> RateLimiter:
    """Dependency injection for rate limiter"""
    # Initialized in main.py startup
    return request.app.state.rate_limiter


# Example usage in FastAPI route
"""
from fastapi import Depends, Request

@app.post("/api/v1/auth/sms")
async def send_sms(
    request: Request,
    phone: str,
    limiter: RateLimiter = Depends(get_rate_limiter)
):
    # Manual check if needed
    allowed, remaining, _ = await limiter.is_allowed(
        request, 
        "/api/v1/auth/sms", 
        RateLimitConfig.SMS_OTP
    )
    
    if not allowed:
        raise HTTPException(
            status_code=429, 
            detail=f"SMS limit exceeded. Try again in {remaining} seconds"
        )
    
    # Send SMS logic...
"""
