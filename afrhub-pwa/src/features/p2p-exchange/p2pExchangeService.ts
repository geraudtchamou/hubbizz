/**
 * P2P Stock Exchange Service
 * Local B2B marketplace for verified traders to buy/sell excess stock
 * Keeps money within the local trading community (5km radius)
 */

export interface ProductListing {
  id: string;
  sellerId: string;
  sellerName: string;
  storeName: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  minOrderQuantity: number;
  condition: 'new' | 'near_expiry' | 'bulk_only';
  expiryDate?: Date;
  batchNumber?: string;
  description?: string;
  images: string[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    country: string;
  };
  status: 'active' | 'reserved' | 'sold' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  views: number;
  inquiries: number;
}

export interface PurchaseRequest {
  id: string;
  buyerId: string;
  buyerName: string;
  listingId: string;
  productName: string;
  requestedQuantity: number;
  offeredPrice: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  message?: string;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  createdAt: Date;
  respondedAt?: Date;
  completedAt?: Date;
}

export interface TraderProfile {
  id: string;
  name: string;
  businessName: string;
  verificationStatus: 'unverified' | 'pending' | 'verified';
  rating: number;
  totalTransactions: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    country: string;
  };
  categories: string[];
  joinedDate: Date;
  responseRate: number;
  avgResponseTime: number; // in hours
}

export interface SearchFilters {
  category?: string;
  minQuantity?: number;
  maxPrice?: number;
  currency?: string;
  condition?: ProductListing['condition'];
  radiusKm?: number;
  onlyVerified?: boolean;
  sortBy?: 'distance' | 'price' | 'date' | 'quantity';
  sortOrder?: 'asc' | 'desc';
}

export interface NegotiationMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderType: 'buyer' | 'seller';
  message: string;
  messageType: 'text' | 'offer' | 'counter_offer' | 'acceptance' | 'rejection';
  offer?: {
    quantity: number;
    price: number;
  };
  timestamp: Date;
  read: boolean;
}

export interface TransactionRecord {
  id: string;
  listingId: string;
  requestId: string;
  buyerId: string;
  sellerId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  paymentMethod: 'cash' | 'mobile_money' | 'bank_transfer' | 'credit';
  paymentStatus: 'pending' | 'partial' | 'completed' | 'refunded';
  deliveryStatus: 'pending' | 'in_transit' | 'delivered' | 'picked_up';
  rating?: number;
  review?: string;
  createdAt: Date;
  completedAt?: Date;
}

class P2PStockExchangeService {
  private readonly MAX_RADIUS_KM = 5;
  private readonly LISTING_EXPIRY_DAYS = 7;

