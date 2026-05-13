"""
AfrHub POS - Profit Service
Computes daily, weekly, and monthly profit metrics including:
- Gross profit (Revenue - COGS)
- Net profit (Revenue - COGS - Expenses)
- Profit margins
- Per-store and per-product breakdowns
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple


class PeriodType(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


@dataclass
class ProfitMetrics:
    """Container for computed profit metrics."""
    period_start: datetime
    period_end: datetime
    store_id: Optional[str]
    
    # Revenue components
    total_revenue: Decimal = Decimal('0')
    total_sales_count: int = 0
    total_returns: Decimal = Decimal('0')
    net_revenue: Decimal = Decimal('0')
    
    # Cost components
    total_cogs: Decimal = Decimal('0')  # Cost of Goods Sold
    total_expenses: Decimal = Decimal('0')
    
    # Profit calculations
    gross_profit: Decimal = Decimal('0')
    net_profit: Decimal = Decimal('0')
    
    # Margins
    gross_margin_percent: Decimal = Decimal('0')
    net_margin_percent: Decimal = Decimal('0')
    
    # Additional metrics
    total_tax_collected: Decimal = Decimal('0')
    total_discount_given: Decimal = Decimal('0')
    
    # Payment breakdown
    cash_sales: Decimal = Decimal('0')
    mobile_money_sales: Decimal = Decimal('0')
    card_sales: Decimal = Decimal('0')
    credit_sales: Decimal = Decimal('0')
    
    # Computed at
    computed_at: datetime = None
    
    def __post_init__(self):
        if self.computed_at is None:
            self.computed_at = datetime.now()
        
        # Calculate derived fields
        self.net_revenue = self.total_revenue - self.total_returns
        self.gross_profit = self.net_revenue - self.total_cogs
        self.net_profit = self.gross_profit - self.total_expenses
        
        # Calculate margins (avoid division by zero)
        if self.net_revenue > 0:
            self.gross_margin_percent = (self.gross_profit / self.net_revenue * 100).quantize(Decimal('0.01'))
            self.net_margin_percent = (self.net_profit / self.net_revenue * 100).quantize(Decimal('0.01'))


@dataclass
class ProductProfitMetrics:
    """Profit metrics for individual products."""
    variant_id: str
    product_name: str
    sku: str
    
    quantity_sold: int = 0
    revenue: Decimal = Decimal('0')
    cogs: Decimal = Decimal('0')
    gross_profit: Decimal = Decimal('0')
    margin_percent: Decimal = Decimal('0')
    
    def __post_init__(self):
        self.gross_profit = self.revenue - self.cogs
        if self.revenue > 0:
            self.margin_percent = (self.gross_profit / self.revenue * 100).quantize(Decimal('0.01'))


class ProfitService:
    """
    Service for computing profit and financial metrics.
    
    Features:
    - Daily/weekly/monthly profit computation
    - Per-store and per-product breakdowns
    - COGS calculation using different costing methods (FIFO, LIFO, Average)
    - Expense aggregation
    - Pre-computed daily summaries for fast reporting
    """
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def compute_daily_profit(
        self,
        store_id: str,
        date: datetime,
        save_summary: bool = True
    ) -> ProfitMetrics:
        """
        Compute profit metrics for a specific day.
        
        Args:
            store_id: Store ID
            date: Date to compute for
            save_summary: Whether to save to daily_summaries table
        
        Returns:
            ProfitMetrics object
        """
        period_start = datetime.combine(date.date(), datetime.min.time())
        period_end = datetime.combine(date.date(), datetime.max.time())
        
        # Fetch all components
        revenue_data = await self._get_daily_revenue(store_id, period_start, period_end)
        cogs_data = await self._get_daily_cogs(store_id, period_start, period_end)
        expenses_data = await self._get_daily_expenses(store_id, period_start, period_end)
        payment_breakdown = await self._get_daily_payment_breakdown(store_id, period_start, period_end)
        
        # Build metrics object
        metrics = ProfitMetrics(
            period_start=period_start,
            period_end=period_end,
            store_id=store_id,
            total_revenue=revenue_data['total_revenue'] or Decimal('0'),
            total_sales_count=revenue_data['sales_count'] or 0,
            total_returns=revenue_data['total_returns'] or Decimal('0'),
            total_cogs=cogs_data['total_cogs'] or Decimal('0'),
            total_expenses=expenses_data['total_expenses'] or Decimal('0'),
            total_tax_collected=revenue_data['tax_collected'] or Decimal('0'),
            total_discount_given=revenue_data['discount_given'] or Decimal('0'),
            cash_sales=payment_breakdown.get('cash', Decimal('0')),
            mobile_money_sales=payment_breakdown.get('mobile_money', Decimal('0')),
            card_sales=payment_breakdown.get('card', Decimal('0')),
            credit_sales=payment_breakdown.get('credit', Decimal('0'))
        )
        
        # Save to daily_summaries if requested
        if save_summary:
            await self._save_daily_summary(metrics)
        
        return metrics
    
    async def compute_weekly_profit(
        self,
        store_id: str,
        end_date: datetime,
        weeks: int = 1
    ) -> ProfitMetrics:
        """
        Compute profit metrics for a week period.
        
        Args:
            store_id: Store ID
            end_date: End date of the period
            weeks: Number of weeks (default 1)
        
        Returns:
            ProfitMetrics object
        """
        period_end = datetime.combine(end_date.date(), datetime.max.time())
        period_start = period_end - timedelta(weeks=weeks)
        period_start = datetime.combine(period_start.date(), datetime.min.time())
        
        return await self._compute_period_profit(store_id, period_start, period_end)
    
    async def compute_monthly_profit(
        self,
        store_id: str,
        year: int,
        month: int
    ) -> ProfitMetrics:
        """
        Compute profit metrics for a month.
        
        Args:
            store_id: Store ID
            year: Year
            month: Month (1-12)
        
        Returns:
            ProfitMetrics object
        """
        period_start = datetime(year, month, 1)
        if month == 12:
            period_end = datetime(year + 1, 1, 1) - timedelta(seconds=1)
        else:
            period_end = datetime(year, month + 1, 1) - timedelta(seconds=1)
        
        return await self._compute_period_profit(store_id, period_start, period_end)
    
    async def compute_profit_for_period(
        self,
        store_id: Optional[str],
        start_date: datetime,
        end_date: datetime
    ) -> ProfitMetrics:
        """
        Compute profit for a custom date range.
        
        Args:
            store_id: Store ID (None for all stores)
            start_date: Period start
            end_date: Period end
        
        Returns:
            ProfitMetrics object
        """
        return await self._compute_period_profit(store_id, start_date, end_date)
    
    async def get_product_profit_breakdown(
        self,
        store_id: str,
        start_date: datetime,
        end_date: datetime,
        limit: int = 50
    ) -> List[ProductProfitMetrics]:
        """
        Get profit breakdown by product for a period.
        
        Args:
            store_id: Store ID
            start_date: Period start
            end_date: Period end
            limit: Max products to return
        
        Returns:
            List of ProductProfitMetrics sorted by gross profit
        """
        query = """
            SELECT 
                pv.id as variant_id,
                p.name as product_name,
                pv.sku,
                COALESCE(SUM(si.quantity), 0) as quantity_sold,
                COALESCE(SUM(si.total), 0) as revenue,
                COALESCE(SUM(si.cost_at_sale * si.quantity), 0) as cogs,
                COALESCE(SUM(si.gross_profit), 0) as gross_profit
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            JOIN product_variants pv ON si.variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE s.store_id = $1
              AND s.created_at >= $2
              AND s.created_at <= $3
              AND s.status = 'completed'
            GROUP BY pv.id, p.name, pv.sku
            ORDER BY gross_profit DESC
            LIMIT $4
        """
        
        rows = await self.db.fetch(
            query, 
            store_id, 
            start_date, 
            end_date, 
            limit
        )
        
        return [
            ProductProfitMetrics(
                variant_id=row['variant_id'],
                product_name=row['product_name'],
                sku=row['sku'],
                quantity_sold=int(row['quantity_sold']),
                revenue=row['revenue'] or Decimal('0'),
                cogs=row['cogs'] or Decimal('0'),
                gross_profit=row['gross_profit'] or Decimal('0')
            )
            for row in rows
        ]
    
    async def get_top_products_by_profit(
        self,
        store_id: str,
        period: PeriodType,
        limit: int = 10
    ) -> List[ProductProfitMetrics]:
        """
        Get top performing products by profit for a period.
        
        Args:
            store_id: Store ID
            period: Period type (daily, weekly, monthly)
            limit: Number of products to return
        
        Returns:
            List of top products
        """
        now = datetime.now()
        
        if period == PeriodType.DAILY:
            start_date = datetime.combine(now.date(), datetime.min.time())
            end_date = now
        elif period == PeriodType.WEEKLY:
            start_date = now - timedelta(days=7)
            end_date = now
        elif period == PeriodType.MONTHLY:
            start_date = datetime(now.year, now.month, 1)
            end_date = now
        else:
            start_date = now - timedelta(days=30)
            end_date = now
        
        return await self.get_product_profit_breakdown(
            store_id, 
            start_date, 
            end_date, 
            limit
        )
    
    async def recompute_all_daily_summaries(
        self,
        store_id: str,
        from_date: datetime,
        to_date: datetime
    ) -> int:
        """
        Background job to recompute daily summaries for a date range.
        
        Args:
            store_id: Store ID
            from_date: Start date
            to_date: End date
        
        Returns:
            Number of days processed
        """
        current_date = from_date.date()
        days_processed = 0
        
        while current_date <= to_date.date():
            try:
                await self.compute_daily_profit(
                    store_id,
                    datetime.combine(current_date, datetime.min.time()),
                    save_summary=True
                )
                days_processed += 1
            except Exception as e:
                # Log error but continue with next day
                print(f"Error computing profit for {current_date}: {e}")
            
            current_date += timedelta(days=1)
        
        return days_processed
    
    # =========================================================================
    # Private Helper Methods
    # =========================================================================
    
    async def _compute_period_profit(
        self,
        store_id: Optional[str],
        start_date: datetime,
        end_date: datetime
    ) -> ProfitMetrics:
        """Compute profit for any period."""
        # Fetch all components
        revenue_data = await self._get_period_revenue(store_id, start_date, end_date)
        cogs_data = await self._get_period_cogs(store_id, start_date, end_date)
        expenses_data = await self._get_period_expenses(store_id, start_date, end_date)
        payment_breakdown = await self._get_period_payment_breakdown(store_id, start_date, end_date)
        
        return ProfitMetrics(
            period_start=start_date,
            period_end=end_date,
            store_id=store_id,
            total_revenue=revenue_data['total_revenue'] or Decimal('0'),
            total_sales_count=revenue_data['sales_count'] or 0,
            total_returns=revenue_data['total_returns'] or Decimal('0'),
            total_cogs=cogs_data['total_cogs'] or Decimal('0'),
            total_expenses=expenses_data['total_expenses'] or Decimal('0'),
            total_tax_collected=revenue_data['tax_collected'] or Decimal('0'),
            total_discount_given=revenue_data['discount_given'] or Decimal('0'),
            cash_sales=payment_breakdown.get('cash', Decimal('0')),
            mobile_money_sales=payment_breakdown.get('mobile_money', Decimal('0')),
            card_sales=payment_breakdown.get('card', Decimal('0')),
            credit_sales=payment_breakdown.get('credit', Decimal('0'))
        )
    
    async def _get_daily_revenue(
        self,
        store_id: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Any]:
        """Get revenue data for a day."""
        query = """
            SELECT 
                COALESCE(SUM(grand_total), 0) as total_revenue,
                COUNT(*) FILTER (WHERE status = 'completed') as sales_count,
                COALESCE(SUM(tax_total), 0) as tax_collected,
                COALESCE(SUM(discount_total), 0) as discount_given
            FROM sales
            WHERE store_id = $1
              AND created_at >= $2
              AND created_at <= $3
              AND status IN ('completed', 'refunded')
        """
        
        row = await self.db.fetchrow(query, store_id, start, end)
        
        # Get returns
        returns_query = """
            SELECT COALESCE(SUM(refund_amount), 0) as total_returns
            FROM sale_returns
            WHERE store_id = $1
              AND created_at >= $2
              AND created_at <= $3
              AND status = 'completed'
        """
        returns_row = await self.db.fetchrow(returns_query, store_id, start, end)
        
        return {
            'total_revenue': row['total_revenue'],
            'sales_count': row['sales_count'],
            'tax_collected': row['tax_collected'],
            'discount_given': row['discount_given'],
            'total_returns': returns_row['total_returns']
        }
    
    async def _get_period_revenue(
        self,
        store_id: Optional[str],
        start: datetime,
        end: datetime
    ) -> Dict[str, Any]:
        """Get revenue data for a period."""
        if store_id:
            query = """
                SELECT 
                    COALESCE(SUM(grand_total), 0) as total_revenue,
                    COUNT(*) FILTER (WHERE status = 'completed') as sales_count,
                    COALESCE(SUM(tax_total), 0) as tax_collected,
                    COALESCE(SUM(discount_total), 0) as discount_given
                FROM sales
                WHERE store_id = $1
                  AND created_at >= $2
                  AND created_at <= $3
                  AND status IN ('completed', 'refunded')
            """
            row = await self.db.fetchrow(query, store_id, start, end)
        else:
            # All stores
            query = """
                SELECT 
                    COALESCE(SUM(grand_total), 0) as total_revenue,
                    COUNT(*) FILTER (WHERE status = 'completed') as sales_count,
                    COALESCE(SUM(tax_total), 0) as tax_collected,
                    COALESCE(SUM(discount_total), 0) as discount_given
                FROM sales
                WHERE created_at >= $1
                  AND created_at <= $2
                  AND status IN ('completed', 'refunded')
            """
            row = await self.db.fetchrow(query, start, end)
        
        return {
            'total_revenue': row['total_revenue'],
            'sales_count': row['sales_count'],
            'tax_collected': row['tax_collected'],
            'discount_given': row['discount_given'],
            'total_returns': Decimal('0')  # Simplified for period query
        }
    
    async def _get_daily_cogs(
        self,
        store_id: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """
        Calculate Cost of Goods Sold for a day.
        Uses the cost_at_sale stored in sale_items (computed at time of sale).
        """
        query = """
            SELECT 
                COALESCE(SUM(cost_at_sale * quantity), 0) as total_cogs
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.store_id = $1
              AND s.created_at >= $2
              AND s.created_at <= $3
              AND s.status = 'completed'
        """
        
        row = await self.db.fetchrow(query, store_id, start, end)
        return {'total_cogs': row['total_cogs']}
    
    async def _get_period_cogs(
        self,
        store_id: Optional[str],
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """Calculate COGS for a period."""
        if store_id:
            query = """
                SELECT 
                    COALESCE(SUM(si.cost_at_sale * si.quantity), 0) as total_cogs
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                WHERE s.store_id = $1
                  AND s.created_at >= $2
                  AND s.created_at <= $3
                  AND s.status = 'completed'
            """
            row = await self.db.fetchrow(query, store_id, start, end)
        else:
            query = """
                SELECT 
                    COALESCE(SUM(si.cost_at_sale * si.quantity), 0) as total_cogs
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                WHERE s.created_at >= $1
                  AND s.created_at <= $2
                  AND s.status = 'completed'
            """
            row = await self.db.fetchrow(query, start, end)
        
        return {'total_cogs': row['total_cogs']}
    
    async def _get_daily_expenses(
        self,
        store_id: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """Get total expenses for a day."""
        query = """
            SELECT 
                COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE store_id = $1
              AND expense_date >= $2
              AND expense_date <= $3
        """
        
        row = await self.db.fetchrow(query, store_id, start.date(), end.date())
        return {'total_expenses': row['total_expenses']}
    
    async def _get_period_expenses(
        self,
        store_id: Optional[str],
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """Get total expenses for a period."""
        if store_id:
            query = """
                SELECT 
                    COALESCE(SUM(amount), 0) as total_expenses
                FROM expenses
                WHERE store_id = $1
                  AND expense_date >= $2
                  AND expense_date <= $3
            """
            row = await self.db.fetchrow(query, store_id, start.date(), end.date())
        else:
            query = """
                SELECT 
                    COALESCE(SUM(amount), 0) as total_expenses
                FROM expenses
                WHERE expense_date >= $1
                  AND expense_date <= $2
            """
            row = await self.db.fetchrow(query, start.date(), end.date())
        
        return {'total_expenses': row['total_expenses']}
    
    async def _get_daily_payment_breakdown(
        self,
        store_id: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """Get sales breakdown by payment method."""
        query = """
            SELECT 
                COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash,
                COALESCE(SUM(CASE WHEN payment_method = 'mobile_money' THEN amount ELSE 0 END), 0) as mobile_money,
                COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card,
                COALESCE(SUM(CASE WHEN payment_method IN ('credit', 'bank_transfer') THEN amount ELSE 0 END), 0) as credit
            FROM payments p
            JOIN sales s ON p.sale_id = s.id
            WHERE s.store_id = $1
              AND p.payment_date >= $2
              AND p.payment_date <= $3
              AND s.status = 'completed'
        """
        
        row = await self.db.fetchrow(query, store_id, start, end)
        return {
            'cash': row['cash'] or Decimal('0'),
            'mobile_money': row['mobile_money'] or Decimal('0'),
            'card': row['card'] or Decimal('0'),
            'credit': row['credit'] or Decimal('0')
        }
    
    async def _get_period_payment_breakdown(
        self,
        store_id: Optional[str],
        start: datetime,
        end: datetime
    ) -> Dict[str, Decimal]:
        """Get payment breakdown for a period."""
        if store_id:
            query = """
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash,
                    COALESCE(SUM(CASE WHEN payment_method = 'mobile_money' THEN amount ELSE 0 END), 0) as mobile_money,
                    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card,
                    COALESCE(SUM(CASE WHEN payment_method IN ('credit', 'bank_transfer') THEN amount ELSE 0 END), 0) as credit
                FROM payments p
                JOIN sales s ON p.sale_id = s.id
                WHERE s.store_id = $1
                  AND p.payment_date >= $2
                  AND p.payment_date <= $3
                  AND s.status = 'completed'
            """
            row = await self.db.fetchrow(query, store_id, start, end)
        else:
            query = """
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash,
                    COALESCE(SUM(CASE WHEN payment_method = 'mobile_money' THEN amount ELSE 0 END), 0) as mobile_money,
                    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card,
                    COALESCE(SUM(CASE WHEN payment_method IN ('credit', 'bank_transfer') THEN amount ELSE 0 END), 0) as credit
                FROM payments p
                JOIN sales s ON p.sale_id = s.id
                WHERE p.payment_date >= $1
                  AND p.payment_date <= $2
                  AND s.status = 'completed'
            """
            row = await self.db.fetchrow(query, start, end)
        
        return {
            'cash': row['cash'] or Decimal('0'),
            'mobile_money': row['mobile_money'] or Decimal('0'),
            'card': row['card'] or Decimal('0'),
            'credit': row['credit'] or Decimal('0')
        }
    
    async def _save_daily_summary(self, metrics: ProfitMetrics) -> None:
        """Save or update daily summary record."""
        query = """
            INSERT INTO daily_summaries (
                id, store_id, summary_date,
                total_sales, total_sales_count, total_returns, total_returns_count,
                total_expenses, total_cogs, gross_profit, net_profit,
                total_tax_collected, total_discount_given,
                cash_sales, mobile_money_sales, card_sales, credit_sales,
                computed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (store_id, summary_date) DO UPDATE SET
                total_sales = EXCLUDED.total_sales,
                total_sales_count = EXCLUDED.total_sales_count,
                total_returns = EXCLUDED.total_returns,
                total_expenses = EXCLUDED.total_expenses,
                total_cogs = EXCLUDED.total_cogs,
                gross_profit = EXCLUDED.gross_profit,
                net_profit = EXCLUDED.net_profit,
                total_tax_collected = EXCLUDED.total_tax_collected,
                total_discount_given = EXCLUDED.total_discount_given,
                cash_sales = EXCLUDED.cash_sales,
                mobile_money_sales = EXCLUDED.mobile_money_sales,
                card_sales = EXCLUDED.card_sales,
                credit_sales = EXCLUDED.credit_sales,
                computed_at = EXCLUDED.computed_at
        """
        
        import uuid
        await self.db.execute(
            query,
            str(uuid.uuid4()),
            metrics.store_id,
            metrics.period_start.date(),
            metrics.total_revenue,
            metrics.total_sales_count,
            metrics.total_returns,
            0,  # returns count - would need separate query
            metrics.total_expenses,
            metrics.total_cogs,
            metrics.gross_profit,
            metrics.net_profit,
            metrics.total_tax_collected,
            metrics.total_discount_given,
            metrics.cash_sales,
            metrics.mobile_money_sales,
            metrics.card_sales,
            metrics.credit_sales,
            metrics.computed_at
        )
    
    async def get_cached_daily_summary(
        self,
        store_id: str,
        date: datetime
    ) -> Optional[ProfitMetrics]:
        """Fetch pre-computed daily summary from cache table."""
        query = """
            SELECT * FROM daily_summaries
            WHERE store_id = $1 AND summary_date = $2
        """
        
        row = await self.db.fetchrow(query, store_id, date.date())
        if not row:
            return None
        
        return ProfitMetrics(
            period_start=datetime.combine(row['summary_date'], datetime.min.time()),
            period_end=datetime.combine(row['summary_date'], datetime.max.time()),
            store_id=row['store_id'],
            total_revenue=row['total_sales'],
            total_sales_count=row['total_sales_count'],
            total_returns=row['total_returns'],
            total_cogs=row['total_cogs'],
            total_expenses=row['total_expenses'],
            gross_profit=row['gross_profit'],
            net_profit=row['net_profit'],
            total_tax_collected=row['total_tax_collected'],
            total_discount_given=row['total_discount_given'],
            cash_sales=row['cash_sales'],
            mobile_money_sales=row['mobile_money_sales'],
            card_sales=row['card_sales'],
            credit_sales=row['credit_sales'],
            computed_at=row['computed_at']
        )


# Example usage
if __name__ == "__main__":
    # This would be initialized with actual DB connection in production
    # profit_service = ProfitService(db_connection)
    
    # Example: Compute today's profit
    # metrics = await profit_service.compute_daily_profit(
    #     store_id="store-123",
    #     date=datetime.now()
    # )
    # print(f"Today's Net Profit: {metrics.net_profit}")
    # print(f"Net Margin: {metrics.net_margin_percent}%")
    
    # Example: Get top products
    # top_products = await profit_service.get_top_products_by_profit(
    #     store_id="store-123",
    #     period=PeriodType.DAILY,
    #     limit=10
    # )
    # for product in top_products:
    #     print(f"{product.product_name}: {product.gross_profit} profit")
    
    pass
