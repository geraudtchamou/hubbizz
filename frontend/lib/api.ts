import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL, API_TIMEOUT, CACHE_DURATIONS } from './config';
import {
  Business,
  Product,
  Review,
  Lead,
  SearchResult,
  SearchFilters,
  DashboardMetrics,
  User,
} from './types';

// IndexedDB for offline storage
let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open('AfriHubCache', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains('businesses')) {
        const businessStore = database.createObjectStore('businesses', { keyPath: 'id' });
        businessStore.createIndex('category', 'category', { unique: false });
        businessStore.createIndex('location_city', 'location.city', { unique: false });
      }

      if (!database.objectStoreNames.contains('searchResults')) {
        const searchStore = database.createObjectStore('searchResults', { keyPath: 'key' });
      }
    };
  });
};

const cacheData = async (storeName: string, key: string, data: any, ttl: number) => {
  try {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const item = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

const getCachedData = async <T>(storeName: string, key: string): Promise<T | null> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const item = request.result;
        if (item && Date.now() - item.timestamp < item.ttl * 1000) {
          resolve(item.data as T);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Failed to get cached data:', error);
    return null;
  }
};

// API client with retry logic for unstable networks
class ApiClient {
  private client: AxiosInstance;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        config.headers['X-Client-Version'] = '1.0.0';
        config.headers['X-Low-Bandwidth'] = navigator.connection?.saveData ? 'true' : 'false';
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        
        if (!originalRequest) {
          return Promise.reject(error);
        }

        const retryCount = (originalRequest as any)._retryCount || 0;

        if (retryCount >= this.maxRetries) {
          return Promise.reject(error);
        }

        if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
          (originalRequest as any)._retryCount = retryCount + 1;
          const delay = this.retryDelay * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const api = new ApiClient();

// Business API
export const businessAPI = {
  async search(filters: SearchFilters): Promise<SearchResult> {
    const cacheKey = `search:${JSON.stringify(filters)}`;
    
    // Try cache first
    const cached = await getCachedData<SearchResult>('searchResults', cacheKey);
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams();
    if (filters.query) params.append('q', filters.query);
    if (filters.category) params.append('category', filters.category);
    if (filters.location) {
      params.append('lat', filters.location.latitude.toString());
      params.append('lng', filters.location.longitude.toString());
      if (filters.location.radius_km) {
        params.append('radius', filters.location.radius_km.toString());
      }
    }
    if (filters.min_trust_score) params.append('min_trust', filters.min_trust_score.toString());
    if (filters.is_verified !== undefined) params.append('verified', filters.is_verified.toString());
    if (filters.is_open_now) params.append('open_now', 'true');
    if (filters.min_rating) params.append('min_rating', filters.min_rating.toString());

    const result = await api.get<SearchResult>(`/api/v1/businesses/search?${params.toString()}`);
    
    // Cache the result
    await cacheData('searchResults', cacheKey, result, CACHE_DURATIONS.SEARCH_RESULTS);
    
    return result;
  },

  async getById(id: string): Promise<Business> {
    const cached = await getCachedData<Business>('businesses', id);
    if (cached) {
      return cached;
    }

    const business = await api.get<Business>(`/api/v1/businesses/${id}`);
    await cacheData('businesses', id, business, CACHE_DURATIONS.BUSINESS_LISTINGS);
    
    return business;
  },

  async getBySlug(slug: string): Promise<Business> {
    return api.get<Business>(`/api/v1/businesses/slug/${slug}`);
  },

  async create(business: Partial<Business>): Promise<Business> {
    return api.post<Business>('/api/v1/businesses', business);
  },

  async update(id: string, business: Partial<Business>): Promise<Business> {
    const result = await api.put<Business>(`/api/v1/businesses/${id}`, business);
    // Invalidate cache
    await cacheData('businesses', id, result, 0);
    return result;
  },

  async getNearby(lat: number, lng: number, radiusKm = 5): Promise<Business[]> {
    const result = await api.get<{ businesses: Business[] }>(
      `/api/v1/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`
    );
    return result.businesses;
  },
};

// Product API
export const productAPI = {
  async getByBusiness(businessId: string): Promise<Product[]> {
    return api.get<Product[]>(`/api/v1/businesses/${businessId}/products`);
  },

  async getById(id: string): Promise<Product> {
    return api.get<Product>(`/api/v1/products/${id}`);
  },

  async create(product: Partial<Product>): Promise<Product> {
    return api.post<Product>('/api/v1/products', product);
  },

  async update(id: string, product: Partial<Product>): Promise<Product> {
    return api.put<Product>(`/api/v1/products/${id}`, product);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/v1/products/${id}`);
  },
};

// Review API
export const reviewAPI = {
  async getByBusiness(businessId: string, page = 1): Promise<{ reviews: Review[]; total: number }> {
    return api.get(`/api/v1/businesses/${businessId}/reviews?page=${page}`);
  },

  async create(review: Partial<Review>): Promise<Review> {
    return api.post<Review>('/api/v1/reviews', review);
  },

  async update(id: string, review: Partial<Review>): Promise<Review> {
    return api.put<Review>(`/api/v1/reviews/${id}`, review);
  },

  async respond(reviewId: string, response: string): Promise<Review> {
    return api.post<Review>(`/api/v1/reviews/${reviewId}/respond`, { response });
  },
};

// Lead API
export const leadAPI = {
  async create(lead: Partial<Lead>): Promise<Lead> {
    return api.post<Lead>('/api/v1/leads', lead);
  },

  async createWhatsAppLead(businessId: string, userId: string, message?: string): Promise<Lead> {
    return this.create({
      business_id: businessId,
      user_id: userId,
      type: 'whatsapp',
      message,
      status: 'new',
    });
  },

  async updateStatus(id: string, status: Lead['status']): Promise<Lead> {
    return api.put<Lead>(`/api/v1/leads/${id}`, { status });
  },
};

// Dashboard API
export const dashboardAPI = {
  async getMetrics(businessId: string): Promise<DashboardMetrics> {
    return api.get<DashboardMetrics>(`/api/v1/dashboard/${businessId}/metrics`);
  },

  async getLeads(businessId: string): Promise<Lead[]> {
    return api.get<Lead[]>(`/api/v1/dashboard/${businessId}/leads`);
  },

  async getAnalytics(businessId: string, days = 30): Promise<any> {
    return api.get(`/api/v1/dashboard/${businessId}/analytics?days=${days}`);
  },
};

// User API
export const userAPI = {
  async getProfile(): Promise<User> {
    return api.get<User>('/api/v1/users/me');
  },

  async updateProfile(profile: Partial<User>): Promise<User> {
    return api.put<User>('/api/v1/users/me', profile);
  },

  async verifyPhone(phone: string, code: string): Promise<{ success: boolean }> {
    return api.post('/api/v1/users/verify-phone', { phone, code });
  },
};

// WhatsApp integration helper
export const openWhatsAppChat = (phone: string, message?: string) => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  let url = `https://wa.me/${cleanPhone}`;
  
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  
  window.open(url, '_blank');
};

// Generate WhatsApp message for quote requests
export const generateQuoteMessage = (businessName: string, productName?: string) => {
  let message = `Hello ${businessName}, I found you on AfriHub and would like to request a quote.`;
  
  if (productName) {
    message += `\n\nI'm interested in: ${productName}`;
  }
  
  message += '\n\nPlease send me pricing and availability information.';
  
  return message;
};
