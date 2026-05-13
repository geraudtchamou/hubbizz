export interface User {
  id: string;
  email?: string;
  phone: string;
  name: string;
  role: 'admin' | 'cashier' | 'inventory_manager' | 'sales_rep';
  storeId: string;
  pin?: string;
  createdAt: Date;
}

export interface Store {
  id: string;
  name: string;
  logo?: string;
  address: string;
  currency: CurrencyCode;
  taxRules: TaxRule[];
  operatingHours: {
    open: string;
    close: string;
  };
  traderId: string;
  createdAt: Date;
}

export type CurrencyCode = 'XAF' | 'XOF' | 'NGN' | 'GHS' | 'KES' | 'TZS' | 'ZAR' | 'USD' | 'EUR';

export interface TaxRule {
  id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
  applicableTo: 'product' | 'transaction';
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  basePrice: number;
  costPrice: number;
  currency: CurrencyCode;
  categoryId: string;
  trackInventory: boolean;
  lowStockThreshold: number;
  variants?: ProductVariant[];
  batches?: Batch[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  attributes: Record<string, string>; // e.g., { size: 'L', color: 'Red' }
  sku: string;
  price: number;
  costPrice: number;
  stock: number;
}

export interface Batch {
  id: string;
  productId: string;
  quantity: number;
  remainingQuantity: number;
  costPrice: number;
  expiryDate?: Date;
  receivedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
  currentBalance: number;
  loyaltyPoints: number;
  tierId?: string;
  tags?: string[];
  createdAt: Date;
}

export interface LoyaltyTier {
  id: string;
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  minPoints: number;
  multiplier: number;
  perks: string[];
}

export interface Sale {
  id: string;
  storeId: string;
  cashierId: string;
  clientId?: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  payments: Payment[];
  status: 'completed' | 'void' | 'refunded';
  createdAt: Date;
  syncedAt?: Date;
  isOffline: boolean;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxAmount: number;
  total: number;
  costPrice: number; // For profit calculation
}

export interface Payment {
  id: string;
  saleId: string;
  method: 'cash' | 'mobile_money' | 'card' | 'credit';
  amount: number;
  currency: CurrencyCode;
  reference?: string;
  provider?: string; // e.g., 'M-Pesa', 'Airtel Money'
  createdAt: Date;
}

export interface Expense {
  id: string;
  storeId: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  description: string;
  date: Date;
  receiptImage?: string;
  createdBy: string;
  createdAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  supplierId: string;
  items: PurchaseItem[];
  total: number;
  status: 'pending' | 'received' | 'cancelled';
  createdAt: Date;
  receivedAt?: Date;
}

export interface PurchaseItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  payables: number;
}

export interface DailySummary {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  totalSales: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  transactionCount: number;
  paymentBreakdown: Record<string, number>;
  topProducts: Array<{ productId: string; revenue: number }>;
  createdAt: Date;
}

export interface SyncQueueItem {
  id: string;
  type: 'sale' | 'expense' | 'inventory' | 'client';
  data: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  attempts: number;
  createdAt: Date;
  syncedAt?: Date;
  error?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'report' | 'image';
  attachment?: string;
  createdAt: Date;
  readAt?: Date;
}

export interface ReportSchedule {
  id: string;
  storeId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  reportType: 'sales' | 'profit' | 'inventory' | 'debts';
  format: 'pdf' | 'png' | 'csv';
  enabled: boolean;
  lastSentAt?: Date;
  nextSendAt: Date;
}
