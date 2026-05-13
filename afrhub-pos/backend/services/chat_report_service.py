"""
AfrHub POS - Chat Report Service
Parses natural language commands and generates reports via in-app chat.
Supports commands for profit, sales, inventory, debts, and store-specific queries.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple


class ReportType(Enum):
    PROFIT = "profit"
    SALES = "sales"
    INVENTORY = "inventory"
    DEBTS = "debts"
    EXPENSES = "expenses"
    TOP_PRODUCTS = "top_products"
    STORE_SUMMARY = "store_summary"
    CLIENT_REPORT = "client_report"


class PeriodKeyword(Enum):
    TODAY = "today"
    YESTERDAY = "yesterday"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_YEAR = "this_year"


@dataclass
class ParsedCommand:
    """Result of parsing a chat command."""
    intent: ReportType
    period: Optional[PeriodKeyword] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    limit: int = 10
    raw_command: str = ""


@dataclass
class ChatReportResponse:
    """Response to a chat command."""
    success: bool
    message: str
    report_type: Optional[ReportType] = None
    summary_data: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, str]]] = None  # PDF/PNG URLs
    suggested_followups: Optional[List[str]] = None


class ChatReportService:
    """
    Service for parsing chat commands and generating reports.
    
    Supported Commands:
    - "Show today's profit" / "report profit today"
    - "Yesterday's sales by store"
    - "Top 5 products by profit this month"
    - "Report weekly" / "report week"
    - "Report store TX" (specific store)
    - "Show overdue debts"
    - "Inventory status"
    
    Features:
    - Natural language parsing
    - Context-aware date resolution
    - Multi-store support
    - Formatted text summaries
    - Optional PDF/PNG attachment generation
    """
    
    def __init__(self, db_connection, profit_service, loyalty_service=None):
        self.db = db_connection
        self.profit_service = profit_service
        self.loyalty_service = loyalty_service
    
    async def process_command(
        self,
        user_id: str,
        store_id: str,
        message: str,
        conversation_id: Optional[str] = None
    ) -> ChatReportResponse:
        """
        Process a chat command and return appropriate report.
        
        Args:
            user_id: User ID
            store_id: Default store ID (can be overridden in command)
            message: User's message/command
            conversation_id: Optional conversation context
        
        Returns:
            ChatReportResponse with report data
        """
        message_lower = message.lower().strip()
        
        # Parse the command
        parsed = await self._parse_command(message_lower, store_id)
        
        if not parsed:
            return ChatReportResponse(
                success=False,
                message="I didn't understand that command. Try:\n" +
                        "• 'Show today's profit'\n" +
                        "• 'Yesterday's sales'\n" +
                        "• 'Top 5 products this month'\n" +
                        "• 'Report weekly'\n" +
                        "• 'Show overdue debts'"
            )
        
        # Generate the appropriate report
        if parsed.intent == ReportType.PROFIT:
            return await self._generate_profit_report(parsed, store_id)
        elif parsed.intent == ReportType.SALES:
            return await self._generate_sales_report(parsed, store_id)
        elif parsed.intent == ReportType.TOP_PRODUCTS:
            return await self._generate_top_products_report(parsed, store_id)
        elif parsed.intent == ReportType.DEBTS:
            return await self._generate_debts_report(parsed, store_id)
        elif parsed.intent == ReportType.INVENTORY:
            return await self._generate_inventory_report(parsed, store_id)
        elif parsed.intent == ReportType.STORE_SUMMARY:
            return await self._generate_store_summary(parsed, store_id)
        else:
            return ChatReportResponse(
                success=False,
                message=f"Report type '{parsed.intent.value}' is coming soon!"
            )
    
    async def _parse_command(
        self, 
        message: str, 
        default_store_id: str
    ) -> Optional[ParsedCommand]:
        """Parse natural language command into structured request."""
        
        # Pattern: "show/report [type] [period] [store]"
        
        # Detect report type
        report_type = None
        if any(word in message for word in ['profit', 'margin']):
            report_type = ReportType.PROFIT
        elif any(word in message for word in ['sale', 'revenue', 'income']):
            report_type = ReportType.SALES
        elif any(word in message for word in ['top', 'best', 'popular']):
            report_type = ReportType.TOP_PRODUCTS
        elif any(word in message for word in ['debt', 'owe', 'credit', 'due']):
            report_type = ReportType.DEBTS
        elif any(word in message for word in ['inventor', 'stock']):
            report_type = ReportType.INVENTORY
        elif any(word in message for word in ['store', 'branch']):
            report_type = ReportType.STORE_SUMMARY
        elif 'report' in message:
            # Generic "report" command - default to sales
            report_type = ReportType.SALES
        
        if not report_type:
            return None
        
        # Detect period
        period = None
        start_date = None
        end_date = None
        
        if 'today' in message or 'daily' in message or 'day' in message:
            period = PeriodKeyword.TODAY
            start_date = datetime.combine(datetime.now().date(), datetime.min.time())
            end_date = datetime.now()
        elif 'yesterday' in message:
            period = PeriodKeyword.YESTERDAY
            yesterday = datetime.now() - timedelta(days=1)
            start_date = datetime.combine(yesterday.date(), datetime.min.time())
            end_date = datetime.combine(yesterday.date(), datetime.max.time())
        elif 'week' in message or 'weekly' in message:
            if 'last' in message:
                period = PeriodKeyword.LAST_WEEK
                start_date = datetime.now() - timedelta(days=7)
            else:
                period = PeriodKeyword.THIS_WEEK
                start_date = datetime.now() - timedelta(days=7)
            end_date = datetime.now()
        elif 'month' in message or 'monthly' in message:
            if 'last' in message:
                period = PeriodKeyword.LAST_MONTH
                # First day of last month
                if datetime.now().month == 1:
                    start_date = datetime(datetime.now().year - 1, 12, 1)
                else:
                    start_date = datetime(datetime.now().year, datetime.now().month - 1, 1)
            else:
                period = PeriodKeyword.THIS_MONTH
                start_date = datetime(datetime.now().year, datetime.now().month, 1)
            end_date = datetime.now()
        elif 'year' in message or 'yearly' in message:
            period = PeriodKeyword.THIS_YEAR
            start_date = datetime(datetime.now().year, 1, 1)
            end_date = datetime.now()
        else:
            # Default to today
            period = PeriodKeyword.TODAY
            start_date = datetime.combine(datetime.now().date(), datetime.min.time())
            end_date = datetime.now()
        
        # Detect store reference
        store_id = default_store_id
        store_name = None
        
        # Look for store codes/names (e.g., "store TX", "branch Douala")
        store_match = re.search(r'(?:store|branch)\s+([A-Z]{2,}|[A-Za-z]+)', message)
        if store_match:
            store_identifier = store_match.group(1)
            # Could lookup actual store ID from database
            store_name = store_identifier
        
        # Detect limit (e.g., "top 5 products")
        limit = 10
        limit_match = re.search(r'\b(\d{1,2})\s*(?:products|items|stores)', message)
        if limit_match:
            limit = min(int(limit_match.group(1)), 50)  # Cap at 50
        
        return ParsedCommand(
            intent=report_type,
            period=period,
            start_date=start_date,
            end_date=end_date,
            store_id=store_id,
            store_name=store_name,
            limit=limit,
            raw_command=message
        )
    
    async def _generate_profit_report(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate profit report."""
        store_id = parsed.store_id or default_store_id
        
        # Get profit metrics
        metrics = await self.profit_service.compute_profit_for_period(
            store_id=store_id,
            start_date=parsed.start_date,
            end_date=parsed.end_date
        )
        
        # Format period description
        period_desc = self._format_period(parsed.period, parsed.start_date, parsed.end_date)
        
        # Build summary message
        message = f"💰 *Profit Report - {period_desc}*\n\n"
        message += f"📊 Revenue: {metrics.net_revenue:,.2f}\n"
        message += f"📦 COGS: {metrics.total_cogs:,.2f}\n"
        message += f"➖ Expenses: {metrics.total_expenses:,.2f}\n\n"
        message += f"✅ Gross Profit: {metrics.gross_profit:,.2f}\n"
        message += f"💵 Net Profit: {metrics.net_profit:,.2f}\n\n"
        message += f"📈 Gross Margin: {metrics.gross_margin_percent}%\n"
        message += f"📉 Net Margin: {metrics.net_margin_percent}%"
        
        # Add payment breakdown if significant
        if metrics.mobile_money_sales > 0:
            message += f"\n\n💳 Payment Breakdown:\n"
            message += f"  • Cash: {metrics.cash_sales:,.2f}\n"
            message += f"  • Mobile Money: {metrics.mobile_money_sales:,.2f}\n"
            if metrics.card_sales > 0:
                message += f"  • Card: {metrics.card_sales:,.2f}\n"
            if metrics.credit_sales > 0:
                message += f"  • Credit: {metrics.credit_sales:,.2f}"
        
        # Suggested follow-ups
        followups = [
            "Show top products by profit",
            "Compare with last week",
            "Show expense breakdown"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.PROFIT,
            summary_data={
                "revenue": str(metrics.net_revenue),
                "cogs": str(metrics.total_cogs),
                "expenses": str(metrics.total_expenses),
                "gross_profit": str(metrics.gross_profit),
                "net_profit": str(metrics.net_profit),
                "gross_margin": str(metrics.gross_margin_percent),
                "net_margin": str(metrics.net_margin_percent)
            },
            suggested_followups=followups
        )
    
    async def _generate_sales_report(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate sales report."""
        store_id = parsed.store_id or default_store_id
        
        query = """
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(grand_total), 0) as total_sales,
                COALESCE(AVG(grand_total), 0) as avg_transaction,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_sales
            FROM sales
            WHERE store_id = $1
              AND created_at >= $2
              AND created_at <= $3
        """
        
        row = await self.db.fetchrow(
            query, 
            store_id, 
            parsed.start_date, 
            parsed.end_date
        )
        
        period_desc = self._format_period(parsed.period, parsed.start_date, parsed.end_date)
        
        message = f"📊 *Sales Report - {period_desc}*\n\n"
        message += f"🛒 Total Transactions: {row['total_transactions']}\n"
        message += f"✅ Completed Sales: {row['completed_sales']}\n"
        message += f"💰 Total Revenue: {row['total_sales']:,.2f}\n"
        message += f"📈 Average Transaction: {row['avg_transaction']:,.2f}"
        
        followups = [
            "Show sales by hour",
            "Compare with last period",
            "Show top selling products"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.SALES,
            summary_data={
                "transactions": row['total_transactions'],
                "total_sales": str(row['total_sales']),
                "avg_transaction": str(row['avg_transaction'])
            },
            suggested_followups=followups
        )
    
    async def _generate_top_products_report(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate top products by profit report."""
        store_id = parsed.store_id or default_store_id
        
        top_products = await self.profit_service.get_product_profit_breakdown(
            store_id=store_id,
            start_date=parsed.start_date,
            end_date=parsed.end_date,
            limit=parsed.limit
        )
        
        if not top_products:
            return ChatReportResponse(
                success=True,
                message="No sales data found for this period.",
                report_type=ReportType.TOP_PRODUCTS
            )
        
        period_desc = self._format_period(parsed.period, parsed.start_date, parsed.end_date)
        
        message = f"🏆 *Top {len(top_products)} Products - {period_desc}*\n\n"
        
        for i, product in enumerate(top_products[:parsed.limit], 1):
            medal = ["🥇", "🥈", "🥉"][i-1] if i <= 3 else f"{i}."
            message += f"{medal} {product.product_name}\n"
            message += f"   Profit: {product.gross_profit:,.2f} | "
            message += f"Sold: {product.quantity_sold} | "
            message += f"Margin: {product.margin_percent}%\n\n"
        
        followups = [
            "Show detailed product analysis",
            "Show slow-moving products",
            "Export to Excel"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.TOP_PRODUCTS,
            summary_data=[
                {
                    "name": p.product_name,
                    "profit": str(p.gross_profit),
                    "quantity": p.quantity_sold,
                    "margin": str(p.margin_percent)
                }
                for p in top_products[:parsed.limit]
            ],
            suggested_followups=followups
        )
    
    async def _generate_debts_report(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate debts/overdue balances report."""
        store_id = parsed.store_id or default_store_id
        
        # Get client debts (customers who owe money)
        clients_query = """
            SELECT 
                first_name || ' ' || last_name as name,
                phone,
                current_balance,
                credit_limit,
                total_spent
            FROM clients
            WHERE store_id = $1
              AND current_balance > 0
            ORDER BY current_balance DESC
            LIMIT 20
        """
        
        clients = await self.db.fetch(query, store_id)
        
        # Get supplier payables (money we owe)
        suppliers_query = """
            SELECT 
                name,
                phone,
                ABS(current_balance) as amount_owed,
                credit_limit
            FROM suppliers
            WHERE store_id = $1
              AND current_balance < 0
            ORDER BY current_balance ASC
            LIMIT 20
        """
        
        suppliers = await self.db.fetch(suppliers_query, store_id)
        
        message = "💳 *Debts Report*\n\n"
        
        if clients:
            total_receivable = sum(c['current_balance'] for c in clients)
            message += f"📥 Money Owed to You: {total_receivable:,.2f}\n"
            message += f"   ({len(clients)} customers)\n\n"
            message += "*Top Debtors:*\n"
            for client in clients[:10]:
                message += f"• {client['name']}: {client['current_balance']:,.2f}\n"
                if client['phone']:
                    message += f"  📱 {client['phone']}\n"
            message += "\n"
        else:
            message += "✅ No customer debts outstanding\n\n"
        
        if suppliers:
            total_payable = sum(s['amount_owed'] for s in suppliers)
            message += f"📤 Money You Owe: {total_payable:,.2f}\n"
            message += f"   ({len(suppliers)} suppliers)\n\n"
            message += "*Top Payables:*\n"
            for supplier in suppliers[:10]:
                message += f"• {supplier['name']}: {supplier['amount_owed']:,.2f}\n"
        else:
            message += "✅ No supplier payments pending"
        
        followups = [
            "Send payment reminders",
            "Show overdue debts only",
            "Export debtors list"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.DEBTS,
            suggested_followups=followups
        )
    
    async def _generate_inventory_report(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate inventory status report."""
        store_id = parsed.store_id or default_store_id
        
        # Low stock items
        low_stock_query = """
            SELECT 
                p.name as product_name,
                pv.sku,
                pv.stock_quantity,
                p.min_stock_level,
                p.reorder_quantity
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE p.store_id = $1
              AND pv.stock_quantity <= p.min_stock_level
              AND pv.stock_quantity > 0
            ORDER BY pv.stock_quantity ASC
            LIMIT 15
        """
        
        low_stock = await self.db.fetch(low_stock_query, store_id)
        
        # Out of stock
        out_of_stock_query = """
            SELECT 
                p.name as product_name,
                pv.sku
            FROM product_variants pv
            JOIN products p ON pv.product_id = p.id
            WHERE p.store_id = $1
              AND pv.stock_quantity = 0
            ORDER BY p.name
            LIMIT 10
        """
        
        out_of_stock = await self.db.fetch(out_of_stock_query, store_id)
        
        message = "📦 *Inventory Report*\n\n"
        
        if low_stock:
            message += f"⚠️ Low Stock Items: {len(low_stock)}\n\n"
            for item in low_stock[:10]:
                message += f"• {item['product_name']}\n"
                message += f"  Current: {item['stock_quantity']} | "
                message += f"Min: {item['min_stock_level']} | "
                message += f"Suggest reorder: {item['reorder_quantity']}\n\n"
        else:
            message += "✅ All items adequately stocked\n\n"
        
        if out_of_stock:
            message += f"❌ Out of Stock: {len(out_of_stock)}\n\n"
            for item in out_of_stock[:5]:
                message += f"• {item['product_name']}\n"
        
        followups = [
            "Generate purchase orders",
            "Show inventory value",
            "Show expired items"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.INVENTORY,
            suggested_followups=followups
        )
    
    async def _generate_store_summary(
        self, 
        parsed: ParsedCommand, 
        default_store_id: str
    ) -> ChatReportResponse:
        """Generate multi-store summary."""
        # Get all stores for the user
        stores_query = """
            SELECT id, name, currency
            FROM stores
            WHERE owner_id = (SELECT owner_id FROM stores WHERE id = $1)
            ORDER BY name
        """
        
        stores = await self.db.fetch(stores_query, default_store_id)
        
        message = "🏪 *Store Summary - Today*\n\n"
        
        for store in stores:
            # Quick stats for each store
            quick_stats = """
                SELECT 
                    COUNT(*) as sales_count,
                    COALESCE(SUM(grand_total), 0) as total_sales
                FROM sales
                WHERE store_id = $1
                  AND created_at >= CURRENT_DATE
                  AND status = 'completed'
            """
            
            stats = await self.db.fetchrow(quick_stats, store['id'])
            
            message += f"📍 {store['name']}\n"
            message += f"   Sales: {stats['sales_count']} | "
            message += f"Revenue: {stats['total_sales']:,.2f} {store['currency']}\n\n"
        
        followups = [
            f"Show details for {stores[0]['name']}" if stores else "Show store details",
            "Compare stores",
            "Show combined profit"
        ]
        
        return ChatReportResponse(
            success=True,
            message=message,
            report_type=ReportType.STORE_SUMMARY,
            suggested_followups=followups
        )
    
    def _format_period(
        self, 
        period: Optional[PeriodKeyword],
        start_date: datetime,
        end_date: datetime
    ) -> str:
        """Format period for display."""
        if period == PeriodKeyword.TODAY:
            return "Today"
        elif period == PeriodKeyword.YESTERDAY:
            return "Yesterday"
        elif period == PeriodKeyword.THIS_WEEK:
            return "This Week"
        elif period == PeriodKeyword.LAST_WEEK:
            return "Last Week"
        elif period == PeriodKeyword.THIS_MONTH:
            return "This Month"
        elif period == PeriodKeyword.LAST_MONTH:
            return "Last Month"
        elif period == PeriodKeyword.THIS_YEAR:
            return "This Year"
        else:
            return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')}"
    
    async def schedule_report(
        self,
        user_id: str,
        store_id: str,
        report_type: str,
        frequency: str,
        delivery_method: str,
        delivery_target: str
    ) -> Dict[str, Any]:
        """Schedule automated recurring reports."""
        import uuid
        
        query = """
            INSERT INTO report_schedules (
                id, store_id, user_id, report_type, frequency,
                delivery_method, delivery_target, is_active,
                next_run_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW(), NOW())
            RETURNING *
        """
        
        row = await self.db.fetchrow(
            query,
            str(uuid.uuid4()),
            store_id,
            user_id,
            report_type,
            frequency,
            delivery_method,
            delivery_target
        )
        
        return {
            "success": True,
            "message": f"Report scheduled! You'll receive {report_type} reports {frequency} via {delivery_method}.",
            "schedule_id": row['id']
        }


# Example usage
if __name__ == "__main__":
    # This would be initialized with actual DB connection in production
    # chat_service = ChatReportService(db_connection, profit_service)
    
    # Example commands:
    # response = await chat_service.process_command(
    #     user_id="user-123",
    #     store_id="store-456",
    #     message="Show today's profit"
    # )
    # print(response.message)
    
    # response = await chat_service.process_command(
    #     user_id="user-123",
    #     store_id="store-456",
    #     message="Top 5 products by profit this month"
    # )
    # print(response.message)
    
    pass
