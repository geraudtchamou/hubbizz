'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, Filter, X } from 'lucide-react';
import { SearchFilters } from '@/lib/types';
import { useDebounce, useGeolocation } from '@/lib/hooks';
import { businessAPI } from '@/lib/api';

interface SearchBarProps {
  onSearch?: (filters: SearchFilters) => void;
  initialQuery?: string;
  showFilters?: boolean;
}

export const SearchBar = ({ onSearch, initialQuery = '', showFilters = true }: SearchBarProps) => {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isUsingLocation, setIsUsingLocation] = useState(true);
  
  const debouncedQuery = useDebounce(query, 500); // 500ms debounce for low-bandwidth
  const { location } = useGeolocation();

  const categories = [
    'All',
    'Food & Restaurants',
    'Shopping',
    'Services',
    'Healthcare',
    'Automotive',
    'Home & Garden',
    'Professional Services',
    'Entertainment',
    'Education',
  ];

  useEffect(() => {
    if (onSearch) {
      const filters: SearchFilters = {
        query: debouncedQuery || undefined,
        category: category !== 'All' ? category : undefined,
        location: isUsingLocation && location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          radius_km: 10,
        } : undefined,
      };
      
      onSearch(filters);
    }
  }, [debouncedQuery, category, location, isUsingLocation, onSearch]);

  const handleClear = () => {
    setQuery('');
    setCategory('');
  };

  return (
    <div className="w-full">
      {/* Main Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search businesses, services, products..."
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent touch-target"
            aria-label="Search"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`px-4 py-3 border rounded-lg flex items-center gap-2 touch-target ${
              showFilterPanel ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-300'
            }`}
            aria-label="Toggle filters"
          >
            <Filter size={20} />
            <span className="hidden sm:inline">Filters</span>
          </button>
        )}
      </div>

      {/* Location Toggle */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setIsUsingLocation(!isUsingLocation)}
          className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition-colors ${
            isUsingLocation 
              ? 'bg-primary-100 text-primary-700' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          <MapPin size={14} />
          {isUsingLocation ? 'Using current location' : 'Location disabled'}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && showFilters && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm animate-in slide-in-from-top-2">
          <div className="space-y-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat === 'All' ? '' : cat)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      (cat === 'All' && !category) || category === cat
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional filters can be added here */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Verified only
                </label>
                
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Open now
                </label>
                
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  High trust (80+)
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
