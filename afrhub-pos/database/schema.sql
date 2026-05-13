-- AfrHub POS Database Schema
-- PostgreSQL 14+ with extensions for UUID, JSONB, and full-text search

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "citext";   -- Case-insensitive text

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Users (Traders, Staff, Sub-accounts)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(20), -- 'email', 'phone', 'both'
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores (Multiple stores per trader)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(2) NOT NULL, -- ISO country code
    postal_code VARCHAR(20),
    phone VARCHAR(20),
    email CITEXT,
    currency CHAR(3) NOT NULL DEFAULT 'XAF', -- ISO currency code
    timezone VARCHAR(50) DEFAULT 'Africa/Douala',
    tax_id VARCHAR(100), -- VAT/TIN number
    operating_hours JSONB, -- {"monday": {"open": "08:00", "close": "20:00"}, ...}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Roles & Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- 'admin', 'cashier', 'inventory_manager', 'sales_rep'
    description TEXT,
    permissions JSONB NOT NULL, -- ["sales.create", "sales.view", "inventory.edit", ...]
    is_system_role BOOLEAN DEFAULT FALSE, -- Cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store Users (Sub-accounts with roles)
CREATE TABLE store_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    pin_hash VARCHAR(255), -- For cashier quick login
    biometric_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    hired_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_id)
);

-- ============================================================================
-- PRODUCTS & INVENTORY
-- ============================================================================

-- Product Categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (Base product without variants)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100), -- Base SKU (variants will have suffix)
    barcode VARCHAR(100), -- Default barcode
    brand VARCHAR(100),
    unit_of_measure VARCHAR(50) DEFAULT 'piece', -- piece, kg, liter, etc.
    is_variant_parent BOOLEAN DEFAULT FALSE,
    variant_attributes JSONB, -- ["size", "color", "brand"]
    tax_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
    is_taxable BOOLEAN DEFAULT TRUE,
    track_inventory BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,
    min_stock_level INTEGER DEFAULT 0, -- Low stock alert threshold
    reorder_quantity INTEGER DEFAULT 0, -- Suggested reorder amount
    costing_method VARCHAR(20) DEFAULT 'average', -- 'fifo', 'lifo', 'average'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'archived', 'draft'
    metadata JSONB, -- Custom fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Variants
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    variant_options JSONB NOT NULL, -- {"size": "Large", "color": "Red"}
    cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    compare_at_price DECIMAL(15,2), -- For showing discounts
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0, -- For pending sales
    incoming_quantity INTEGER DEFAULT 0, -- From purchase orders
    weight DECIMAL(10,2), -- In kg
    dimensions JSONB, -- {"length": 10, "width": 5, "height": 3}
    image_urls TEXT[], -- Array of image URLs
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements (Audit trail for inventory changes)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, -- 'sale', 'purchase', 'adjustment', 'return', 'transfer'
    quantity INTEGER NOT NULL, -- Positive or negative
    reference_type VARCHAR(50), -- 'sale', 'purchase_order', 'adjustment'
    reference_id UUID, -- ID of the referencing document
    reason TEXT, -- For adjustments
    unit_cost DECIMAL(15,2), -- Cost at time of movement
    performed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch & Expiry Tracking (For perishables)
CREATE TABLE product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id),
    quantity_received INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    cost_price DECIMAL(15,2) NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    expiry_date DATE, -- Nullable for non-perishables
    is_expired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM - CLIENTS
-- ============================================================================

-- Clients/Customers
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email CITEXT,
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(2),
    date_of_birth DATE,
    gender VARCHAR(20),
    tags TEXT[], -- ["vip", "wholesale", "regular"]
    notes TEXT,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0, -- Positive = owes money
    total_spent DECIMAL(15,2) DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    loyalty_tier_id UUID REFERENCES loyalty_tiers(id),
    preferred_language VARCHAR(10) DEFAULT 'en',
    marketing_opt_in BOOLEAN DEFAULT FALSE,
    source VARCHAR(50), -- 'walk-in', 'referral', 'import', 'web'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Tags (for better organization)
CREATE TABLE client_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, name)
);

-- ============================================================================
-- SALES & TRANSACTIONS
-- ============================================================================

