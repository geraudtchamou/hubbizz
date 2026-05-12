'use client';

import { useEffect, useState, useCallback } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export const useGeolocation = () => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: false, // Save battery and data
        timeout: 10000,
        maximumAge: 300000, // Use cached location up to 5 minutes old
      }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  return { location, error, loading, refetch: getLocation };
};

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
};

export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useTrustScore = (business: any) => {
  const [scoreColor, setScoreColor] = useState<'green' | 'yellow' | 'red'>('green');
  const [scoreLabel, setScoreLabel] = useState<string>('');

  useEffect(() => {
    if (!business?.trust_score) {
      setScoreColor('yellow');
      setScoreLabel('No score');
      return;
    }

    const score = business.trust_score;

    if (score >= 80) {
      setScoreColor('green');
      setScoreLabel('High Trust');
    } else if (score >= 50) {
      setScoreColor('yellow');
      setScoreLabel('Medium Trust');
    } else {
      setScoreColor('red');
      setScoreLabel('Low Trust');
    }
  }, [business?.trust_score]);

  return { scoreColor, scoreLabel };
};

export const useImageOptimizer = (url: string, width?: number, height?: number) => {
  const [optimizedUrl, setOptimizedUrl] = useState(url);

  useEffect(() => {
    if (!url) return;

    // Simple optimization: add query params for image CDNs
    const separator = url.includes('?') ? '&' : '?';
    const params = [];
    
    if (width) params.push(`w=${width}`);
    if (height) params.push(`h=${height}`);
    params.push('q=75'); // Quality
    params.push('fm=webp'); // Format
    
    setOptimizedUrl(`${url}${separator}${params.join('&')}`);
  }, [url, width, height]);

  return optimizedUrl;
};

export const useNetworkQuality = () => {
  const [connectionInfo, setConnectionInfo] = useState<{
    effectiveType: string;
    saveData: boolean;
    downlink: number;
  } | null>(null);

  useEffect(() => {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      setConnectionInfo({
        effectiveType: conn.effectiveType,
        saveData: conn.saveData,
        downlink: conn.downlink,
      });

      const handleChange = () => {
        setConnectionInfo({
          effectiveType: conn.effectiveType,
          saveData: conn.saveData,
          downlink: conn.downlink,
        });
      };

      conn.addEventListener('change', handleChange);
      return () => conn.removeEventListener('change', handleChange);
    }
  }, []);

  return connectionInfo;
};
