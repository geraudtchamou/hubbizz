/**
 * Universal Mobile Money Aggregator
 * Supports: M-Pesa, MTN MoMo, Airtel Money, Orange Money, Wave
 * Features: USSD push, offline QR generation, payment status polling
 */

export type MobileMoneyProvider = 
  | 'MPESA'      // Kenya, Tanzania
  | 'MTN_MOMO'   // West/Central Africa
  | 'AIRTEL_MONEY' // Pan-African
  | 'ORANGE_MONEY' // West/Central Africa
  | 'WAVE'       // Senegal, Ivory Coast
  | 'CASH';

interface ProviderConfig {
  id: MobileMoneyProvider;
  name: string;
  color: string;
  logo: string;
  countries: string[];
  ussdCode: string;
  minAmount: number;
  maxAmount: number;
  currency: string;
}

const PROVIDERS: Record<MobileMoneyProvider, ProviderConfig> = {
  MPESA: {
    id: 'MPESA',
    name: 'M-Pesa',
    color: '#4CAF50',
    logo: '🟢',
    countries: ['KE', 'TZ', 'CD', 'EG'],
    ussdCode: '*234#',
    minAmount: 1,
    maxAmount: 150000,
    currency: 'KES'
  },
  MTN_MOMO: {
    id: 'MTN_MOMO',
    name: 'MTN MoMo',
    color: '#FFCC00',
    logo: '🟡',
    countries: ['NG', 'GH', 'UG', 'RW', 'CM', 'CI', 'BJ', 'ZM'],
    ussdCode: '*556#',
    minAmount: 10,
    maxAmount: 1000000,
    currency: 'NGN'
  },
  AIRTEL_MONEY: {
    id: 'AIRTEL_MONEY',
    name: 'Airtel Money',
    color: '#FF0000',
    logo: '🔴',
    countries: ['NG', 'KE', 'UG', 'TZ', 'RW', 'MW', 'ZM', 'CG', 'CD'],
    ussdCode: '*544#',
    minAmount: 10,
    maxAmount: 500000,
    currency: 'NGN'
  },
  ORANGE_MONEY: {
    id: 'ORANGE_MONEY',
    name: 'Orange Money',
    color: '#FF7900',
    logo: '🟠',
    countries: ['SN', 'ML', 'BF', 'NE', 'TD', 'CM', 'CI', 'GN', 'MDG'],
    ussdCode: '#144#',
    minAmount: 50,
    maxAmount: 500000,
    currency: 'XOF'
  },
  WAVE: {
    id: 'WAVE',
    name: 'Wave',
    color: '#0066FF',
    logo: '🔵',
    countries: ['SN', 'CI'],
    ussdCode: '*144#',
    minAmount: 100,
    maxAmount: 300000,
    currency: 'XOF'
  },
  CASH: {
    id: 'CASH',
    name: 'Cash',
    color: '#808080',
    logo: '💵',
    countries: [],
    ussdCode: '',
    minAmount: 0,
    maxAmount: Infinity,
    currency: 'ANY'
  }
};

export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  reference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  updatedAt?: Date;
  transactionId?: string;
  errorMessage?: string;
}

class MobileMoneyService {
  private pendingPayments: Map<string, PaymentRequest> = new Map();
  private countryCache: string | null = null;

  /**
   * Detect user's country and return available providers
   */
  getAvailableProviders(countryCode?: string): ProviderConfig[] {
    const country = countryCode || this.detectCountry();
    return Object.values(PROVIDERS).filter(
      p => p.countries.length === 0 || p.countries.includes(country)
    );
  }

  /**
   * Detect country from timezone or IP (simplified for demo)
   */
  private detectCountry(): string {
    if (this.countryCache) return this.countryCache;
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const countryMap: Record<string, string> = {
      'Africa/Lagos': 'NG',
      'Africa/Nairobi': 'KE',
      'Africa/Dar_es_Salaam': 'TZ',
      'Africa/Accra': 'GH',
      'Africa/Dakar': 'SN',
      'Africa/Abidjan': 'CI',
      'Africa/Douala': 'CM',
      'Africa/Kampala': 'UG',
      'Africa/Kigali': 'RW'
    };
    
    this.countryCache = countryMap[timezone] || 'NG';
    return this.countryCache;
  }

