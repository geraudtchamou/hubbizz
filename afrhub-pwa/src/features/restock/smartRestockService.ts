/**
 * AI Smart Restock Service
 * Predicts stock needs based on sales velocity, seasonality, and trends
 * Sends WhatsApp notifications for restock recommendations
 */

export interface SalesHistory {
  productId: string;
  productName: string;
  dailySales: DailySale[];
  averageDailySales: number;
  salesVelocity: 'slow' | 'medium' | 'fast' | 'very_fast';
  seasonalityFactor: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
}

export interface DailySale {
  date: string;
  quantitySold: number;
  revenue: number;
}

export interface RestockPrediction {
  productId: string;
  productName: string;
  currentStock: number;
  predictedDaysUntilStockout: number;
  recommendedOrderQuantity: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  factors: string[];
  suggestedOrderDate: Date;
  estimatedCost: number;
  preferredSupplier?: string;
}

export interface RestockAlert {
  prediction: RestockPrediction;
  message: string;
  whatsappMessage: string;
  sentAt?: Date;
  acknowledged?: boolean;
}

export interface RestockConfig {
  safetyStockDays: number;
  minOrderQuantity: number;
  leadTimeDays: number;
  enableWhatsAppAlerts: boolean;
  alertThresholdDays: number;
}

class SmartRestockService {
  private config: RestockConfig = {
    safetyStockDays: 7,
    minOrderQuantity: 10,
    leadTimeDays: 3,
    enableWhatsAppAlerts: true,
    alertThresholdDays: 5,
  };

  /**
   * Analyze sales history and calculate velocity metrics
   */
  analyzeSalesHistory(
    productId: string,
    productName: string,
    salesData: DailySale[],
    daysToAnalyze: number = 30
  ): SalesHistory {
    // Filter to recent data
    const recentSales = salesData.slice(-daysToAnalyze);
    
    if (recentSales.length === 0) {
      return {
        productId,
        productName,
        dailySales: [],
        averageDailySales: 0,
        salesVelocity: 'slow',
        seasonalityFactor: 1.0,
        trendDirection: 'stable',
      };
    }

    // Calculate average daily sales
    const totalQuantity = recentSales.reduce((sum, day) => sum + day.quantitySold, 0);
    const averageDailySales = totalQuantity / recentSales.length;

    // Determine sales velocity
    let salesVelocity: SalesHistory['salesVelocity'] = 'slow';
    if (averageDailySales >= 20) salesVelocity = 'very_fast';
    else if (averageDailySales >= 10) salesVelocity = 'fast';
    else if (averageDailySales >= 5) salesVelocity = 'medium';

    // Calculate seasonality factor (compare recent week vs overall average)
    const last7Days = recentSales.slice(-7);
    const last7Avg = last7Days.reduce((sum, day) => sum + day.quantitySold, 0) / 7;
    const seasonalityFactor = averageDailySales > 0 ? last7Avg / averageDailySales : 1.0;

    // Determine trend direction using simple linear regression
    const trendDirection = this.calculateTrend(recentSales);

    return {
      productId,
      productName,
      dailySales: recentSales,
      averageDailySales,
      salesVelocity,
      seasonalityFactor,
      trendDirection,
    };
  }

