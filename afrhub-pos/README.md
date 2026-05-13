# AfrHub POS - Backend Services

Mobile-first, offline-first POS and business management platform for African traders.

## Project Structure

```
afrhub-pos/
├── ARCHITECTURE.md          # High-level system architecture
├── database/
│   └── schema.sql           # Complete PostgreSQL schema
├── backend/
│   └── services/
│       ├── loyalty_service.py      # Loyalty points & tiers
│       ├── profit_service.py       # Profit computation
│       └── chat_report_service.py  # Chat-based reporting
└── README.md                # This file
```

## Core Services

### 1. LoyaltyService (`loyalty_service.py`)

Manages customer loyalty programs with:

- **Points Earning**: Automatic points calculation based on purchases
- **Tier System**: Bronze/Silver/Gold tiers with automatic upgrades
- **Points Redemption**: Exchange points for discounts or rewards
- **Points Expiry**: Automated expiry handling
- **Bonus Promotions**: Special multiplier events

**Key Methods:**
```python
# Award points for a purchase
transaction = await loyalty_service.earn_points(
    client_id="client-123",
    program_id="program-456",
    sale_amount=Decimal("5000.00"),
    sale_id="sale-789"
)

# Redeem points
redemption = await loyalty_service.redeem_points(
    client_id="client-123",
    program_id="program-456",
    points_to_redeem=500,
    redemption_type="discount",
    value_amount=Decimal("25.00")
)

# Check and apply tier upgrade
new_tier = await loyalty_service.check_and_upgrade_tier(
    client_id="client-123",
    program_id="program-456"
)
```

### 2. ProfitService (`profit_service.py`)

Computes financial metrics including:

- **Gross Profit**: Revenue - COGS
- **Net Profit**: Revenue - COGS - Expenses
- **Profit Margins**: Gross and net margin percentages
- **Payment Breakdown**: Cash, Mobile Money, Card, Credit
- **Product-Level Profit**: Per-product profitability analysis
- **Daily Summaries**: Pre-computed metrics for fast reporting

**Key Methods:**
```python
# Daily profit
metrics = await profit_service.compute_daily_profit(
    store_id="store-123",
    date=datetime.now()
)
print(f"Net Profit: {metrics.net_profit}")
print(f"Net Margin: {metrics.net_margin_percent}%")

# Weekly profit
weekly = await profit_service.compute_weekly_profit(
    store_id="store-123",
    end_date=datetime.now(),
    weeks=1
)

# Top products by profit
top_products = await profit_service.get_top_products_by_profit(
    store_id="store-123",
    period=PeriodType.DAILY,
    limit=10
)
```

### 3. ChatReportService (`chat_report_service.py`)

Natural language interface for business reports:

**Supported Commands:**
- "Show today's profit"
- "Yesterday's sales by store"
- "Top 5 products by profit this month"
- "Report weekly"
- "Show overdue debts"
- "Inventory status"

**Key Methods:**
```python
# Process natural language command
response = await chat_service.process_command(
    user_id="user-123",
    store_id="store-456",
    message="Show today's profit"
)
print(response.message)

# Schedule automated reports
schedule = await chat_service.schedule_report(
    user_id="user-123",
    store_id="store-456",
    report_type="profit",
    frequency="daily",
    delivery_method="whatsapp",
    delivery_target="+237612345678"
)
```

## Database Schema

The PostgreSQL schema (`database/schema.sql`) includes:

### Core Tables
- `users` - Traders and staff accounts
- `stores` - Multiple stores per trader
- `roles` & `store_users` - Role-based access control

### Products & Inventory
- `products` - Base products
- `product_variants` - Size/color/brand variants
- `stock_movements` - Inventory audit trail
- `product_batches` - Batch & expiry tracking

### Sales & Payments
- `sales` - Transactions
- `sale_items` - Line items
- `payments` - Split payment support
- `sale_returns` - Returns processing

### CRM
- `clients` - Customer management
- `suppliers` - Supplier management
- `purchase_orders` - Procurement

### Financial
- `expenses` - Expense tracking
- `daily_summaries` - Pre-computed metrics

### Loyalty
- `loyalty_programs` - Program configuration
- `loyalty_tiers` - Tier definitions
- `loyalty_transactions` - Points history
- `loyalty_redemptions` - Reward redemptions

### Reporting & Sync
- `report_schedules` - Automated reports
- `chat_messages` - In-app chat
- `sync_queue` - Offline sync pending changes
- `audit_logs` - Complete audit trail

## Key Features

### Multi-Currency Support
All monetary values use DECIMAL(15,2) with currency code (XAF, XOF, NGN, GHS, KES, TZS, ZAR, etc.)

### African Payment Methods
- Cash
- Mobile Money (MTN, Orange, etc.)
- Card (if hardware enabled)
- Bank Transfer
- Credit Sales

### Offline-First Design
- Local SQLite on mobile devices
- Delta-based sync when online
- Conflict resolution with audit trail
- Queue-based sync processing

### Security
- Phone/Email + OTP authentication
- Role-based permissions
- PIN/biometric lock for cashiers
- Field-level encryption for sensitive data
- Complete audit trail

## Technology Stack

- **Frontend**: Flutter (mobile - iOS/Android)
- **Backend**: Python FastAPI / Django
- **Database**: PostgreSQL 14+
- **Cache/Queue**: Redis
- **Local DB**: SQLite (mobile)
- **Sync**: Custom delta-based replication

## Getting Started

### 1. Database Setup

```bash
# Create database
createdb afrhub_pos

# Run schema
psql afrhub_pos < database/schema.sql
```

### 2. Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/afrhub_pos
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
SMS_PROVIDER=twilio  # or local provider
WHATSAPP_API_KEY=your-key
```

### 3. Install Dependencies

```bash
pip install fastapi uvicorn asyncpg redis python-jose passlib
```

### 4. Run Services

```bash
# API Server
uvicorn main:app --reload

# Background Workers (for scheduled reports, sync processing)
python workers/report_scheduler.py
python workers/sync_processor.py
```

## API Endpoints (Planned)

```
POST   /api/v1/auth/otp/request
POST   /api/v1/auth/otp/verify
GET    /api/v1/stores
POST   /api/v1/sales
GET    /api/v1/sales/{id}
POST   /api/v1/sales/{id}/payments
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/inventory/low-stock
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/reports/profit?period=daily|weekly|monthly
GET    /api/v1/reports/sales
POST   /api/v1/chat/message
POST   /api/v1/sync/push
GET    /api/v1/sync/pull
```

## Deployment Considerations

### Regional Deployment
- Deploy servers in regions closest to users (West Africa, East Africa)
- Use CDN for static assets (receipts, product images)
- Consider data sovereignty requirements

### Scalability
- Horizontal scaling of API servers
- Database connection pooling (PgBouncer)
- Read replicas for reporting queries
- Future sharding by `tenant_id` or region

### Reliability
- Automated backups with point-in-time recovery
- Health checks and auto-recovery
- Graceful degradation when services are unavailable
- Offline capability for critical operations

## License

Proprietary - All rights reserved

## Contact

For questions or support, contact the AfrHub team.
