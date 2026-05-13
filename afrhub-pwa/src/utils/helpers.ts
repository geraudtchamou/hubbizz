import { format, parseISO, isToday, isYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const formatCurrency = (amount: number, currency: string): string => {
  const currencySymbols: Record<string, string> = {
    XAF: 'FCFA',
    XOF: 'CFA',
    NGN: '₦',
    GHS: '₵',
    KES: 'KSh',
    TZS: 'TSh',
    ZAR: 'R',
    USD: '$',
    EUR: '€',
  };

  const symbol = currencySymbols[currency] || currency;
  return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (date: Date | string, formatStr: string = 'MMM dd, yyyy'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
};

export const formatRelativeDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(dateObj)) {
    return 'Today';
  } else if (isYesterday(dateObj)) {
    return 'Yesterday';
  } else {
    return format(dateObj, 'MMM dd, yyyy');
  }
};

export const getDateRange = (period: 'today' | 'yesterday' | 'week' | 'month' | 'custom', customStart?: Date, customEnd?: Date) => {
  const now = new Date();
  
  switch (period) {
    case 'today':
      return {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(now.setHours(23, 59, 59, 999))
      };
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: new Date(yesterday.setHours(0, 0, 0, 0)),
        end: new Date(yesterday.setHours(23, 59, 59, 999))
      };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      };
    case 'month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now)
      };
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom period requires start and end dates');
      }
      return { start: customStart, end: customEnd };
    default:
      return {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(now.setHours(23, 59, 59, 999))
      };
  }
};

export const calculateProfit = (revenue: number, cogs: number, expenses: number) => {
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  
  return {
    grossProfit,
    netProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100
  };
};

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-orange-100 text-orange-800',
    void: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getPaymentMethodIcon = (method: string): string => {
  const icons: Record<string, string> = {
    cash: '💵',
    mobile_money: '📱',
    card: '💳',
    credit: '📒',
  };
  return icons[method] || '💰';
};

// African currency formatting with locale-specific patterns
export const formatAfricanCurrency = (amount: number, currency: string, locale?: string): string => {
  const locales: Record<string, string> = {
    XAF: 'fr-CM', // French Cameroon
    XOF: 'fr-SN', // French Senegal
    NGN: 'en-NG', // English Nigeria
    GHS: 'en-GH', // English Ghana
    KES: 'en-KE', // English Kenya
    TZS: 'sw-TZ', // Swahili Tanzania
    ZAR: 'en-ZA', // English South Africa
  };

  const loc = locale || locales[currency] || 'en-US';
  
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

export default {
  formatCurrency,
  formatDate,
  formatRelativeDate,
  getDateRange,
  calculateProfit,
  generateId,
  debounce,
  truncate,
  getStatusColor,
  getPaymentMethodIcon,
  formatAfricanCurrency
};
