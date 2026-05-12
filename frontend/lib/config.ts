// API configuration for low-bandwidth environments
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_TIMEOUT = 10000; // 10s timeout for 3G networks

// Cache durations (in seconds)
export const CACHE_DURATIONS = {
  BUSINESS_LISTINGS: 300, // 5 minutes
  MAP_TILES: 86400, // 24 hours
  USER_PROFILE: 600, // 10 minutes
  SEARCH_RESULTS: 120, // 2 minutes
};

// Image optimization settings
export const IMAGE_SETTINGS = {
  MAX_WIDTH: 800,
  MAX_HEIGHT: 600,
  QUALITY: 75,
  FORMAT: 'webp',
};

// Map settings optimized for Africa
export const MAP_SETTINGS = {
  DEFAULT_CENTER: [4.0511, 9.7679] as [number, number], // Cameroon center
  DEFAULT_ZOOM: 6,
  MAX_ZOOM: 18,
  MIN_ZOOM: 3,
  CLUSTER_RADIUS: 50,
};

// WhatsApp integration
export const WHATSAPP_SETTINGS = {
  BASE_URL: 'https://wa.me/',
  BUSINESS_API_URL: 'https://graph.facebook.com/v18.0',
};

// Payment gateway settings
export const PAYMENT_SETTINGS = {
  FLUTTERWAVE_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUTTERWAVE_KEY,
  PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_KEY,
  CURRENCY: 'XAF', // Central African CFA franc (default)
  SUPPORTED_CURRENCIES: ['XAF', 'NGN', 'KES', 'GHS', 'XOF'],
};

// Trust score thresholds
export const TRUST_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 0,
};

// Offline-first settings
export const OFFLINE_SETTINGS = {
  ENABLED: true,
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  CACHE_VERSION: 'v1',
};

// Feature flags for gradual rollout
export const FEATURE_FLAGS = {
  AI_FRAUD_DETECTION: true,
  ESCROW_PAYMENTS: false,
  B2B_RFQ: true,
  DELIVERY_TRACKING: true,
  MICRO_LOANS: false,
};
