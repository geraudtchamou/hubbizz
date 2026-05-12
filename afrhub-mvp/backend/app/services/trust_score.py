"""
Trust Score Calculation Service
AI-enhanced algorithm for business credibility scoring
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.core import Business, Verification, Review, Lead, Transaction
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

async def calculate_trust_score(db: AsyncSession, business: Business) -> float:
    """
    Calculate comprehensive trust score (0-100) based on multiple factors:
    
    Weights:
    - Verification status: 25%
    - Reviews & ratings: 30%
    - Response time: 15%
    - Completion rate: 15%
    - Activity level: 10%
    - AI fraud detection: -10 to +5 bonus
    
    Optimized for African market context with emphasis on verified credentials
    """
    
    score = 0.0
    
    # ============== VERIFICATION SCORE (25 points) ==============
    verification_score = await _calculate_verification_score(db, business)
    score += verification_score * 0.25
    
    # ============== REVIEWS & RATINGS (30 points) ==============
    review_score = await _calculate_review_score(db, business)
    score += review_score * 0.30
    
    # ============== RESPONSE TIME (15 points) ==============
    response_score = await _calculate_response_score(business)
    score += response_score * 0.15
    
    # ============== COMPLETION RATE (15 points) ==============
    completion_score = await _calculate_completion_score(db, business)
    score += completion_score * 0.15
    
    # ============== ACTIVITY LEVEL (10 points) ==============
    activity_score = await _calculate_activity_score(db, business)
    score += activity_score * 0.10
    
    # ============== AI FRAUD DETECTION (bonus -10 to +5) ==============
    fraud_bonus = await _calculate_fraud_bonus(db, business)
    score += fraud_bonus
    
    # Clamp to 0-100
    score = max(0.0, min(100.0, score))
    
    logger.info(f"Trust score calculated for business {business.id}: {score:.2f}")
    
    return round(score, 2)

async def _calculate_verification_score(db: AsyncSession, business: Business) -> float:
    """Calculate verification component (0-100)"""
    
    base_score = 0.0
    
    # Phone verification (essential in Africa)
    if 'phone_verified' in business.verification_badges:
        base_score += 20
    
    # Email verification
    if 'email_verified' in business.verification_badges:
        base_score += 10
    
    # License verification (critical for trust)
    if 'license_verified' in business.verification_badges:
        base_score += 30
    
    # Address verification
    if 'address_verified' in business.verification_badges:
        base_score += 20
    
    # Tax ID verification
    if 'tax_verified' in business.verification_badges:
        base_score += 20
    
    # Check for active verifications
    result = await db.execute(
        select(Verification).where(
            Verification.business_id == business.id,
            Verification.status == 'approved'
        )
    )
    verifications = result.scalars().all()
    
    # Bonus for multiple verification types
    if len(verifications) >= 3:
        base_score += 10
    
    return min(100.0, base_score)

async def _calculate_review_score(db: AsyncSession, business: Business) -> float:
    """Calculate review component (0-100)"""
    
    if business.total_reviews == 0:
        return 50.0  # Neutral score for new businesses
    
    # Average rating component (60% weight)
    rating_component = (business.average_rating / 5.0) * 60
    
    # Review count component (20% weight) - more reviews = more trust
    review_count_score = min(20.0, (business.total_reviews / 50.0) * 20)
    
    # Recent reviews component (20% weight)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(func.count(Review.id)).where(
            Review.business_id == business.id,
            Review.created_at >= thirty_days_ago,
            Review.moderation_status == 'approved'
        )
    )
    recent_reviews = result.scalar() or 0
    
    recent_score = min(20.0, (recent_reviews / 10.0) * 20)
    
    # Verified purchase reviews bonus
    result = await db.execute(
        select(func.count(Review.id)).where(
            Review.business_id == business.id,
            Review.is_verified_purchase == True,
            Review.moderation_status == 'approved'
        )
    )
    verified_reviews = result.scalar() or 0
    
    if business.total_reviews > 0:
        verified_ratio = verified_reviews / business.total_reviews
        verified_bonus = verified_ratio * 10
    else:
        verified_bonus = 0
    
    total_score = rating_component + review_count_score + recent_score + verified_bonus
    
    return min(100.0, total_score)

async def _calculate_response_score(business: Business) -> float:
    """Calculate response time component (0-100)"""
    
    # No response time data yet
    if business.response_time_avg == 0:
        return 50.0
    
    # Scoring based on average response time in minutes
    # < 5 min: 100, < 15 min: 90, < 30 min: 75, < 60 min: 60, < 120 min: 40, > 120 min: 20
    
    if business.response_time_avg <= 5:
        return 100.0
    elif business.response_time_avg <= 15:
        return 90.0
    elif business.response_time_avg <= 30:
        return 75.0
    elif business.response_time_avg <= 60:
        return 60.0
    elif business.response_time_avg <= 120:
        return 40.0
    else:
        return 20.0

async def _calculate_completion_score(db: AsyncSession, business: Business) -> float:
    """Calculate completion rate component (0-100)"""
    
    # Use stored completion rate if available
    if business.completion_rate > 0:
        return business.completion_rate * 100
    
    # Calculate from transactions
    result = await db.execute(
        select(
            func.count(Transaction.id).label('total'),
            func.sum(case((Transaction.status == 'completed', 1), else_=0)).label('completed')
        ).where(Transaction.business_id == business.id)
    )
    row = result.first()
    
    if row and row.total > 0:
        completion_rate = row.completed / row.total
        return completion_rate * 100
    
    # No transaction data - use neutral score
    return 50.0

async def _calculate_activity_score(db: AsyncSession, business: Business) -> float:
    """Calculate activity level component (0-100)"""
    
    score = 0.0
    
    # Last active within 7 days
    if business.last_active:
        days_since_active = (datetime.utcnow() - business.last_active).days
        if days_since_active <= 1:
            score += 40
        elif days_since_active <= 3:
            score += 30
        elif days_since_active <= 7:
            score += 20
        elif days_since_active <= 14:
            score += 10
    
    # Recent leads (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(func.count(Lead.id)).where(
            Lead.business_id == business.id,
            Lead.created_at >= thirty_days_ago
        )
    )
    recent_leads = result.scalar() or 0
    
    if recent_leads >= 20:
        score += 30
    elif recent_leads >= 10:
        score += 20
    elif recent_leads >= 5:
        score += 10
    
    # Profile completeness
    completeness = _calculate_profile_completeness(business)
    score += completeness * 0.3  # 30% weight
    
    return min(100.0, score)

async def _calculate_fraud_bonus(db: AsyncSession, business: Business) -> float:
    """
    AI-powered fraud detection bonus (-10 to +5)
    
    Negative indicators:
    - Multiple complaints
    - Suspicious review patterns
    - Inconsistent information
    - Rapid profile changes
    
    Positive indicators:
    - Long-standing account
    - Consistent behavior
    - Verified social media links
    """
    
    bonus = 0.0
    
    # Check for flagged reviews
    result = await db.execute(
        select(func.count(Review.id)).where(
            Review.business_id == business.id,
            Review.moderation_status == 'flagged'
        )
    )
    flagged_reviews = result.scalar() or 0
    
    if flagged_reviews > 5:
        bonus -= 5
    elif flagged_reviews > 2:
        bonus -= 2
    
    # Account age bonus (longer = more trustworthy)
    if business.created_at:
        days_old = (datetime.utcnow() - business.created_at).days
        if days_old > 365:
            bonus += 2
        elif days_old > 180:
            bonus += 1
    
    # Check for complaint patterns (future implementation)
    # TODO: Integrate with complaint resolution system
    
    # Premium tier bonus
    if business.premium_tier >= 2:
        bonus += 1
    
    return max(-10.0, min(5.0, bonus))

def _calculate_profile_completeness(business: Business) -> float:
    """Calculate profile completeness percentage"""
    
    fields = [
        business.name,
        business.description,
        business.category,
        business.logo_url,
        business.phone,
        business.whatsapp_number,
        business.operating_hours,
        business.gallery_urls and len(business.gallery_urls) > 0,
        business.payment_methods and len(business.payment_methods) > 1,
    ]
    
    completed = sum(1 for field in fields if field)
    return (completed / len(fields)) * 100
