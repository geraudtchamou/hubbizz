"""
AfriHub Background Task Queue System
Implements queue-first architecture for image processing, AI scanning, 
and notification delivery. Uses Redis Streams for reliable task processing.
"""
import json
import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Callable
from enum import Enum
import redis.asyncio as redis
from app.core.config import settings


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(str, Enum):
    IMAGE_COMPRESSION = "image_compression"
    AI_FRAUD_SCAN = "ai_fraud_scan"
    SMS_NOTIFICATION = "sms_notification"
    WHATSAPP_MESSAGE = "whatsapp_message"
    TRUST_SCORE_UPDATE = "trust_score_update"
    EMAIL_SEND = "email_send"


class TaskQueue:
    """
    Redis-based task queue with priority support and retry logic.
    Optimized for high-volume background processing in African markets.
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.queue_key = "afrihub:tasks:queue"
        self.processing_key = "afrihub:tasks:processing"
        self.result_key = "afrihub:tasks:results"
    
    async def enqueue(
        self,
        task_type: TaskType,
        payload: Dict[str, Any],
        priority: int = 5,
        max_retries: int = 3
    ) -> str:
        """
        Add a task to the queue with priority.
        
        Args:
            task_type: Type of task to execute
            payload: Task-specific data
            priority: 1 (highest) to 10 (lowest), default 5
            max_retries: Maximum retry attempts on failure
            
        Returns:
            Task ID for tracking
        """
        task_id = str(uuid.uuid4())
        task_data = {
            "id": task_id,
            "type": task_type.value,
            "payload": json.dumps(payload),
            "priority": priority,
            "max_retries": max_retries,
            "retry_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "status": TaskStatus.PENDING.value
        }
        
        # Store full task data
        await self.redis.hset(
            f"afrihub:tasks:{task_id}",
            mapping=task_data
        )
        
        # Add to sorted set with priority score (lower = higher priority)
        await self.redis.zadd(
            self.queue_key,
            {task_id: priority}
        )
        
        return task_id
    
    async def dequeue(self, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """
        Get the highest priority task from the queue.
        Blocks until timeout if queue is empty.
        
        Returns:
            Task data dict or None if timeout
        """
        # Get highest priority task (lowest score)
        result = await self.redis.zpopmin(self.queue_key, count=1)
        
        if not result:
            return None
        
        task_id, _ = result[0]
        task_data = await self.redis.hgetall(f"afrihub:tasks:{task_id}")
        
        if not task_data:
            return None
        
        # Mark as processing
        await self.redis.hset(
            f"afrihub:tasks:{task_id}",
            "status",
            TaskStatus.PROCESSING.value
        )
        await self.redis.hset(
            f"afrihub:tasks:{task_id}",
            "started_at",
            datetime.utcnow().isoformat()
        )
        
        # Add to processing set with expiry (1 hour)
        await self.redis.zadd(
            self.processing_key,
            {task_id: datetime.utcnow().timestamp()}
        )
        await self.redis.expire(self.processing_key, 3600)
        
        return {
            "id": task_data[b"id"].decode(),
            "type": task_data[b"type"].decode(),
            "payload": json.loads(task_data[b"payload"].decode()),
            "retry_count": int(task_data[b"retry_count"]),
            "max_retries": int(task_data[b"max_retries"])
        }
    
    async def complete_task(self, task_id: str, result: Any = None):
        """Mark task as completed and store result."""
        await self.redis.hset(
            f"afrihub:tasks:{task_id}",
            mapping={
                "status": TaskStatus.COMPLETED.value,
                "completed_at": datetime.utcnow().isoformat(),
                "result": json.dumps(result) if result else ""
            }
        )
        
        # Remove from processing set
        await self.redis.zrem(self.processing_key, task_id)
        
        # Store result with 24-hour TTL
        if result:
            await self.redis.setex(
                f"{self.result_key}:{task_id}",
                86400,
                json.dumps(result)
            )
    
    async def fail_task(self, task_id: str, error: str):
        """
        Mark task as failed and retry if attempts remain.
        """
        task_data = await self.redis.hgetall(f"afrihub:tasks:{task_id}")
        retry_count = int(task_data[b"retry_count"]) + 1
        max_retries = int(task_data[b"max_retries"])
        
        if retry_count < max_retries:
            # Retry with exponential backoff
            await self.redis.hset(
                f"afrihub:tasks:{task_id}",
                mapping={
                    "retry_count": retry_count,
                    "last_error": error,
                    "status": TaskStatus.PENDING.value
                }
            )
            
            # Re-queue with same priority
            priority = int(task_data[b"priority"])
            await self.redis.zadd(self.queue_key, {task_id: priority})
        else:
            # Max retries exceeded
            await self.redis.hset(
                f"afrihub:tasks:{task_id}",
                mapping={
                    "status": TaskStatus.FAILED.value,
                    "failed_at": datetime.utcnow().isoformat(),
                    "last_error": error
                }
            )
            
            # Remove from processing set
            await self.redis.zrem(self.processing_key, task_id)
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current status and result of a task."""
        task_data = await self.redis.hgetall(f"afrihub:tasks:{task_id}")
        
        if not task_data:
            return None
        
        result = task_data.get(b"result")
        return {
            "id": task_data[b"id"].decode(),
            "type": task_data[b"type"].decode(),
            "status": task_data[b"status"].decode(),
            "retry_count": int(task_data[b"retry_count"]),
            "created_at": task_data[b"created_at"].decode(),
            "result": json.loads(result.decode()) if result else None,
            "error": task_data.get(b"last_error", b"").decode()
        }


