import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Store, CurrencyCode } from '../types';

interface AppState {
  // User & Authentication
  currentUser: User | null;
  currentStore: Store | null;
  isAuthenticated: boolean;
  
  // Settings
  currency: CurrencyCode;
  language: 'en' | 'fr' | 'pt' | 'sw';
  isDarkMode: boolean;
  
  // UI State
  sidebarOpen: boolean;
  activeTab: string;
  
  // Offline Status
  isOnline: boolean;
  pendingSyncCount: number;
  
  // Actions
  setUser: (user: User | null) => void;
  setStore: (store: Store | null) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setLanguage: (lang: 'en' | 'fr' | 'pt' | 'sw') => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  updateOnlineStatus: (isOnline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentUser: null,
      currentStore: null,
      isAuthenticated: false,
      currency: 'XAF',
      language: 'en',
      isDarkMode: false,
      sidebarOpen: true,
      activeTab: 'dashboard',
      isOnline: navigator.onLine,
      pendingSyncCount: 0,

      // Actions
      setUser: (user) => set({ 
        currentUser: user, 
        isAuthenticated: !!user 
      }),
      
      setStore: (store) => set({ currentStore: store }),
      
      setCurrency: (currency) => set({ currency }),
      
      setLanguage: (language) => set({ language }),
      
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      
      setActiveTab: (activeTab) => set({ activeTab }),
      
      updateOnlineStatus: (isOnline) => set({ isOnline }),
      
      setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
      
      logout: () => set({
        currentUser: null,
        currentStore: null,
        isAuthenticated: false,
        activeTab: 'dashboard'
      })
    }),
    {
      name: 'afrhub-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currency: state.currency,
        language: state.language,
        isDarkMode: state.isDarkMode,
        // Don't persist auth state - require re-login
        currentUser: null,
        isAuthenticated: false
      })
    }
  )
);

// Hook for online/offline detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().updateOnlineStatus(true);
  });
  
  window.addEventListener('offline', () => {
    useAppStore.getState().updateOnlineStatus(false);
  });
}

export default useAppStore;