  /**
   * Predict restock needs for a product
   */
  predictRestockNeed(
    product: {
      id: string;
      name: string;
      currentStock: number;
      salesHistory: DailySale[];
      minStockLevel?: number;
      reorderPoint?: number;
      costPrice: number;
      preferredSupplier?: string;
    },
    config?: Partial<RestockConfig>
  ): RestockPrediction {
    const effectiveConfig = { ...this.config, ...config };
    
    // Analyze sales history
    const salesAnalysis = this.analyzeSalesHistory(
      product.id,
      product.name,
      product.salesHistory
    );

    const { averageDailySales, seasonalityFactor, trendDirection } = salesAnalysis;

    // Adjust for trend
    let adjustedDailySales = averageDailySales;
    if (trendDirection === 'increasing') {
      adjustedDailySales *= 1.2; // 20% buffer for increasing trend
    } else if (trendDirection === 'decreasing') {
      adjustedDailySales *= 0.9; // 10% reduction for decreasing trend
    }

    // Apply seasonality factor
    adjustedDailySales *= seasonalityFactor;

    // Calculate days until stockout
    const daysUntilStockout = product.currentStock > 0 
      ? Math.floor(product.currentStock / (adjustedDailySales || 1))
      : 0;

    // Calculate recommended order quantity
    // Formula: (Daily Sales × (Lead Time + Safety Stock)) - Current Stock + Buffer
    const targetStock = adjustedDailySales * (effectiveConfig.leadTimeDays + effectiveConfig.safetyStockDays);
    let recommendedQuantity = Math.max(0, targetStock - product.currentStock);
    
    // Round up to minimum order quantity
    if (recommendedQuantity > 0 && recommendedQuantity < effectiveConfig.minOrderQuantity) {
      recommendedQuantity = effectiveConfig.minOrderQuantity;
    }

    // Determine urgency
    let urgency: RestockPrediction['urgency'] = 'low';
    if (daysUntilStockout <= 2) urgency = 'critical';
    else if (daysUntilStockout <= effectiveConfig.alertThresholdDays) urgency = 'high';
    else if (daysUntilStockout <= effectiveConfig.safetyStockDays) urgency = 'medium';

    // Calculate confidence score based on data quality
    const confidenceScore = this.calculateConfidence(salesAnalysis);

    // Identify key factors
    const factors: string[] = [];
    if (trendDirection === 'increasing') factors.push('Sales trending upward');
    if (trendDirection === 'decreasing') factors.push('Sales trending downward');
    if (seasonalityFactor > 1.1) factors.push('Recent spike in demand');
    if (seasonalityFactor < 0.9) factors.push('Recent drop in demand');
    if (product.currentStock === 0) factors.push('Currently out of stock');
    if (daysUntilStockout < effectiveConfig.leadTimeDays) factors.push('Will stock out before next delivery');

    // Calculate suggested order date
    const suggestedOrderDate = new Date();
    suggestedOrderDate.setDate(suggestedOrderDate.getDate() + Math.max(0, daysUntilStockout - effectiveConfig.leadTimeDays - 2));

    return {
      productId: product.id,
      productName: product.name,
      currentStock: product.currentStock,
      predictedDaysUntilStockout: daysUntilStockout,
      recommendedOrderQuantity: Math.round(recommendedQuantity),
      urgency,
      confidenceScore,
      factors,
      suggestedOrderDate,
      estimatedCost: Math.round(recommendedQuantity * product.costPrice * 100) / 100,
      preferredSupplier: product.preferredSupplier,
    };
  }