-- Sales Orders/Invoices
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sale_number VARCHAR(50) UNIQUE NOT NULL, -- Generated: STORE-YYYYMMDD-0001
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'voided', 'refunded'
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_total DECIMAL(15,2) DEFAULT 0,
    tax_total DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_due DECIMAL(15,2) DEFAULT 0,
    is_credit_sale BOOLEAN DEFAULT FALSE,
    due_date DATE,
    notes TEXT,
    receipt_url TEXT, -- Generated PDF/PNG path
    metadata JSONB,
    synced_from_device UUID, -- Device ID for sync tracking
    device_created_at TIMESTAMPTZ, -- Original creation time on device
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Line Items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL, -- Snapshot at time of sale
    variant_options JSONB, -- Snapshot at time of sale
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    cost_at_sale DECIMAL(15,2), -- For profit calculation
    gross_profit DECIMAL(15,2), -- Computed: (unit_price - cost) * quantity
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (Support split payments)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'mobile_money', 'card', 'bank_transfer', 'credit'
    payment_provider VARCHAR(100), -- 'mtn', 'orange', 'visa', 'stripe'
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    transaction_ref VARCHAR(255), -- Provider transaction ID
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    metadata JSONB, -- Provider-specific data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Returns
CREATE TABLE sale_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    client_id UUID REFERENCES clients(id),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
    refund_amount DECIMAL(15,2) NOT NULL,
    refund_method VARCHAR(50), -- 'cash', 'store_credit', 'original_method'
    processed_by UUID REFERENCES store_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return Line Items
CREATE TABLE sale_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    original_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,2) NOT NULL,
    refund_amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    condition_status VARCHAR(20), -- 'resellable', 'damaged', 'expired'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PURCHASES & SUPPLIERS
-- ============================================================================

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    email CITEXT,
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(2),
    tax_id VARCHAR(100),
    payment_terms INTEGER DEFAULT 0, -- Days
    credit_limit DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0, -- Negative = we owe them
    rating INTEGER DEFAULT 5, -- 1-5
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'partial', 'completed', 'cancelled'
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_total DECIMAL(15,2) DEFAULT 0,
    shipping_cost DECIMAL(15,2) DEFAULT 0,
    grand_total DECIMAL(15,2) DEFAULT 0,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    balance_due DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES store_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_cost DECIMAL(15,2) NOT NULL,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Payments
CREATE TABLE supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    transaction_ref VARCHAR(255),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    recorded_by UUID REFERENCES store_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXPENSES
-- ============================================================================

-- Expense Categories
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
    is_fixed BOOLEAN DEFAULT FALSE, -- Fixed vs variable expense
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, name)
);

-- Expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    expense_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'mobile_money'
    vendor_name VARCHAR(255),
    receipt_url TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'yearly'
    approved_by UUID REFERENCES store_users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB,
    created_by UUID REFERENCES store_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LOYALTY PROGRAM
-- ============================================================================

-- Loyalty Programs
CREATE TABLE loyalty_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_per_currency_unit DECIMAL(10,2) DEFAULT 1, -- e.g., 1 point per 100 XAF
    currency_unit DECIMAL(10,2) DEFAULT 100, -- The unit for points calculation
    points_expiry_days INTEGER DEFAULT 365, -- 0 = never expire
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    terms_conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Tiers
CREATE TABLE loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- 'Bronze', 'Silver', 'Gold', 'Platinum'
    description TEXT,
    icon_url TEXT,
    min_points INTEGER DEFAULT 0,
    min_lifetime_spend DECIMAL(15,2) DEFAULT 0,
    benefits JSONB, -- {"discount_percent": 5, "bonus_points_multiplier": 1.5}
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Transactions (Earn/Spend/Adjust)
CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(20) NOT NULL, -- 'earn', 'redeem', 'adjustment', 'expire'
    points INTEGER NOT NULL, -- Positive for earn, negative for redeem
    balance_after INTEGER NOT NULL,
    reference_type VARCHAR(50), -- 'sale', 'manual', 'promotion'
    reference_id UUID, -- e.g., sale_id
    description TEXT,
    expires_at TIMESTAMPTZ, -- Points expiry date
    metadata JSONB,
    created_by UUID REFERENCES store_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Redemptions