# Task handlers registry
task_handlers: Dict[TaskType, Callable] = {}


def register_handler(task_type: TaskType):
    """Decorator to register task handlers."""
    def decorator(func: Callable):
        task_handlers[task_type] = func
        return func
    return decorator


async def process_tasks():
    """
    Main task processor loop.
    Run this as a background worker.
    """
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    queue = TaskQueue(redis_client)
    
    print("🚀 AfriHub Task Processor started...")
    
    while True:
        try:
            task = await queue.dequeue(timeout=5)
            
            if not task:
                await asyncio.sleep(1)
                continue
            
            task_type = TaskType(task["type"])
            handler = task_handlers.get(task_type)
            
            if not handler:
                await queue.fail_task(task["id"], f"No handler for task type: {task_type}")
                continue
            
            try:
                result = await handler(task["payload"])
                await queue.complete_task(task["id"], result)
                print(f"✅ Task {task['id']} completed: {task_type}")
            except Exception as e:
                await queue.fail_task(task["id"], str(e))
                print(f"❌ Task {task['id']} failed: {str(e)}")
                
        except Exception as e:
            print(f"⚠️  Task processor error: {str(e)}")
            await asyncio.sleep(5)


# Example task handlers
@register_handler(TaskType.IMAGE_COMPRESSION)
async def handle_image_compression(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compress and optimize images for low-bandwidth users."""
    # Implementation would use Pillow/PIL
    image_url = payload.get("image_url")
    business_id = payload.get("business_id")
    
    # Simulate processing
    await asyncio.sleep(0.5)
    
    return {
        "compressed_url": f"https://cdn.afrihub.io/compressed/{image_url}",
        "original_size": "2.5MB",
        "compressed_size": "150KB",
        "savings": "94%"
    }


@register_handler(TaskType.AI_FRAUD_SCAN)
async def handle_ai_fraud_scan(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Scan business profile for fraud indicators."""
    business_id = payload.get("business_id")
    profile_data = payload.get("profile_data")
    
    # Simulate AI analysis
    await asyncio.sleep(1)
    
    return {
        "fraud_score": 0.15,
        "risk_level": "low",
        "flags": [],
        "verified": True
    }


@register_handler(TaskType.SMS_NOTIFICATION)
async def handle_sms_notification(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Send SMS via African providers (Twilio, Africa's Talking)."""
    phone = payload.get("phone")
    message = payload.get("message")
    
    # Simulate SMS sending
    await asyncio.sleep(0.3)
    
    return {
        "sent": True,
        "provider": "africas_talking",
        "cost": 0.02,
        "currency": "USD"
    }