  /**
   * Create a new product listing
   */
  async createListing(
    seller: {
      id: string;
      name: string;
      storeName: string;
      location: ProductListing['location'];
    },
    product: {
      id: string;
      name: string;
      category: string;
      quantity: number;
      unitPrice: number;
      currency: string;
      condition?: ProductListing['condition'];
      expiryDate?: Date;
      batchNumber?: string;
      description?: string;
      images?: string[];
      minOrderQuantity?: number;
    }
  ): Promise<ProductListing> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + this.LISTING_EXPIRY_DAYS);

    const listing: ProductListing = {
      id: `LST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sellerId: seller.id,
      sellerName: seller.name,
      storeName: seller.storeName,
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      currency: product.currency,
      minOrderQuantity: product.minOrderQuantity || 1,
      condition: product.condition || 'new',
      expiryDate: product.expiryDate,
      batchNumber: product.batchNumber,
      description: product.description,
      images: product.images || [],
      location: seller.location,
      status: 'active',
      createdAt: now,
      expiresAt,
      views: 0,
      inquiries: 0,
    };

    // Save to database
    await this.saveListing(listing);

    // Notify nearby buyers
    await this.notifyNearbyBuyers(listing);

    return listing;
  }

  /**
   * Search for products within radius
   */
  async searchListings(
    userLocation: { latitude: number; longitude: number },
    filters: SearchFilters = {}
  ): Promise<Array<ProductListing & { distanceKm: number }>> {
    const radiusKm = filters.radiusKm || this.MAX_RADIUS_KM;

    // In production: query database with geospatial index
    const allListings = await this.getActiveListings();

    // Filter and calculate distances
    const results = allListings
      .filter(listing => {
        if (listing.status !== 'active') return false;
        if (listing.expiresAt < new Date()) return false;

        // Calculate distance
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          listing.location.latitude,
          listing.location.longitude
        );

        if (distance > radiusKm) return false;

        // Apply filters
        if (filters.category && listing.category !== filters.category) return false;
        if (filters.minQuantity && listing.quantity < filters.minQuantity) return false;
        if (filters.maxPrice && listing.unitPrice > filters.maxPrice) return false;
        if (filters.currency && listing.currency !== filters.currency) return false;
        if (filters.condition && listing.condition !== filters.condition) return false;
        if (filters.onlyVerified) {
          const seller = await this.getTraderProfile(listing.sellerId);
          if (seller?.verificationStatus !== 'verified') return false;
        }

        return true;
      })
      .map(listing => ({
        ...listing,
        distanceKm: this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          listing.location.latitude,
          listing.location.longitude
        ),
      }));

    // Sort results
    const sortBy = filters.sortBy || 'distance';
    const sortOrder = filters.sortOrder || 'asc';

    results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'distance':
          comparison = a.distanceKm - b.distanceKm;
          break;
        case 'price':
          comparison = a.unitPrice - b.unitPrice;
          break;
        case 'quantity':
          comparison = a.quantity - b.quantity;
          break;
        case 'date':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return results;
  }

  /**
   * Submit purchase request
   */
  async submitPurchaseRequest(
    buyer: {
      id: string;
      name: string;
      location: ProductListing['location'];
    },
    listing: ProductListing,
    request: {
      quantity: number;
      offeredPrice?: number;
      message?: string;
      deliveryMethod: 'pickup' | 'delivery';
      deliveryAddress?: string;
    }
  ): Promise<PurchaseRequest> {
    // Validate quantity
    if (request.quantity < listing.minOrderQuantity) {
      throw new Error(`Minimum order quantity is ${listing.minOrderQuantity}`);
    }
    if (request.quantity > listing.quantity) {
      throw new Error(`Only ${listing.quantity} units available`);
    }

    const unitPrice = request.offeredPrice || listing.unitPrice;
    const totalAmount = request.quantity * unitPrice;

    const purchaseRequest: PurchaseRequest = {
      id: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      buyerId: buyer.id,
      buyerName: buyer.name,
      listingId: listing.id,
      productName: listing.productName,
      requestedQuantity: request.quantity,
      offeredPrice: unitPrice,
      totalAmount,
      currency: listing.currency,
      status: 'pending',
      message: request.message,
      deliveryMethod: request.deliveryMethod,
      deliveryAddress: request.deliveryAddress,
      createdAt: new Date(),
    };

    // Save request
    await this.savePurchaseRequest(purchaseRequest);

    // Increment listing inquiries
    await this.incrementListingInquiries(listing.id);

    // Notify seller
    await this.notifySellerNewRequest(listing.sellerId, purchaseRequest);

    return purchaseRequest;
  }

  /**
   * Respond to purchase request
   */
  async respondToRequest(
    requestId: string,
    sellerId: string,
    response: 'accept' | 'reject' | 'counter_offer',
    counterOffer?: {
      quantity: number;
      price: number;
      message?: string;
    }
  ): Promise<{
    success: boolean;
    requestId: string;
    status: PurchaseRequest['status'];
    message: string;
  }> {
    const request = await this.getPurchaseRequest(requestId);

    if (!request) {
      return {
        success: false,
        requestId,
        status: 'pending',
        message: 'Request not found',
      };
    }

    // Verify seller ownership
    const listing = await this.getListing(request.listingId);
    if (listing?.sellerId !== sellerId) {
      return {
        success: false,
        requestId,
        status: request.status,
        message: 'Unauthorized',
      };
    }

    let newStatus: PurchaseRequest['status'] = request.status;
    let message = '';

    if (response === 'accept') {
      newStatus = 'accepted';
      message = 'Request accepted! Please proceed with payment.';
      
      // Reserve stock
      await this.reserveStock(listing.id, request.requestedQuantity);
      
      // Send payment instructions to buyer
      await this.sendPaymentInstructions(request);
    } else if (response === 'reject') {
      newStatus = 'rejected';
      message = 'Request rejected by seller.';
    } else if (response === 'counter_offer' && counterOffer) {
      // Create counter-offer message
      await this.sendNegotiationMessage({
        id: `MSG-${Date.now()}`,
        requestId,
        senderId: sellerId,
        senderType: 'seller',
        message: counterOffer.message || 'Counter offer',
        messageType: 'counter_offer',
        offer: {
          quantity: counterOffer.quantity,
          price: counterOffer.price,
        },
        timestamp: new Date(),
        read: false,
      });
      
      message = 'Counter offer sent to buyer.';
    }

    // Update request status
    await this.updateRequestStatus(requestId, newStatus, new Date());

    // Notify buyer
    await this.notifyBuyerResponse(request.buyerId, request, newStatus, counterOffer);

    return {
      success: true,
      requestId,
      status: newStatus,
      message,
    };
  }

  /**
   * Complete transaction
   */
  async completeTransaction(
    requestId: string,
    paymentDetails: {
      method: TransactionRecord['paymentMethod'];
      amount: number;
      reference?: string;
    },
    deliveryDetails: {
      status: 'delivered' | 'picked_up';
      completedAt: Date;
    }
  ): Promise<TransactionRecord> {
    const request = await this.getPurchaseRequest(requestId);
    if (!request) throw new Error('Request not found');

    const listing = await this.getListing(request.listingId);
    if (!listing) throw new Error('Listing not found');

    // Create transaction record
    const transaction: TransactionRecord = {
      id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      listingId: listing.id,
      requestId: request.id,
      buyerId: request.buyerId,
      sellerId: listing.sellerId,
      productName: listing.productName,
      quantity: request.requestedQuantity,
      unitPrice: request.offeredPrice,
      totalAmount: request.totalAmount,
      currency: request.currency,
      paymentMethod: paymentDetails.method,
      paymentStatus: 'completed',
      deliveryStatus: deliveryDetails.status,
      createdAt: request.createdAt,
      completedAt: deliveryDetails.completedAt,
    };

    // Save transaction
    await this.saveTransaction(transaction);

    // Update listing stock
    await this.reduceListingStock(listing.id, request.requestedQuantity);

    // Update request status
    await this.updateRequestStatus(requestId, 'completed', deliveryDetails.completedAt);

    // Update seller stats
    await this.updateSellerStats(listing.sellerId, {
      transactionCompleted: true,
      amount: transaction.totalAmount,
    });

    // Update buyer stats
    await this.updateBuyerStats(request.buyerId, {
      transactionCompleted: true,
      amount: transaction.totalAmount,
    });

    // Request review
    await this.requestReview(request.buyerId, listing.sellerId, transaction.id);

    return transaction;
  }

  /**
   * Get trader profile with ratings
   */
  async getTraderProfile(traderId: string): Promise<TraderProfile | null> {
    // In production: query database
    // This is a mock implementation
    return {
      id: traderId,
      name: 'John Doe',
      businessName: 'Doe Enterprises',
      verificationStatus: 'verified',
      rating: 4.8,
      totalTransactions: 156,
      location: {
        latitude: 6.5244,
        longitude: 3.3792,
        address: '123 Market Street',
        city: 'Lagos',
        country: 'Nigeria',
      },
      categories: ['Food Items', 'Beverages', 'Packaged Goods'],
      joinedDate: new Date('2023-01-15'),
      responseRate: 95,
      avgResponseTime: 2,
    };
  }

  /**
   * Verify trader (KYC process)
   */
  async verifyTrader(
    traderId: string,
    documents: {
      businessRegistration?: string;
      taxId?: string;
      idCard?: string;
      proofOfAddress?: string;
    }
  ): Promise<{
    success: boolean;
    status: 'pending' | 'verified' | 'rejected';
    message: string;
  }> {
    // In production: implement KYC verification workflow
    console.log('Verifying trader:', traderId, documents);

    // Mock verification
    return {
      success: true,
      status: 'pending',
      message: 'Documents submitted for verification. Processing time: 24-48 hours.',
    };
  }

  /**
   * Calculate fair market price suggestion
   */
  suggestMarketPrice(
    productCategory: string,
    location: { latitude: number; longitude: number },
    quantity: number
  ): Promise<{
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    currency: string;
    sampleSize: number;
  }> {
    // In production: analyze recent transactions in the area
    return Promise.resolve({
      averagePrice: 1500,
      minPrice: 1200,
      maxPrice: 1800,
      currency: 'NGN',
      sampleSize: 23,
    });
  }

  // ==================== Helper Methods ====================

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async getActiveListings(): Promise<ProductListing[]> {
    // In production: query database
    return [];
  }

  private async saveListing(listing: ProductListing): Promise<void> {
    console.log('💾 Saving listing:', listing.id);
  }

  private async notifyNearbyBuyers(listing: ProductListing): Promise<void> {
    console.log('📢 Notifying nearby buyers about:', listing.productName);
  }

  private async savePurchaseRequest(request: PurchaseRequest): Promise<void> {
    console.log('💾 Saving purchase request:', request.id);
  }

  private async incrementListingInquiries(listingId: string): Promise<void> {
    console.log('📈 Incrementing inquiries for:', listingId);
  }

  private async notifySellerNewRequest(
    sellerId: string,
    request: PurchaseRequest
  ): Promise<void> {
    console.log('🔔 Notifying seller:', sellerId, 'about new request');
  }

  private async getPurchaseRequest(requestId: string): Promise<PurchaseRequest | null> {
    // Mock implementation
    return null;
  }

  private async getListing(listingId: string): Promise<ProductListing | null> {
    // Mock implementation
    return null;
  }

  private async reserveStock(listingId: string, quantity: number): Promise<void> {
    console.log('🔒 Reserving stock:', quantity, 'for listing:', listingId);
  }

  private async sendPaymentInstructions(request: PurchaseRequest): Promise<void> {
    console.log('💳 Sending payment instructions to:', request.buyerId);
  }

  private async updateRequestStatus(
    requestId: string,
    status: PurchaseRequest['status'],
    timestamp: Date
  ): Promise<void> {
    console.log('📝 Updating request status:', requestId, status);
  }

  private async notifyBuyerResponse(
    buyerId: string,
    request: PurchaseRequest,
    status: PurchaseRequest['status'],
    counterOffer?: any
  ): Promise<void> {
    console.log('🔔 Notifying buyer:', buyerId, 'about response:', status);
  }

  private async sendNegotiationMessage(message: NegotiationMessage): Promise<void> {
    console.log('💬 Sending negotiation message:', message.id);
  }

  private async saveTransaction(transaction: TransactionRecord): Promise<void> {
    console.log('💾 Saving transaction:', transaction.id);
  }

  private async reduceListingStock(listingId: string, quantity: number): Promise<void> {
    console.log('📉 Reducing stock:', quantity, 'for listing:', listingId);
  }

  private async updateSellerStats(
    sellerId: string,
    stats: { transactionCompleted: boolean; amount: number }
  ): Promise<void> {
    console.log('📊 Updating seller stats:', sellerId);
  }

  private async updateBuyerStats(
    buyerId: string,
    stats: { transactionCompleted: boolean; amount: number }
  ): Promise<void> {
    console.log('📊 Updating buyer stats:', buyerId);
  }

  private async requestReview(
    buyerId: string,
    sellerId: string,
    transactionId: string
  ): Promise<void> {
    console.log('⭐ Requesting review for transaction:', transactionId);
  }
}

export const p2pExchangeService = new P2PStockExchangeService();
