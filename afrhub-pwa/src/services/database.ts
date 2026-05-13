import Dexie, { Table } from 'dexie';
import type { 
  Product, Sale, Expense, Client, Supplier, 
  Store, User, SyncQueueItem, DailySummary,
  LoyaltyTier, ExpenseCategory
} from '../types';

class AfrHubDatabase extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  expenses!: Table<Expense>;
  clients!: Table<Client>;
  suppliers!: Table<Supplier>;
  stores!: Table<Store>;
  users!: Table<User>;
  syncQueue!: Table<SyncQueueItem>;
  dailySummaries!: Table<DailySummary>;
  loyaltyTiers!: Table<LoyaltyTier>;
  expenseCategories!: Table<ExpenseCategory>;

  constructor() {
    super('AfrHubDB');
    
    this.version(1).stores({
      products: '++id, sku, barcode, name, categoryId, *variants',
      sales: '++id, storeId, cashierId, clientId, status, createdAt, isOffline, syncedAt',
      expenses: '++id, storeId, categoryId, date, createdBy',
      clients: '++id, phone, email, name, *tags, tierId',
      suppliers: '++id, phone, email, name',
      stores: '++id, traderId, name',
      users: '++id, email, phone, storeId, role',
      syncQueue: '++id, type, status, createdAt',
      dailySummaries: '++id, [storeId+date], date',
      loyaltyTiers: '++id, name',
      expenseCategories: '++id, name'
    });

    // Indexes for common queries
    this.products.index('&sku');
    this.products.index('&barcode');
    this.sales.index('createdAt');
    this.sales.index('[storeId+createdAt]');
    this.expenses.index('[storeId+date]');
  }
}

export const db = new AfrHubDatabase();

// Helper functions for offline-first operations
export const dbHelpers = {
  async saveSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const id = await db.sales.add(sale as any);
    const savedSale = await db.sales.get(id);
    
    if (!savedSale) {
      throw new Error('Failed to save sale');
    }
    
    // Add to sync queue if offline
    if (savedSale.isOffline || !navigator.onLine) {
      await db.syncQueue.add({
        type: 'sale',
        data: savedSale,
        status: 'pending',
        attempts: 0,
        createdAt: new Date()
      });
    }
    
    return savedSale;
  },

  async saveExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const id = await db.expenses.add(expense as any);
    const savedExpense = await db.expenses.get(id);
    
    if (!savedExpense) {
      throw new Error('Failed to save expense');
    }
    
    if (!navigator.onLine) {
      await db.syncQueue.add({
        type: 'expense',
        data: savedExpense,
        status: 'pending',
        attempts: 0,
        createdAt: new Date()
      });
    }
    
    return savedExpense;
  },

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return await db.syncQueue.where('status').equals('pending').toArray();
  },

  async markAsSynced(id: number): Promise<void> {
    await db.syncQueue.update(id, {
      status: 'synced',
      syncedAt: new Date()
    });
  },

  async markAsFailed(id: number, error: string): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (item) {
      await db.syncQueue.update(id, {
        status: item.attempts >= 3 ? 'failed' : 'pending',
        attempts: item.attempts + 1,
        error
      });
    }
  },

  async getSalesByDateRange(storeId: string, start: Date, end: Date): Promise<Sale[]> {
    return await db.sales
      .where('[storeId+createdAt]')
      .between([storeId, start], [storeId, end], true, true)
      .toArray();
  },

  async getDailySummary(storeId: string, date: string): Promise<DailySummary | undefined> {
    return await db.dailySummaries.where('[storeId+date]').equals([storeId, date]).first();
  },

  async upsertDailySummary(summary: DailySummary): Promise<number> {
    const existing = await this.getDailySummary(summary.storeId, summary.date);
    if (existing) {
      await db.dailySummaries.update(existing.id, summary);
      return existing.id;
    }
    return await db.dailySummaries.add(summary);
  },

  async searchProducts(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase();
    return await db.products
      .filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        p.barcode?.toLowerCase().includes(lowerQuery)
      )
      .limit(50)
      .toArray();
  },

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    return await db.products.where('barcode').equals(barcode).first();
  },

  async updateProductStock(productId: string, variantId: string | undefined, quantityChange: number): Promise<void> {
    // Implementation depends on whether using variants or batches
    // This is a simplified version
    const product = await db.products.get(productId);
    if (product && product.trackInventory) {
      // Update stock in variants or batches
      // Complex logic would go here for FIFO/LIFO
    }
  }
};

export default db;
