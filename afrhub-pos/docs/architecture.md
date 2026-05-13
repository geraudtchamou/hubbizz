# AfriHub POS - Architecture Documentation

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Flutter Mobile)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Retailer   │  │  Wholesaler  │  │   Cashier    │  │ Sales Rep    │   │
│  │     App      │  │     App      │  │     App      │  │     App      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┴────────┬────────┴─────────────────┘            │
│                                    │                                       │
│                    ┌───────────────▼───────────────┐                       │
│                    │   Offline-First Sync Layer    │                       │
│                    │  (GraphQL Delta Replication)  │                       │
│                    └───────────────┬───────────────┘                       │
│                                    │                                       │
│                    ┌───────────────▼───────────────┐                       │
│                    │   Local SQLite Database       │                       │
│                    │  (Encrypted, Realm/Drift)     │                       │
│                    └───────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/WebSocket
                                    │ (Sync when online)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Load Balancer (Nginx / AWS ALB)                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         ▼                          ▼                          ▼           │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐     │
│  │  REST API   │           │ GraphQL API │           │   WebSocket │     │
│  │  (FastAPI)  │           │  (Apollo)   │           │   (Sync)    │     │
│  └──────┬──────┘           └──────┬──────┘           └──────┬──────┘     │
└─────────┼─────────────────────────┼─────────────────────────┼────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (Modular Monolith)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    Store     │  │     CRM      │  │  Inventory   │  │    Sales     │   │
│  │   Module     │  │   Module     │  │   Module     │  │   Module     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Loyalty    │  │   Expense    │  │  Reporting   │  │   Chat/      │   │
│  │   Module     │  │   Module     │  │   Module     │  │  Assistant   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │   Payment    │  │    Tax       │  │  Promotion   │                     │
│  │   Module     │  │   Module     │  │   Module     │                     │
│  └──────────────┘  └──────────────┘  └──────────────┘                     │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Primary Database (PostgreSQL + PostGIS)           │  │
│  │  - Core Tables: users, stores, products, sales, purchases            │  │
│  │  - Inventory: variants, stock_levels, batches                        │  │
│  │  - Financial: expenses, payments, taxes                              │  │
│  │  - Engagement: loyalty, tiers, chat_messages, reports                │  │
│  │  - Sync: sync_queue, conflict_log, audit_trail                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Read Replica (Analytics & Reporting)              │  │
│  │  - Materialized views for dashboards                                 │  │
│  │  - Aggregated tables for profit calculations                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND WORKERS & JOBS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Sync       │  │   Report     │  │  Loyalty     │  │  WhatsApp/   │   │
│  │   Processor  │  │   Generator  │  │  Calculator  │  │  SMS Gateway │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │   Backup     │  │   Audit      │  │  Exchange    │                     │
│  │   Service    │  │   Logger     │  │  Rate Fetch  │                     │
│  └──────────────┘  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Mobile Money APIs (MTN, Airtel, M-Pesa, Orange Money)                   │
│  - Payment Gateways (Paystack, Flutterwave, Stripe)                        │
│  - WhatsApp Business API                                                     │
│  - SMS Gateways (Twilio, Africa's Talking)                                 │
│  - Currency Exchange Rates API                                               │
│  - Cloud Storage (S3-compatible for receipts, documents)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architecture Principles

### 1. Offline-First Design
- **Local SQLite** on each device is the source of truth for operations
- All writes complete locally before sync attempts
- Background sync with conflict resolution (last-write-wins + audit trail)
- Devices can operate indefinitely without connectivity

### 2. Modular Monolith Backend
- Single codebase with bounded contexts (Store, CRM, Inventory, Sales, etc.)
- Easy to deploy and maintain for African SMEs
- Can split into microservices later if needed (Reporting, Sync, Messaging)

### 3. Multi-Tenancy Strategy
- Single PostgreSQL database with `tenant_id` per trader/store
- Cost-effective for small traders
- Can shard by region (West Africa, East Africa) as scale grows

### 4. Security & Compliance
- End-to-end encryption for sensitive data (payments, PII)
- Role-based access control (RBAC)
- Audit trail on all edits/deletions
- GDPR/NDPR compliant data handling

### 5. Scalability Considerations
- Read replicas for heavy reporting queries
- Materialized views for dashboard widgets
- Queue-based background jobs (Celery/RQ)
- CDN for static assets (receipts, product images)

## Data Flow Examples

### Sale Transaction Flow
```
1. Cashier creates sale on Flutter app
2. Sale saved to local SQLite immediately
3. Inventory decremented locally
4. Receipt generated (PNG/PDF) stored locally
5. Background sync pushes sale to cloud
6. Cloud validates, applies business rules
7. Cloud updates central inventory
8. Loyalty points calculated and awarded
9. Profit metrics updated asynchronously
10. Confirmation synced back to device
```

### Chat Report Request Flow
```
1. Trader sends: "Show today's profit" in app chat
2. ChatReportService parses command
3. ProfitService computes daily profit from materialized view
4. Response formatted as text + PDF attachment
5. Sent via in-app notification
6. Optional: Forwarded to WhatsApp if configured
```

### Loyalty Tier Upgrade Flow
```
1. Sale completed → LoyaltyService earns points
2. Points added to customer loyalty balance
3. Check if tier threshold reached
4. If yes: upgrade tier, apply new perks
5. Send notification (in-app + SMS/WhatsApp)
6. Update dashboard widgets
```

## Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile | Flutter | Cross-platform, offline support, performance |
| Local DB | SQLite (Drift/Realm) | Mature, embedded, ACID-compliant |
| Backend API | FastAPI (Python) + Rust | Fast development, async, performance-critical in Rust |
| GraphQL | Apollo Server / Strawberry | Efficient sync, delta queries |
| Database | PostgreSQL + PostGIS | Robust, geospatial, JSONB flexibility |
| Cache | Redis | Session management, rate limiting |
| Queue | Celery + Redis/RabbitMQ | Background jobs, scheduled tasks |
| Sync | Custom GraphQL replication | Optimized for mobile offline scenarios |
| Storage | S3-compatible (MinIO/AWS) | Receipts, documents, images |
| Messaging | WhatsApp Business API + Twilio | Reach traders where they are |

## Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloud Region (AWS/Azure)                │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web App   │  │  Mobile API │  │  Sync Svc   │        │
│  │  (EC2/ECS)  │  │  (EC2/ECS)  │  │  (EC2/ECS)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Managed PostgreSQL (RDS)               │   │
│  │  - Primary (Multi-AZ)                               │   │
│  │  - Read Replica (for analytics)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Redis     │  │   S3        │  │  CloudWatch │        │
│  │  (ElastiCache)│ │  (Storage)  │  │  (Logging)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Background Workers (EC2/Fargate)          │   │
│  │  - Report generators                                │   │
│  │  - Sync processors                                  │   │
│  │  - WhatsApp/SMS senders                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Regional Considerations

### West Africa (XOF, NGN, GHS)
- French language support
- MTN Mobile Money, Orange Money integration
- Low-bandwidth optimization critical

### East Africa (KES, TZS, UGX)
- Swahili language support
- M-Pesa dominance
- Higher smartphone penetration

### Central Africa (XAF, CDF)
- French/Portuguese languages
- Limited connectivity → stronger offline mode
- Cash-heavy economies

### Southern Africa (ZAR, BWP, NAD)
- English primary
- More card payment adoption
- Better infrastructure
