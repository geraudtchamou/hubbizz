import { db, dbHelpers } from './database';
import type { Sale, Expense, SyncQueueItem, DailySummary } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.afrhub.com';

export const syncService = {
  async syncPendingItems(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Offline - skipping sync');
      return;
    }

    const pendingItems = await dbHelpers.getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        await db.syncQueue.update(item.id, { status: 'syncing' as const });
        
        let endpoint = '';
        switch (item.type) {
          case 'sale':
            endpoint = '/api/v1/sales';
            break;
          case 'expense':
            endpoint = '/api/v1/expenses';
            break;
          case 'inventory':
            endpoint = '/api/v1/inventory/sync';
            break;
          case 'client':
            endpoint = '/api/v1/clients';
            break;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.data),
        });

        if (!response.ok) {
          throw new Error(`Sync failed with status ${response.status}`);
        }

        const syncedData = await response.json();
        
        // Update local record with server ID and sync timestamp
        await this.updateLocalRecord(item.type, item.data.id, syncedData);
        
        await dbHelpers.markAsSynced(item.id);
        console.log(`Successfully synced ${item.type} ${item.id}`);
      } catch (error) {
        console.error(`Failed to sync ${item.type} ${item.id}:`, error);
        await dbHelpers.markAsFailed(
          item.id, 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  },

  async updateLocalRecord(type: string, localId: number | string, serverData: any): Promise<void> {
    switch (type) {
      case 'sale':
        await db.sales.update(localId, {
          id: serverData.id,
          syncedAt: new Date(),
          isOffline: false
        });
        break;
      case 'expense':
        await db.expenses.update(localId, {
          id: serverData.id,
          syncedAt: new Date()
        });
        break;
    }
  },

  async pullUpdates(storeId: string, lastSyncAt?: Date): Promise<void> {
    if (!navigator.onLine) return;

    try {
      const params = new URLSearchParams({
        storeId,
        ...(lastSyncAt && { since: lastSyncAt.toISOString() })
      });

      const response = await fetch(`${API_BASE_URL}/api/v1/sync/pull?${params}`);
      if (!response.ok) throw new Error('Pull failed');

      const updates = await response.json();

      // Apply updates to local database
      if (updates.products) {
        for (const product of updates.products) {
          await db.products.put(product);
        }
      }
      if (updates.clients) {
        for (const client of updates.clients) {
          await db.clients.put(client);
        }
      }
      if (updates.prices) {
        for (const priceUpdate of updates.prices) {
          const product = await db.products.get(priceUpdate.productId);
          if (product) {
            product.basePrice = priceUpdate.newPrice;
            product.updatedAt = new Date();
            await db.products.put(product);
          }
        }
      }
      if (updates.tiers) {
        for (const tier of updates.tiers) {
          await db.loyaltyTiers.put(tier);
        }
      }

      console.log(`Pulled ${Object.keys(updates).length} update types`);
    } catch (error) {
      console.error('Failed to pull updates:', error);
    }
  },

  async calculateDailySummary(storeId: string, date: Date): Promise<DailySummary> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const sales = await dbHelpers.getSalesByDateRange(storeId, startOfDay, endOfDay);
    const expenses = await db.expenses
      .where('[storeId+date]')
      .between([storeId, startOfDay], [storeId, endOfDay], true, true)
      .toArray();

    const totalSales = sales
      .filter(s => s.status === 'completed')
      .reduce((sum, sale) => sum + sale.total, 0);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate COGS for gross profit
    const totalCOGS = sales
      .filter(s => s.status === 'completed')
      .reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => itemSum + (item.costPrice * item.quantity), 0);
      }, 0);

    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        paymentBreakdown[payment.method] = (paymentBreakdown[payment.method] || 0) + payment.amount;
      });
    });

    // Top products by revenue
    const productRevenue: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        productRevenue[item.productId] = (productRevenue[item.productId] || 0) + item.total;
      });
    });

    const topProducts = Object.entries(productRevenue)
      .map(([productId, revenue]) => ({ productId, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const summary: DailySummary = {
      id: crypto.randomUUID(),
      storeId,
      date: date.toISOString().split('T')[0],
      totalSales,
      totalExpenses,
      grossProfit,
      netProfit,
      transactionCount: sales.filter(s => s.status === 'completed').length,
      paymentBreakdown,
      topProducts,
      createdAt: new Date()
    };

    await dbHelpers.upsertDailySummary(summary);
    return summary;
  },

  startAutoSync(intervalMs: number = 30000): void {
    // Sync every 30 seconds when online
    setInterval(() => {
      if (navigator.onLine) {
        this.syncPendingItems();
      }
    }, intervalMs);

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Back online - starting sync');
      this.syncPendingItems();
    });

    window.addEventListener('offline', () => {
      console.log('Went offline - will queue transactions');
    });
  }
};

export default syncService;
