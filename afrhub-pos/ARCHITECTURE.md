# AfrHub POS - High-Level Architecture

## Overview
Mobile-first, offline-first POS and business management app for African traders.

## System Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD INFRASTRUCTURE                                │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │   API Gateway   │────▶│  Load Balancer  │────▶│  App Servers        │   │
│  │  (Kong/Traefik) │     │   (Nginx/ALB)   │     │  (Rust/Django/Fast) │   │
│  └─────────────────┘     └─────────────────┘     └──────────┬──────────┘   │
│                                                             │              │
│  ┌─────────────────┐                                        │              │
│  │  Sync Service   │◀───────────────────────────────────────┤              │
│  │  (Delta Queue)  │                                        │              │
│  └────────┬────────┘                                        │              │
│           │                                                 │              │
│  ┌────────▼────────┐     ┌─────────────────┐     ┌──────────▼──────────┐   │
│  │  Message Queue  │────▶│ Background Jobs │     │   PostgreSQL DB     │   │
│  │  (Redis/SQS)    │     │ (Celery/BullMQ) │     │   (Primary + Replica)│  │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘   │
│                                                             │              │
│  ┌─────────────────┐                                        │              │
│  │ WhatsApp/SMS    │◀───────────────────────────────────────┤              │
│  │ Gateway Worker  │                                        │              │
│  └─────────────────┘                                        │              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS/WebSocket
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  Flutter Mobile │  │  Flutter Mobile │  │  Flutter Mobile │
│  (Store A)      │  │  (Store B)      │  │  (Store C)      │
│                 │  │                 │  │                 │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ Local SQLite│ │  │ │ Local SQLite│ │  │ │ Local SQLite│ │
│ │ (Offline DB)│ │  │ │ (Offline DB)│ │  │ │ (Offline DB)│ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
│                 │  │                 │  │                 │
│ • Sales         │  │ • Sales         │  │ • Sales         │
│ • Inventory     │  │ • Inventory     │  │ • Inventory     │
│ • Clients       │  │ • Clients       │  │ • Clients       │
│ • Expenses      │  │ • Expenses      │  │ • Expenses      │
│ • Loyalty       │  │ • Loyalty       │  │ • Loyalty       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Components

### 1. Flutter Mobile Client (Offline-First)
- **Local Database**: SQLite with encrypted storage
- **Sync Engine**: Background sync manager with conflict resolution
- **Modules**:
  - POS Terminal (Sales, Payments, Receipts)
  - Inventory Manager (Products, Variants, Stock)
  - CRM (Clients, Credit, Reminders)
  - Loyalty (Points, Tiers, Rewards)
  - Expense Tracker
  - Reports Dashboard
  - Chat Assistant

### 2. Backend API Layer (Modular Monolith)
**Stack**: Rust (performance-critical), Django (admin/ORM), FastAPI (async services)

**Bounded Contexts**:
- **Store Context**: Store setup, trader profiles, sub-accounts, roles/permissions
- **Product Context**: Products, variants, SKU, barcodes, costing methods
- **Sales Context**: Transactions, payments, splits, voids, receipts
- **Purchase Context**: Suppliers, invoices, returns, payables
- **Inventory Context**: Stock levels, transfers, adjustments, alerts
- **CRM Context**: Clients, tags, credit limits, payment history
- **Loyalty Context**: Programs, tiers, points, transactions
- **Expense Context**: Categories, tracking, approvals
- **Tax Context**: VAT, local taxes, tax rules per region
- **Reporting Context**: Analytics, profit computation, exports
- **Chat Context**: Command parsing, report generation, notifications

### 3. Sync Service
- **Delta-based replication**: Only changed data is synced
- **Conflict Resolution**: Last-write-wins with audit trail
- **Queue Management**: PostgreSQL-based sync queue or Redis Streams
- **Bi-directional Sync**:
  - Push: Local transactions → Cloud
  - Pull: Cloud updates (prices, products, loyalty tiers) → Local

### 4. Background Workers
- **Profit Calculator**: Daily/weekly/monthly net profit computation
- **Loyalty Processor**: Points calculation, tier upgrades, expiry handling
- **Report Generator**: PDF/PNG report creation
- **Notification Dispatcher**: In-app messages, SMS, WhatsApp
- **Data Cleanup**: Archive old data, manage backups

### 5. Database Schema (PostgreSQL)
- Single database with `tenant_id` for multi-store support
- Read replica for heavy reporting queries
- Row-level security for data isolation
- Full-text search for products/clients
- JSONB columns for flexible attributes (variants, custom fields)

### 6. Messaging Integration
- **WhatsApp Business API**: Report delivery, payment reminders
- **SMS Gateway**: OTP, alerts, low-connectivity fallback
- **In-App Chat**: Native messaging for reports and support

## Data Flow

### Offline Sale Transaction
1. Cashier creates sale on Flutter app
2. Sale saved to local SQLite with unique UUID
3. Receipt generated locally (PNG/PDF)
4. Sync service queues transaction for upload
5. When online: transaction pushed to cloud
6. Cloud validates, applies business logic, stores in PostgreSQL
7. Cloud broadcasts update to other devices in same store

### Sync Process
1. Device checks network connectivity
2. Fetches last sync timestamp from cloud
3. Queries local DB for changes since last sync
4. Packages delta payload (JSON)
5. Sends to `/api/v1/sync/push` endpoint
6. Receives cloud deltas since device's last sync
7. Applies cloud changes to local SQLite
8. Updates last sync timestamp

### Chat Report Request
1. User types: "Show today's profit"
2. Flutter sends message to `/api/v1/chat/message`
3. ChatReportService parses command
4. Queries ProfitService for computed metrics
5. Generates text summary + optional PDF
6. Returns response via WebSocket or polling
7. Stores conversation in ChatMessage table

## Security Model
- **Authentication**: Phone/Email + OTP (Twilio/local SMS provider)
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: 
  - TLS 1.3 for transit
  - AES-256 for local SQLite
  - Field-level encryption for sensitive data
- **Audit Trail**: All mutations logged with user, timestamp, IP
- **Session Management**: Short-lived JWT tokens with refresh rotation

## Scalability Considerations
- Horizontal scaling of API servers behind load balancer
- Database connection pooling (PgBouncer)
- Read replicas for reporting queries
- CDN for static assets (receipts, product images)
- Regional deployment (West Africa, East Africa servers)
- Future sharding by `tenant_id` or geographic region
