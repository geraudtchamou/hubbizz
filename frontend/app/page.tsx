'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SearchBar } from '@/components/SearchBar';
import { BusinessCard } from '@/components/BusinessCard';
import { MapView } from '@/components/MapView';
import { businessAPI } from '@/lib/api';
import { Business, SearchFilters } from '@/lib/types';
import { MapPin, Building, MessageCircle, Star, ChevronRight } from 'lucide-react';

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    loadFeaturedBusinesses();
  }, []);

  const loadFeaturedBusinesses = async () => {
    try {
      setLoading(true);
      // Load featured/high-trust businesses
      const result = await businessAPI.search({
        min_trust_score: 70,
      });
      setBusinesses(result.businesses.slice(0, 12));
    } catch (error) {
      console.error('Failed to load businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (filters: SearchFilters) => {
    try {
      setLoading(true);
      const result = await businessAPI.search(filters);
      setBusinesses(result.businesses);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Building className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold text-gray-900">AfriHub</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/businesses" className="text-gray-600 hover:text-gray-900">
                Browse
              </Link>
              <Link href="/categories" className="text-gray-600 hover:text-gray-900">
                Categories
              </Link>
              <Link href="/sme" className="text-gray-600 hover:text-gray-900">
                For Businesses
              </Link>
              <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                Sign In
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Discover Trusted Local Businesses
            </h1>
            <p className="text-lg md:text-xl text-primary-100 max-w-2xl mx-auto">
              Find verified plumbers, electricians, restaurants, and more across Cameroon, Nigeria, Kenya, Ghana, and beyond.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Quick Stats */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold">10K+</div>
              <div className="text-primary-100 text-sm">Verified Businesses</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-primary-100 text-sm">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">8</div>
              <div className="text-primary-100 text-sm">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">4.8★</div>
              <div className="text-primary-100 text-sm">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* View Toggle */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Featured Businesses</h2>
          
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'list' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <Building size={18} />
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'map' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <MapPin size={18} />
              Map
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="h-48 bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'map' ? (
          <MapView businesses={businesses} height="h-[600px]" showUserLocation />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}

        {!loading && businesses.length === 0 && (
          <div className="text-center py-12">
            <Building className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No businesses found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Categories Section */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Categories</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { name: 'Food & Dining', icon: '🍽️' },
              { name: 'Shopping', icon: '🛍️' },
              { name: 'Services', icon: '🔧' },
              { name: 'Healthcare', icon: '🏥' },
              { name: 'Automotive', icon: '🚗' },
              { name: 'Home & Garden', icon: '🏡' },
            ].map((category) => (
              <Link
                key={category.name}
                href={`/categories/${category.name.toLowerCase().replace(/ /g, '-')}`}
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-3xl mb-2">{category.icon}</span>
                <span className="text-sm font-medium text-gray-900 text-center">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Own a Business? Join AfriHub Today
          </h2>
          <p className="text-primary-100 mb-6 max-w-2xl mx-auto">
            Get discovered by thousands of customers, manage your online presence, and grow your business with our free tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sme/register"
              className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Register Your Business
            </Link>
            <Link
              href="/sme/features"
              className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Building className="text-white" size={20} />
                </div>
                <span className="text-xl font-bold text-white">AfriHub</span>
              </div>
              <p className="text-sm">
                Trusted business directory for African SMEs. Connecting customers with verified local businesses.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/press" className="hover:text-white">Press</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/safety" className="hover:text-white">Safety</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2024 AfriHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
