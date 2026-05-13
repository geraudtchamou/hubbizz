"""
AfrHub POS - Loyalty Service
Handles points earning, redemption, tier upgrades, and loyalty program management.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any


class TransactionType(Enum):
    EARN = "earn"
    REDEEM = "redeem"
    ADJUSTMENT = "adjustment"
    EXPIRE = "expire"


@dataclass
class LoyaltyTier:
    id: str
    name: str  # Bronze, Silver, Gold, Platinum
    min_points: int
    min_lifetime_spend: Decimal
    benefits: Dict[str, Any]  # {discount_percent: 5, bonus_points_multiplier: 1.5}


@dataclass
class LoyaltyTransaction:
    id: str
    client_id: str
    program_id: str
    transaction_type: TransactionType
    points: int
    balance_after: int
    reference_type: Optional[str]  # 'sale', 'manual', 'promotion'
    reference_id: Optional[str]
    description: str
    expires_at: Optional[datetime]
    created_at: datetime


class LoyaltyService:
    """
    Service for managing customer loyalty programs.
    
    Features:
    - Points earning based on purchases
    - Points redemption for discounts/rewards
    - Tier upgrades based on points or lifetime spend
    - Points expiry handling
    - Bonus promotions and multipliers
    """
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def earn_points(
        self,
        client_id: str,
        program_id: str,
        sale_amount: Decimal,
        sale_id: Optional[str] = None,
        store_id: Optional[str] = None
    ) -> LoyaltyTransaction:
        """
        Calculate and award points for a purchase.
        
        Args:
            client_id: Customer ID
            program_id: Loyalty program ID
            sale_amount: Total sale amount in store currency
            sale_id: Reference to the sale transaction
            store_id: Store ID (for context)
        
        Returns:
            LoyaltyTransaction record
        """
        # Fetch loyalty program details
        program = await self._get_program(program_id)
        if not program or not program.is_active:
            raise ValueError("Invalid or inactive loyalty program")
        
        # Fetch client's current status
        client = await self._get_client(client_id)
        if not client:
            raise ValueError("Client not found")
        
        # Calculate base points
        currency_unit = program.currency_unit or Decimal('100')
        points_per_unit = program.points_per_currency_unit or Decimal('1')
        
        base_points = int((sale_amount / currency_unit) * points_per_unit)
        
        # Apply tier multiplier if client has a tier
        multiplier = Decimal('1.0')
        if client.loyalty_tier_id:
            tier = await self._get_tier(client.loyalty_tier_id)
            if tier and tier.benefits:
                multiplier = Decimal(str(tier.benefits.get('bonus_points_multiplier', 1.0)))
        
        # Calculate final points
        earned_points = int(Decimal(str(base_points)) * multiplier)
        
        # Check for active promotions with bonus points
        promo_bonus = await self._get_promotion_bonus(program_id, store_id)
        earned_points += promo_bonus
        
        # Calculate new balance
        current_balance = client.total_points or 0
        new_balance = current_balance + earned_points
        
        # Calculate expiry date
        expires_at = None
        if program.points_expiry_days and program.points_expiry_days > 0:
            expires_at = datetime.now() + timedelta(days=program.points_expiry_days)
        
        # Create transaction record
        transaction = LoyaltyTransaction(
            id=self._generate_id(),
            client_id=client_id,
            program_id=program_id,
            transaction_type=TransactionType.EARN,
            points=earned_points,
            balance_after=new_balance,
            reference_type='sale',
            reference_id=sale_id,
            description=f"Earned {earned_points} points from purchase of {sale_amount}",
            expires_at=expires_at,
            created_at=datetime.now()
        )
        
        # Save transaction
        await self._save_transaction(transaction)
        
        # Update client's total points
        await self._update_client_points(client_id, new_balance)
        
        # Check for tier upgrade
        await self.check_and_upgrade_tier(client_id, program_id)
        
        return transaction
    
    async def redeem_points(
        self,
        client_id: str,
        program_id: str,
        points_to_redeem: int,
        redemption_type: str,  # 'discount', 'free_item', 'voucher'
        value_amount: Decimal,
        sale_id: Optional[str] = None,
        store_id: Optional[str] = None
    ) -> LoyaltyTransaction:
        """
        Redeem points for rewards or discounts.
        
        Args:
            client_id: Customer ID
            program_id: Loyalty program ID
            points_to_redeem: Number of points to redeem
            redemption_type: Type of redemption
            value_amount: Monetary value of the redemption
            sale_id: Reference to sale if applied to a transaction
            store_id: Store ID
        
        Returns:
            LoyaltyTransaction record
        """
        # Fetch client
        client = await self._get_client(client_id)
        if not client:
            raise ValueError("Client not found")
        
        # Validate sufficient points
        current_balance = client.total_points or 0
        if points_to_redeem > current_balance:
            raise ValueError(f"Insufficient points. Available: {current_balance}, Requested: {points_to_redeem}")
        
        # Calculate new balance (negative for redemption)
        new_balance = current_balance - points_to_redeem
        
        # Create transaction record
        transaction = LoyaltyTransaction(
            id=self._generate_id(),
            client_id=client_id,
            program_id=program_id,
            transaction_type=TransactionType.REDEEM,
            points=-points_to_redeem,  # Negative for redemption
            balance_after=new_balance,
            reference_type='sale' if sale_id else 'manual',
            reference_id=sale_id,
            description=f"Redeemed {points_to_redeem} points for {redemption_type} worth {value_amount}",
            expires_at=None,
            created_at=datetime.now()
        )
        
        # Save transaction
        await self._save_transaction(transaction)
        
        # Create redemption record
        await self._create_redemption(
            client_id=client_id,
            store_id=store_id,
            redemption_type=redemption_type,
            points_used=points_to_redeem,
            value_amount=value_amount,
            applied_to_sale_id=sale_id
        )
        
        # Update client's total points
        await self._update_client_points(client_id, new_balance)
        
        return transaction
    
    async def check_and_upgrade_tier(
        self,
        client_id: str,
        program_id: str
    ) -> Optional[LoyaltyTier]:
        """
        Check if client qualifies for a tier upgrade and apply it.
        
        Args:
            client_id: Customer ID
            program_id: Loyalty program ID
        
        Returns:
            New tier if upgraded, None otherwise
        """
        client = await self._get_client(client_id)
        if not client:
            return None
        
        # Get all tiers for this program
        tiers = await self._get_all_tiers(program_id)
        if not tiers:
            return None
        
        # Sort tiers by requirements (ascending)
        tiers.sort(key=lambda t: (t.min_points, t.min_lifetime_spend))
        
        # Find highest qualifying tier
        current_tier_id = client.loyalty_tier_id
        new_tier = None
        
        for tier in tiers:
            # Check if client qualifies for this tier
            qualifies_by_points = (client.total_points or 0) >= tier.min_points
            qualifies_by_spend = (client.total_spent or Decimal('0')) >= tier.min_lifetime_spend
            
            if qualifies_by_points or qualifies_by_spend:
                # This tier is qualified, but check if it's better than current
                if not current_tier_id:
                    new_tier = tier
                else:
                    current_tier = await self._get_tier(current_tier_id)
                    # Compare tier levels (assuming sorted order)
                    if tiers.index(tier) > tiers.index(current_tier):
                        new_tier = tier
        
        # Apply upgrade if found
        if new_tier:
            await self._update_client_tier(client_id, new_tier.id)
            
            # Log tier upgrade event
            await self._log_tier_upgrade(client_id, current_tier_id, new_tier.id)
            
            return new_tier
        
        return None
    
    async def get_available_rewards(
        self,
        client_id: str,
        program_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get list of rewards the client can currently redeem.
        
        Args:
            client_id: Customer ID
            program_id: Loyalty program ID
        
        Returns:
            List of available rewards with details
        """
        client = await self._get_client(client_id)
        if not client:
            return []
        
        current_points = client.total_points or 0
        
        # Define standard reward tiers (could be customized per program)
        reward_tiers = [
            {
                "name": "Small Discount",
                "points_required": 100,
                "value": Decimal('5.00'),
                "description": "Get 5 off your next purchase",
                "redemption_type": "discount"
            },
            {
                "name": "Medium Discount",
                "points_required": 500,
                "value": Decimal('25.00'),
                "description": "Get 25 off your next purchase",
                "redemption_type": "discount"
            },
            {
                "name": "Large Discount",
                "points_required": 1000,
                "value": Decimal('50.00'),
                "description": "Get 50 off your next purchase",
                "redemption_type": "discount"
            },
            {
                "name": "Free Item Voucher",
                "points_required": 2000,
                "value": Decimal('100.00'),
                "description": "Free item up to 100 value",
                "redemption_type": "free_item"
            }
        ]
        
        # Filter rewards client can afford
        available = [
            reward for reward in reward_tiers
            if current_points >= reward["points_required"]
        ]
        
        return available
    
    async def expire_old_points(self, program_id: str) -> int:
        """
        Background job to expire points past their expiry date.
        
        Args:
            program_id: Loyalty program ID
        
        Returns:
            Number of clients affected
        """
        program = await self._get_program(program_id)
        if not program:
            return 0
        
        # Find expired transactions
        expired_transactions = await self._get_expired_transactions(program_id)
        
        clients_affected = set()
        
        for transaction in expired_transactions:
            if transaction.transaction_type != TransactionType.EXPIRE:
                # Mark as expired
                client = await self._get_client(transaction.client_id)
                if client:
                    new_balance = client.total_points + transaction.points  # points is negative
                    await self._update_client_points(transaction.client_id, new_balance)
                    
                    # Create expiry transaction record
                    expiry_transaction = LoyaltyTransaction(
                        id=self._generate_id(),
                        client_id=transaction.client_id,
                        program_id=program_id,
                        transaction_type=TransactionType.EXPIRE,
                        points=transaction.points,  # Negative
                        balance_after=new_balance,
                        reference_type='expiry',
                        reference_id=transaction.id,
                        description=f"Expired {abs(transaction.points)} points",
                        expires_at=None,
                        created_at=datetime.now()
                    )
                    await self._save_transaction(expiry_transaction)
                    
                    clients_affected.add(transaction.client_id)
        
        return len(clients_affected)
    
    async def get_client_loyalty_summary(
        self,
        client_id: str,
        program_id: str
    ) -> Dict[str, Any]:
        """
        Get comprehensive loyalty summary for a client.
        
        Args:
            client_id: Customer ID
            program_id: Loyalty program ID
        
        Returns:
            Summary dictionary with points, tier, history, etc.
        """
        client = await self._get_client(client_id)
        if not client:
            return {}
        
        tier = None
        if client.loyalty_tier_id:
            tier = await self._get_tier(client.loyalty_tier_id)
        
        # Get recent transactions
        recent_transactions = await self._get_client_transactions(
            client_id, 
            program_id, 
            limit=10
        )
        
        # Calculate points to next tier
        points_to_next_tier = None
        if tier:
            all_tiers = await self._get_all_tiers(program_id)
            current_index = all_tiers.index(tier) if tier in all_tiers else -1
            if current_index < len(all_tiers) - 1:
                next_tier = all_tiers[current_index + 1]
                points_to_next_tier = max(
                    0,
                    next_tier.min_points - (client.total_points or 0)
                )
        
        return {
            "client_id": client_id,
            "current_points": client.total_points or 0,
            "lifetime_points_earned": await self._get_lifetime_points_earned(client_id, program_id),
            "lifetime_points_redeemed": await self._get_lifetime_points_redeemed(client_id, program_id),
            "tier": {
                "id": tier.id if tier else None,
                "name": tier.name if tier else "None",
                "benefits": tier.benefits if tier else {}
            } if tier else None,
            "points_to_next_tier": points_to_next_tier,
            "recent_transactions": [
                {
                    "id": t.id,
                    "type": t.transaction_type.value,
                    "points": t.points,
                    "balance_after": t.balance_after,
                    "description": t.description,
                    "created_at": t.created_at.isoformat()
                }
                for t in recent_transactions
            ],
            "available_rewards": await self.get_available_rewards(client_id, program_id)
        }
    
    # =========================================================================
    # Private Helper Methods
    # =========================================================================
    
    async def _get_program(self, program_id: str) -> Optional[Any]:
        """Fetch loyalty program from database."""
        query = "SELECT * FROM loyalty_programs WHERE id = $1"
        return await self.db.fetchrow(query, program_id)
    
    async def _get_client(self, client_id: str) -> Optional[Any]:
        """Fetch client from database."""
        query = "SELECT * FROM clients WHERE id = $1"
        return await self.db.fetchrow(query, client_id)
    
    async def _get_tier(self, tier_id: str) -> Optional[LoyaltyTier]:
        """Fetch loyalty tier from database."""
        query = "SELECT * FROM loyalty_tiers WHERE id = $1"
        row = await self.db.fetchrow(query, tier_id)
        if not row:
            return None
        
        return LoyaltyTier(
            id=row['id'],
            name=row['name'],
            min_points=row['min_points'],
            min_lifetime_spend=row['min_lifetime_spend'],
            benefits=row['benefits'] or {}
        )
    
    async def _get_all_tiers(self, program_id: str) -> List[LoyaltyTier]:
        """Fetch all tiers for a program."""
        query = "SELECT * FROM loyalty_tiers WHERE program_id = $1 ORDER BY min_points, min_lifetime_spend"
        rows = await self.db.fetch(query, program_id)
        
        return [
            LoyaltyTier(
                id=row['id'],
                name=row['name'],
                min_points=row['min_points'],
                min_lifetime_spend=row['min_lifetime_spend'],
                benefits=row['benefits'] or {}
            )
            for row in rows
        ]
    
    async def _get_promotion_bonus(
        self, 
        program_id: str, 
        store_id: Optional[str]
    ) -> int:
        """Check for active promotions that give bonus points."""
        # Implementation would query active promotions
        # and calculate bonus points based on rules
        return 0
    
    async def _save_transaction(self, transaction: LoyaltyTransaction) -> None:
        """Save loyalty transaction to database."""
        query = """
            INSERT INTO loyalty_transactions 
            (id, client_id, program_id, transaction_type, points, balance_after,
             reference_type, reference_id, description, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """
        await self.db.execute(
            query,
            transaction.id,
            transaction.client_id,
            transaction.program_id,
            transaction.transaction_type.value,
            transaction.points,
            transaction.balance_after,
            transaction.reference_type,
            transaction.reference_id,
            transaction.description,
            transaction.expires_at,
            transaction.created_at
        )
    
    async def _update_client_points(self, client_id: str, new_balance: int) -> None:
        """Update client's total points."""
        query = "UPDATE clients SET total_points = $1 WHERE id = $2"
        await self.db.execute(query, new_balance, client_id)
    
    async def _update_client_tier(self, client_id: str, tier_id: str) -> None:
        """Update client's loyalty tier."""
        query = "UPDATE clients SET loyalty_tier_id = $1 WHERE id = $2"
        await self.db.execute(query, tier_id, client_id)
    
    async def _create_redemption(
        self,
        client_id: str,
        store_id: str,
        redemption_type: str,
        points_used: int,
        value_amount: Decimal,
        applied_to_sale_id: Optional[str]
    ) -> None:
        """Create loyalty redemption record."""
        query = """
            INSERT INTO loyalty_redemptions
            (id, client_id, store_id, redemption_type, points_used, 
             value_amount, applied_to_sale_id, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
        """
        await self.db.execute(
            query,
            self._generate_id(),
            client_id,
            store_id,
            redemption_type,
            points_used,
            value_amount,
            applied_to_sale_id
        )
    
    async def _log_tier_upgrade(
        self, 
        client_id: str, 
        old_tier_id: Optional[str], 
        new_tier_id: str
    ) -> None:
        """Log tier upgrade event."""
        # Could insert into audit_logs or a dedicated loyalty_events table
        pass
    
    async def _get_expired_transactions(self, program_id: str) -> List[LoyaltyTransaction]:
        """Get transactions with expired points that haven't been processed."""
        query = """
            SELECT * FROM loyalty_transactions
            WHERE program_id = $1 
              AND expires_at IS NOT NULL
              AND expires_at < NOW()
              AND transaction_type != 'expire'
            ORDER BY expires_at
        """
        rows = await self.db.fetch(query, program_id)
        
        return [
            LoyaltyTransaction(
                id=row['id'],
                client_id=row['client_id'],
                program_id=row['program_id'],
                transaction_type=TransactionType(row['transaction_type']),
                points=row['points'],
                balance_after=row['balance_after'],
                reference_type=row['reference_type'],
                reference_id=row['reference_id'],
                description=row['description'],
                expires_at=row['expires_at'],
                created_at=row['created_at']
            )
            for row in rows
        ]
    
    async def _get_client_transactions(
        self, 
        client_id: str, 
        program_id: str, 
        limit: int = 10
    ) -> List[LoyaltyTransaction]:
        """Get recent loyalty transactions for a client."""
        query = """
            SELECT * FROM loyalty_transactions
            WHERE client_id = $1 AND program_id = $2
            ORDER BY created_at DESC
            LIMIT $3
        """
        rows = await self.db.fetch(query, client_id, program_id, limit)
        
        return [
            LoyaltyTransaction(
                id=row['id'],
                client_id=row['client_id'],
                program_id=row['program_id'],
                transaction_type=TransactionType(row['transaction_type']),
                points=row['points'],
                balance_after=row['balance_after'],
                reference_type=row['reference_type'],
                reference_id=row['reference_id'],
                description=row['description'],
                expires_at=row['expires_at'],
                created_at=row['created_at']
            )
            for row in rows
        ]
    
    async def _get_lifetime_points_earned(
        self, 
        client_id: str, 
        program_id: str
    ) -> int:
        """Get total points earned by client (all time)."""
        query = """
            SELECT COALESCE(SUM(points), 0) as total
            FROM loyalty_transactions
            WHERE client_id = $1 AND program_id = $2 AND points > 0
        """
        result = await self.db.fetchrow(query, client_id, program_id)
        return result['total'] if result else 0
    
    async def _get_lifetime_points_redeemed(
        self, 
        client_id: str, 
        program_id: str
    ) -> int:
        """Get total points redeemed by client (all time)."""
        query = """
            SELECT COALESCE(ABS(SUM(points)), 0) as total
            FROM loyalty_transactions
            WHERE client_id = $1 AND program_id = $2 AND points < 0
        """
        result = await self.db.fetchrow(query, client_id, program_id)
        return result['total'] if result else 0
    
    def _generate_id(self) -> str:
        """Generate unique ID for new records."""
        import uuid
        return str(uuid.uuid4())


# Example usage
if __name__ == "__main__":
    # This would be initialized with actual DB connection in production
    # loyalty_service = LoyaltyService(db_connection)
    
    # Example: Award points for a sale
    # transaction = await loyalty_service.earn_points(
    #     client_id="client-123",
    #     program_id="program-456",
    #     sale_amount=Decimal("5000.00"),
    #     sale_id="sale-789"
    # )
    # print(f"Awarded {transaction.points} points")
    
    # Example: Redeem points
    # redemption = await loyalty_service.redeem_points(
    #     client_id="client-123",
    #     program_id="program-456",
    #     points_to_redeem=500,
    #     redemption_type="discount",
    #     value_amount=Decimal("25.00"),
    #     sale_id="sale-790"
    # )
    # print(f"Redeemed {abs(redemption.points)} points")
    
    pass