CREATE TABLE loyalty_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    redemption_type VARCHAR(50) NOT NULL, -- 'discount', 'free_item', 'voucher'
    points_used INTEGER NOT NULL,
    value_amount DECIMAL(15,2) NOT NULL, -- Monetary value of redemption
    applied_to_sale_id UUID REFERENCES sales(id),
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAX & PRICING
-- ============================================================================

-- Tax Rules
CREATE TABLE tax_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'VAT', 'Local Tax', 'Service Charge'
    rate DECIMAL(5,2) NOT NULL, -- Percentage
    type VARCHAR(20) DEFAULT 'percentage', -- 'percentage', 'fixed'
    is_compound BOOLEAN DEFAULT FALSE, -- Tax on tax
    applies_to VARCHAR(20) DEFAULT 'all', -- 'all', 'products', 'categories'
    priority INTEGER DEFAULT 0, -- For multiple taxes
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE,
    effective_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotions & Discounts
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    promotion_type VARCHAR(50) NOT NULL, -- 'percentage_off', 'fixed_amount', 'buy_x_get_y', 'bundle'
    discount_value DECIMAL(15,2) NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage', 'fixed'
    promo_code VARCHAR(50) UNIQUE, -- Optional code for customer entry
    min_purchase_amount DECIMAL(15,2) DEFAULT 0,
    max_discount_amount DECIMAL(15,2), -- Cap on discount
    applies_to VARCHAR(20) DEFAULT 'all', -- 'all', 'products', 'categories', 'clients'
    target_ids UUID[], -- Product/category/client IDs this applies to
    buy_quantity INTEGER DEFAULT 0, -- For BOGO
    get_quantity INTEGER DEFAULT 0, -- For BOGO
    usage_limit INTEGER, -- Total uses allowed
    usage_count INTEGER DEFAULT 0,
    per_customer_limit INTEGER, -- Max uses per customer
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer-Specific Pricing
CREATE TABLE customer_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    custom_price DECIMAL(15,2) NOT NULL,
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, variant_id)
);

-- ============================================================================
-- CASH MANAGEMENT
-- ============================================================================

-- Cash Registers/Sessions
CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    register_name VARCHAR(100) NOT NULL, -- 'Main Register', 'Register 2'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Sessions (Open/Close)
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    store_user_id UUID NOT NULL REFERENCES store_users(id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0, -- Float/cash in drawer at start
    closing_balance DECIMAL(15,2), -- Actual counted at end
    expected_balance DECIMAL(15,2), -- Calculated from transactions
    difference DECIMAL(15,2), -- Variance (theft/loss/error)
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'suspended'
    notes TEXT,
    closed_by UUID REFERENCES store_users(id)
);

-- Non-Sales Cash Transactions
CREATE TABLE cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'petty_cash', 'correction'
    amount DECIMAL(15,2) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'in', 'out'
    category VARCHAR(100), -- 'float', 'deposit', 'expense', 'other'
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    performed_by UUID NOT NULL REFERENCES store_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REPORTING & ANALYTICS
-- ============================================================================

-- Pre-computed Daily Summaries (For fast reporting)
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_sales DECIMAL(15,2) DEFAULT 0,
    total_sales_count INTEGER DEFAULT 0,
    total_returns DECIMAL(15,2) DEFAULT 0,
    total_returns_count INTEGER DEFAULT 0,
    total_expenses DECIMAL(15,2) DEFAULT 0,
    total_cogs DECIMAL(15,2) DEFAULT 0, -- Cost of goods sold
    gross_profit DECIMAL(15,2) DEFAULT 0,
    net_profit DECIMAL(15,2) DEFAULT 0,
    total_tax_collected DECIMAL(15,2) DEFAULT 0,
    total_discount_given DECIMAL(15,2) DEFAULT 0,
    cash_sales DECIMAL(15,2) DEFAULT 0,
    mobile_money_sales DECIMAL(15,2) DEFAULT 0,
    card_sales DECIMAL(15,2) DEFAULT 0,
    credit_sales DECIMAL(15,2) DEFAULT 0,
    top_selling_variant_id UUID REFERENCES product_variants(id),
    top_selling_quantity INTEGER DEFAULT 0,
    new_clients_count INTEGER DEFAULT 0,
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_redeemed INTEGER DEFAULT 0,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, summary_date)
);

