// TypeScript types for AfriHub entities

export interface User {
  id: string;
  email?: string;
  phone: string;
  full_name: string;
  avatar_url?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  subcategory?: string;
  location: Location;
  contact: ContactInfo;
  gallery: MediaItem[];
  trust_score: number;
  badges: Badge[];
  is_verified: boolean;
  verification_level: VerificationLevel;
  payment_methods: PaymentMethod[];
  operating_hours?: OperatingHours;
  social_links?: SocialLinks;
  stats: BusinessStats;
  created_at: string;
  updated_at: string;
}

export interface Location {
  address: string;
  city: string;
  region: string;
  country: string;
  postal_code?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  plus_code?: string;
}

export interface ContactInfo {
  phone: string;
  whatsapp?: string;
  email?: string;
  website?: string;
}

export interface MediaItem {
  id: string;
  url: string;
  thumbnail_url?: string;
  type: 'image' | 'video';
  caption?: string;
  is_primary: boolean;
  size_bytes?: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earned_at: string;
}

export type VerificationLevel = 'none' | 'basic' | 'enhanced' | 'premium';

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'bank_transfer';

export interface OperatingHours {
  monday?: TimeRange[];
  tuesday?: TimeRange[];
  wednesday?: TimeRange[];
  thursday?: TimeRange[];
  friday?: TimeRange[];
  saturday?: TimeRange[];
  sunday?: TimeRange[];
}

export interface TimeRange {
  open: string; // HH:mm format
  close: string; // HH:mm format
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
}

export interface BusinessStats {
  views: number;
  leads: number;
  reviews_count: number;
  average_rating: number;
  response_time_hours?: number;
  completion_rate?: number;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  currency: string;
  images: MediaItem[];
  stock_quantity?: number;
  is_available: boolean;
  variants?: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price_adjustment: number;
  stock_quantity?: number;
}

export interface Review {
  id: string;
  business_id: string;
  user_id: string;
  rating: number; // 1-5
  title?: string;
  comment: string;
  images?: MediaItem[];
  response?: ReviewResponse;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewResponse {
  comment: string;
  responded_at: string;
  responder_id: string;
}

export interface Lead {
  id: string;
  business_id: string;
  user_id: string;
  type: 'whatsapp' | 'call' | 'email' | 'quote_request';
  status: 'new' | 'contacted' | 'converted' | 'lost';
  message?: string;
  contact_info?: ContactInfo;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: PaymentMethod;
  gateway: 'flutterwave' | 'paystack' | 'manual';
  gateway_transaction_id?: string;
  items: TransactionItem[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Verification {
  id: string;
  business_id: string;
  type: 'phone' | 'email' | 'document' | 'address' | 'social';
  status: 'pending' | 'verified' | 'rejected';
  document_url?: string;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius_km?: number;
  };
  min_trust_score?: number;
  is_verified?: boolean;
  is_open_now?: boolean;
  has_delivery?: boolean;
  payment_methods?: PaymentMethod[];
  min_rating?: number;
  price_range?: {
    min: number;
    max: number;
  };
}

export interface SearchResult {
  businesses: Business[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface AnalyticsEvent {
  id: string;
  business_id: string;
  event_type: 'view' | 'click' | 'lead' | 'conversion';
  user_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DashboardMetrics {
  views: number;
  views_change: number;
  leads: number;
  leads_change: number;
  conversions: number;
  conversions_change: number;
  revenue: number;
  revenue_change: number;
  top_products: Product[];
  recent_leads: Lead[];
  review_summary: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: Record<number, number>;
  };
}

export interface AIInsight {
  type: 'recommendation' | 'alert' | 'opportunity';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  action_url?: string;
  created_at: string;
}

export interface B2BRFQ {
  id: string;
  buyer_id: string;
  supplier_ids: string[];
  title: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  target_price?: number;
  currency: string;
  deadline: string;
  status: 'open' | 'in_negotiation' | 'closed' | 'cancelled';
  responses: RFQResponse[];
  created_at: string;
  updated_at: string;
}

export interface RFQResponse {
  id: string;
  rfq_id: string;
  supplier_id: string;
  quote_price: number;
  currency: string;
  delivery_time_days: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DeliveryOrder {
  id: string;
  transaction_id: string;
  pickup_location: Location;
  delivery_location: Location;
  rider_id?: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  tracking_url?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  created_at: string;
  updated_at: string;
}
