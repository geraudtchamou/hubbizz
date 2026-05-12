'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Business } from '@/lib/types';
import { MAP_SETTINGS } from '@/lib/config';
import { MapPin, Navigation } from 'lucide-react';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  businesses: Business[];
  center?: [number, number];
  zoom?: number;
  onBusinessClick?: (business: Business) => void;
  height?: string;
  showUserLocation?: boolean;
}

export const MapView = ({
  businesses,
  center = MAP_SETTINGS.DEFAULT_CENTER,
  zoom = MAP_SETTINGS.DEFAULT_ZOOM,
  onBusinessClick,
  height = 'h-96',
  showUserLocation = false,
}: MapViewProps) => {
  const [map, setMap] = useState<L.Map | null>(null);
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Initialize map
    const mapInstance = L.map(`map-${Date.now()}`, {
      center,
      zoom,
      minZoom: MAP_SETTINGS.MIN_ZOOM,
      maxZoom: MAP_SETTINGS.MAX_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    // Add OpenStreetMap tiles (optimized for low-bandwidth)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
      className: 'leaflet-tile-animated',
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  // Get user location
  useEffect(() => {
    if (showUserLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          
          if (map) {
            L.circleMarker(loc, {
              radius: 8,
              fillColor: '#3b82f6',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8,
            }).addTo(map).bindPopup('Your location');
          }
        },
        (error) => {
          console.warn('Error getting location:', error);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }, [showUserLocation, map]);

  // Update markers when businesses change
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach((marker) => map.removeLayer(marker));
    setMarkers([]);

    // Add new markers with clustering for performance
    const newMarkers: L.Marker[] = [];

    businesses.forEach((business) => {
      const marker = L.marker([
        business.location.coordinates.latitude,
        business.location.coordinates.longitude,
      ]).addTo(map);

      // Custom popup content
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-semibold text-lg">${business.name}</h3>
          <p class="text-sm text-gray-600">${business.category}</p>
          ${business.trust_score ? `<div class="mt-1"><span class="text-xs px-2 py-1 rounded-full ${
            business.trust_score >= 80 ? 'bg-green-100 text-green-800' :
            business.trust_score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
          }">Trust: ${business.trust_score}</span></div>` : ''}
          <p class="text-sm mt-2">${business.location.city}, ${business.location.country}</p>
        </div>
      `;

      marker.bindPopup(popupContent);

      if (onBusinessClick) {
        marker.on('click', () => onBusinessClick(business));
      }

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);

    // Fit bounds if there are businesses
    if (businesses.length > 0) {
      const group = new L.featureGroup(newMarkers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [businesses, map, onBusinessClick]);

  return (
    <div className={`relative w-full ${height} bg-gray-100 rounded-lg overflow-hidden`}>
      <div id={`map-${Date.now()}`} className="w-full h-full" />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        <button
          onClick={() => {
            if (userLocation && map) {
              map.flyTo(userLocation, 14);
            }
          }}
          disabled={!userLocation}
          className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 disabled:opacity-50 touch-target"
          title="My location"
        >
          <Navigation size={20} className="text-blue-600" />
        </button>
      </div>

      {/* Business Count Badge */}
      <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md z-[1000]">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-primary-600" />
          <span className="text-sm font-medium">{businesses.length} businesses</span>
        </div>
      </div>

      {/* Loading State */}
      {!map && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};