-- Report Schedules (Automated reports)
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL, -- 'sales_summary', 'profit_report', 'inventory_status', 'debts'
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    delivery_method VARCHAR(50) NOT NULL, -- 'in_app', 'email', 'whatsapp', 'sms'
    delivery_target VARCHAR(255), -- Email, phone number, WhatsApp number
    format VARCHAR(20) DEFAULT 'summary', -- 'summary', 'pdf', 'excel', 'csv'
    filters JSONB, -- {stores: [], date_range: 'last_7_days'}
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHAT & MESSAGING
-- ============================================================================

-- Chat Conversations
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_type VARCHAR(50) DEFAULT 'assistant', -- 'assistant', 'support', 'notifications'
    is_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    message_text TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'report', 'image', 'file'
    attachment_url TEXT, -- For reports/images
    metadata JSONB, -- Structured data for reports
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYNC & AUDIT
-- ============================================================================

-- Device Registration (For sync tracking)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100),
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    push_token TEXT, -- For notifications
    last_sync_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Queue (Pending changes to sync)
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    entity_type VARCHAR(50) NOT NULL, -- 'sale', 'product', 'client', etc.
    entity_id UUID NOT NULL,
    payload JSONB NOT NULL, -- The actual data change
    local_timestamp TIMESTAMPTZ NOT NULL, -- When change occurred on device
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log (All mutations)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout'
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB, -- Previous state (for updates/deletes)
    new_values JSONB, -- New state (for creates/updates)
    ip_address INET,
    user_agent TEXT,
    device_id UUID REFERENCES devices(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Common query patterns
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_store_users_user ON store_users(user_id);
CREATE INDEX idx_store_users_store ON store_users(store_id);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_sales_store ON sales(store_id);
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_clients_store ON clients(store_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_expenses_store ON expenses(store_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_loyalty_transactions_client ON loyalty_transactions(client_id);
CREATE INDEX idx_daily_summaries_store_date ON daily_summaries(store_id, summary_date DESC);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_clients_name_search ON clients USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- Trigram indexes for fuzzy search
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_clients_name_trgm ON clients USING gin((first_name || ' ' || last_name) gin_trgm_ops);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Current stock levels view
CREATE VIEW v_current_stock AS
SELECT 
    pv.id as variant_id,
    p.id as product_id,
    p.name as product_name,
    pv.sku,
    pv.barcode,
    pv.variant_options,
    SUM(sm.quantity) as current_stock
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
LEFT JOIN stock_movements sm ON pv.id = sm.variant_id
GROUP BY pv.id, p.id, p.name, pv.sku, pv.barcode, pv.variant_options;

-- Client balance overview
CREATE VIEW v_client_balances AS
SELECT 
    c.id,
    c.first_name || ' ' || c.last_name as full_name,
    c.phone,
    c.email,
    c.credit_limit,
    c.current_balance,
    c.total_spent,
    c.total_points,
    lt.name as loyalty_tier,
    CASE 
        WHEN c.current_balance > c.credit_limit THEN 'over_limit'
        WHEN c.current_balance > 0 THEN 'has_balance'
        ELSE 'good_standing'
    END as account_status
FROM clients c
LEFT JOIN loyalty_tiers lt ON c.loyalty_tier_id = lt.id;

-- Daily profit summary view
CREATE VIEW v_daily_profit AS
SELECT 
    ds.summary_date,
    ds.store_id,
    s.name as store_name,
    ds.total_sales,
    ds.total_cogs,
    ds.gross_profit,
    ds.total_expenses,
    ds.net_profit,
    ROUND((ds.gross_profit / NULLIF(ds.total_sales, 0) * 100), 2) as gross_margin_percent,
    ROUND((ds.net_profit / NULLIF(ds.total_sales, 0) * 100), 2) as net_margin_percent
FROM daily_summaries ds
JOIN stores s ON ds.store_id = s.id
ORDER BY ds.summary_date DESC;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
