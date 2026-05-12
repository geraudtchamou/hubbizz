import { Business, Badge } from '@/lib/types';
import { TrustBadge } from './TrustBadge';
import { MapPin, Phone, MessageCircle, Star, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface BusinessCardProps {
  business: Business;
  compact?: boolean;
}

export const BusinessCard = ({ business, compact = false }: BusinessCardProps) => {
  const primaryImage = business.gallery.find(img => img.is_primary) || business.gallery[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Image */}
      <div className="relative h-48 bg-gray-100">
        {primaryImage ? (
          <Image
            src={primaryImage.thumbnail_url || primaryImage.url}
            alt={business.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-sm">No image</span>
          </div>
        )}
        
        {/* Verification Badge */}
        {business.is_verified && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
            <CheckCircle size={12} />
            Verified
          </div>
        )}

        {/* Trust Score Badge */}
        <div className="absolute top-2 left-2">
          <TrustBadge score={business.trust_score} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name and Category */}
        <Link href={`/business/${business.slug}`} className="block">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-1">
            {business.name}
          </h3>
        </Link>
        
        <p className="text-sm text-gray-500 mb-2">{business.category}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <Star className="text-yellow-500 fill-yellow-500" size={16} />
          <span className="font-medium text-gray-900">{business.stats.average_rating.toFixed(1)}</span>
          <span className="text-gray-500 text-sm">({business.stats.reviews_count} reviews)</span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-gray-600 text-sm mb-2">
          <MapPin size={14} />
          <span className="line-clamp-1">{business.location.city}, {business.location.country}</span>
        </div>

        {/* Badges */}
        {business.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {business.badges.slice(0, 3).map((badge: Badge) => (
              <span
                key={badge.id}
                className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full"
                title={badge.description}
              >
                {badge.name}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {!compact && (
          <div className="flex gap-2 mt-3">
            {business.contact.whatsapp && (
              <a
                href={`https://wa.me/${business.contact.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors touch-target"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            )}
            
            <a
              href={`tel:${business.contact.phone}`}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors touch-target"
            >
              <Phone size={16} />
              Call
            </a>
          </div>
        )}

        {/* Operating Status */}
        {business.operating_hours && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <OpenNowStatus hours={business.operating_hours} />
          </div>
        )}
      </div>
    </div>
  );
};

const OpenNowStatus = ({ hours }: { hours: any }) => {
  const isOpenNow = () => {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'lowercase' }) as keyof typeof hours;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayHours = hours[day];
    if (!todayHours || todayHours.length === 0) return false;

    return todayHours.some((range: any) => {
      const [openHour, openMin] = range.open.split(':').map(Number);
      const [closeHour, closeMin] = range.close.split(':').map(Number);
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    });
  };

  const open = isOpenNow();

  return (
    <div className={`flex items-center gap-1 text-sm ${open ? 'text-green-600' : 'text-red-600'}`}>
      <Clock size={14} />
      <span className="font-medium">{open ? 'Open now' : 'Closed'}</span>
    </div>
  );
};