  /**
   * Generate restock predictions for all products in inventory
   */
  async generateInventoryRestockPlan(
    products: Array<{
      id: string;
      name: string;
      currentStock: number;
      salesHistory: DailySale[];
      costPrice: number;
      minStockLevel?: number;
      reorderPoint?: number;
      preferredSupplier?: string;
    }>,
    options?: {
      onlyUrgent?: boolean;
      minConfidence?: number;
    }
  ): Promise<RestockPrediction[]> {
    const { onlyUrgent = false, minConfidence = 0 } = options || {};

    const predictions = products.map(product => 
      this.predictRestockNeed(product)
    );

    // Filter results
    let filtered = predictions.filter(p => p.confidenceScore >= minConfidence);
    
    if (onlyUrgent) {
      filtered = filtered.filter(p => p.urgency === 'critical' || p.urgency === 'high');
    }

    // Sort by urgency and days until stockout
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    filtered.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.predictedDaysUntilStockout - b.predictedDaysUntilStockout;
    });

    return filtered;
  }

  /**
   * Generate WhatsApp message for restock alert
   */
  generateWhatsAppMessage(prediction: RestockPrediction): string {
    const urgencyEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
    };

    const urgencyText = {
      critical: 'CRITICAL - Order Immediately!',
      high: 'HIGH PRIORITY',
      medium: 'Medium Priority',
      low: 'Low Priority',
    };

    let message = `${urgencyEmoji[prediction.urgency]} *RESTOCK ALERT*\n\n`;
    message += `*Product:* ${prediction.productName}\n`;
    message += `*Current Stock:* ${prediction.currentStock} units\n`;
    message += `*Days Until Stockout:* ${prediction.predictedDaysUntilStockout} days\n\n`;
    
    message += `*Recommendation:*\n`;
    message += `Order Quantity: ${prediction.recommendedOrderQuantity} units\n`;
    message += `Estimated Cost: ${prediction.estimatedCost.toLocaleString()}\n`;
    message += `Suggested Order Date: ${prediction.suggestedOrderDate.toLocaleDateString()}\n\n`;

    if (prediction.preferredSupplier) {
      message += `*Preferred Supplier:* ${prediction.preferredSupplier}\n`;
    }

    if (prediction.factors.length > 0) {
      message += `\n*Key Factors:*\n`;
      prediction.factors.forEach(factor => {
        message += `• ${factor}\n`;
      });
    }

    message += `\n*Confidence:* ${Math.round(prediction.confidenceScore * 100)}%\n`;
    message += `\n_Reply 'YES' to create purchase order_`;

    return message;
  }

  /**
   * Send restock alerts via WhatsApp
   */
  async sendRestockAlerts(
    predictions: RestockPrediction[],
    phoneNumber: string,
    options?: {
      onlyCritical?: boolean;
      dryRun?: boolean;
    }
  ): Promise<RestockAlert[]> {
    const { onlyCritical = false, dryRun = false } = options || {};

    const alerts: RestockAlert[] = [];

    for (const prediction of predictions) {
      if (onlyCritical && prediction.urgency !== 'critical' && prediction.urgency !== 'high') {
        continue;
      }

      const whatsappMessage = this.generateWhatsAppMessage(prediction);
      
      const alert: RestockAlert = {
        prediction,
        message: `Restock needed for ${prediction.productName}`,
        whatsappMessage,
        sentAt: dryRun ? undefined : new Date(),
        acknowledged: false,
      };

      if (!dryRun && this.config.enableWhatsAppAlerts) {
        try {
          // In production: integrate with WhatsApp Business API
          await this.sendWhatsAppMessage(phoneNumber, whatsappMessage);
          console.log(`✅ Alert sent for ${prediction.productName}`);
        } catch (error) {
          console.error(`❌ Failed to send alert for ${prediction.productName}:`, error);
        }
      }

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Process WhatsApp reply to create purchase order
   */
  async processWhatsAppReply(
    reply: string,
    prediction: RestockPrediction,
    storeId: string
  ): Promise<{
    success: boolean;
    purchaseOrderId?: string;
    message: string;
  }> {
    const normalizedReply = reply.trim().toLowerCase();
    
    if (normalizedReply === 'yes' || normalizedReply === 'y' || normalizedReply === 'confirm') {
      try {
        // Create purchase order
        const purchaseOrder = {
          id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          storeId,
          productId: prediction.productId,
          productName: prediction.productName,
          quantity: prediction.recommendedOrderQuantity,
          estimatedCost: prediction.estimatedCost,
          status: 'pending',
          source: 'whatsapp_restock_alert',
          createdAt: new Date(),
        };

        // Save to database (mock implementation)
        await this.savePurchaseOrder(purchaseOrder);

        return {
          success: true,
          purchaseOrderId: purchaseOrder.id,
          message: `✅ Purchase order ${purchaseOrder.id} created successfully!`,
        };
      } catch (error) {
        return {
          success: false,
          message: `❌ Failed to create purchase order: ${error}`,
        };
      }
    }

    return {
      success: false,
      message: 'Reply not recognized. Please reply YES to confirm or NO to dismiss.',
    };
  }

  /**
   * Schedule automated daily restock reports
   */
  scheduleDailyRestockReport(
    storeId: string,
    phoneNumber: string,
    time: string = '08:00'
  ): void {
    // In production: use a job scheduler (e.g., node-cron, BullMQ)
    console.log(`📅 Scheduled daily restock report for ${time} to ${phoneNumber}`);
    
    // Mock scheduled task
    setInterval(async () => {
      const now = new Date();
      const [hours, minutes] = time.split(':').map(Number);
      
      if (now.getHours() === hours && now.getMinutes() === minutes) {
        await this.generateAndSendDailyReport(storeId, phoneNumber);
      }
    }, 60000); // Check every minute
  }

  // ==================== Helper Methods ====================

  private calculateTrend(salesData: DailySale[]): 'increasing' | 'stable' | 'decreasing' {
    if (salesData.length < 7) return 'stable';

    // Split into first half and second half
    const midPoint = Math.floor(salesData.length / 2);
    const firstHalf = salesData.slice(0, midPoint);
    const secondHalf = salesData.slice(midPoint);

    const firstAvg = firstHalf.reduce((sum, day) => sum + day.quantitySold, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.quantitySold, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateConfidence(salesAnalysis: SalesHistory): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (salesAnalysis.dailySales.length >= 30) confidence += 0.2;
    else if (salesAnalysis.dailySales.length >= 14) confidence += 0.1;

    // Consistent sales = higher confidence
    const stdDev = this.calculateStandardDeviation(
      salesAnalysis.dailySales.map(d => d.quantitySold)
    );
    const cv = stdDev / (salesAnalysis.averageDailySales || 1); // Coefficient of variation
    
    if (cv < 0.3) confidence += 0.2; // Low variance
    else if (cv < 0.5) confidence += 0.1; // Medium variance

    // Strong trend = higher confidence
    if (salesAnalysis.trendDirection !== 'stable') confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquareDiff);
  }

  private async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
    // In production: integrate with WhatsApp Business API
    // Example using Meta's WhatsApp Cloud API:
    /*
    const response = await fetch('https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message },
      }),
    });
    
    if (!response.ok) {
      throw new Error('WhatsApp API request failed');
    }
    */
    
    console.log(`📱 WhatsApp message to ${phoneNumber}:`, message);
  }

  private async savePurchaseOrder(po: any): Promise<void> {
    // In production: insert into purchase_orders table
    console.log('💾 Saving purchase order:', po);
  }

  private async generateAndSendDailyReport(storeId: string, phoneNumber: string): Promise<void> {
    // In production: fetch all products and generate comprehensive report
    console.log(`📊 Generating daily restock report for store ${storeId}`);
    
    const summary = `📈 *Daily Restock Report*\n\n` +
      `Store ID: ${storeId}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `_Check your dashboard for full details_`;
    
    await this.sendWhatsAppMessage(phoneNumber, summary);
  }
}

export const smartRestockService = new SmartRestockService();