  /**
   * Initiate mobile money payment via USSD push
   */
  async initiatePayment(request: Omit<PaymentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<PaymentRequest> {
    const provider = PROVIDERS[request.provider];
    
    // Validate amount
    if (request.amount < provider.minAmount || request.amount > provider.maxAmount) {
      throw new Error(`Amount must be between ${provider.minAmount} and ${provider.maxAmount} ${provider.currency}`);
    }

    // Validate phone number format
    if (!this.validatePhoneNumber(request.phoneNumber, provider.countries[0])) {
      throw new Error('Invalid phone number format');
    }

    const payment: PaymentRequest = {
      ...request,
      id: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'PENDING',
      createdAt: new Date()
    };

    this.pendingPayments.set(payment.id, payment);

    // In production: Call backend API to initiate USSD push
    // For now: Simulate with timeout
    setTimeout(() => this.pollPaymentStatus(payment.id), 2000);

    return payment;
  }

  /**
   * Generate offline QR code for payment
   * Customer can scan later when they have signal
   */
  generateOfflineQR(payment: PaymentRequest): string {
    const qrData = JSON.stringify({
      type: 'MOBILE_MONEY',
      provider: payment.provider,
      amount: payment.amount,
      currency: payment.currency,
      phone: payment.phoneNumber,
      ref: payment.reference,
      merchant: window.location.hostname,
      timestamp: payment.createdAt.toISOString()
    });

    // Return data URL for QR code (in production use qrcode library)
    return `data:text/plain;base64,${btoa(qrData)}`;
  }

  /**
   * Poll payment status from backend
   */
  private async pollPaymentStatus(paymentId: string) {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment) return;

    // Update status to processing
    payment.status = 'PROCESSING';
    payment.updatedAt = new Date();
    this.pendingPayments.set(paymentId, payment);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // In production: Fetch actual status from backend
    // Mock success/failure
    const success = Math.random() > 0.1; // 90% success rate simulation
    
    if (success) {
      payment.status = 'COMPLETED';
      payment.transactionId = `TXN_${Date.now()}`;
    } else {
      payment.status = 'FAILED';
      payment.errorMessage = 'Customer cancelled or insufficient funds';
    }

    payment.updatedAt = new Date();
    this.pendingPayments.set(paymentId, payment);

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('payment-status-update', { detail: payment }));
  }

  /**
   * Validate phone number for specific country
   */
  private validatePhoneNumber(phone: string, countryCode: string): boolean {
    // Simplified validation - in production use libphonenumber-js
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    const patterns: Record<string, RegExp> = {
      NG: /^(\+234|0)?[789]\d{9}$/,
      KE: /^(\+254|0)?[7]\d{8}$/,
      TZ: /^(\+255|0)?[67]\d{8}$/,
      GH: /^(\+233|0)?[25]\d{8}$/,
      SN: /^(\+221|0)?[7]\d{8}$/,
      CI: /^(\+225|0)?[0124567]\d{8}$/
    };

    const pattern = patterns[countryCode] || /^\+?\d{10,15}$/;
    return pattern.test(cleanPhone);
  }

  /**
   * Get payment by ID
   */
  getPayment(paymentId: string): PaymentRequest | undefined {
    return this.pendingPayments.get(paymentId);
  }

  /**
   * Cancel pending payment
   */
  cancelPayment(paymentId: string): boolean {
    const payment = this.pendingPayments.get(paymentId);
    if (!payment || payment.status !== 'PENDING') return false;

    payment.status = 'CANCELLED';
    payment.updatedAt = new Date();
    this.pendingPayments.set(paymentId, payment);
    
    window.dispatchEvent(new CustomEvent('payment-status-update', { detail: payment }));
    return true;
  }
}

// Singleton instance
export const mobileMoneyService = new MobileMoneyService();

// Example usage:
/*
async function processPayment() {
  try {
    const payment = await mobileMoneyService.initiatePayment({
      amount: 5000,
      currency: 'NGN',
      provider: 'MTN_MOMO',
      phoneNumber: '08012345678',
      reference: 'SALE_12345'
    });

    console.log('Payment initiated:', payment.id);
    
    // Listen for status updates
    window.addEventListener('payment-status-update', (e: any) => {
      if (e.detail.id === payment.id) {
        console.log('Payment status:', e.detail.status);
        if (e.detail.status === 'COMPLETED') {
          // Complete the sale
        }
      }
    });

    // Generate QR for offline payment
    const qrCode = mobileMoneyService.generateOfflineQR(payment);
    // Display QR code to customer
    
  } catch (error) {
    console.error('Payment failed:', error);
  }
}
*/
