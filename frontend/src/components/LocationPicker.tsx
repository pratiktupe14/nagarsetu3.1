import React, { useState, useEffect } from 'react';
import type { LatLng } from '../types/maps';
import { NagarSetuMap, DEFAULT_NAGARSETU_CENTER } from './NagarSetuMap';
import { Navigation, MapPin, CheckCircle2 } from 'lucide-react';
import '../styles/nagarsetu-maps.css';

export type LocationPickerProps = {
  initialPosition?: LatLng;
  onChange: (position: LatLng) => void;
  height?: string;
};

export function LocationPicker({
  initialPosition = DEFAULT_NAGARSETU_CENTER,
  onChange,
  height = '420px',
}: LocationPickerProps) {
  const [selectedPosition, setSelectedPosition] = useState<LatLng>(initialPosition);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState<boolean>(false);

  useEffect(() => {
    if (
      initialPosition &&
      !isNaN(initialPosition.lat) &&
      !isNaN(initialPosition.lng) &&
      (initialPosition.lat !== selectedPosition.lat || initialPosition.lng !== selectedPosition.lng)
    ) {
      setSelectedPosition(initialPosition);
    }
  }, [initialPosition.lat, initialPosition.lng]);

  const handleMapLocationSelect = (position: LatLng) => {
    setSelectedPosition(position);
    setError(null);
    onChange(position);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        handleMapLocationSelect({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (geolocationError) => {
        setLocating(false);
        setError(
          geolocationError.message ||
            'Unable to access your current location. Please select it on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  return (
    <div className="w-full space-y-2">
      <div className="nagarsetu-location-toolbar">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="disabled:opacity-60"
        >
          <Navigation className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
          <span>{locating ? 'Detecting GPS...' : 'Use my current location'}</span>
        </button>

        <span className="flex items-center space-x-1.5 text-xs font-mono font-bold text-gray-800 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
          </span>
        </span>
      </div>

      {error && <p className="nagarsetu-location-error">{error}</p>}

      <NagarSetuMap
        center={selectedPosition}
        selectedPosition={selectedPosition}
        enableLocationPicker
        onMapLocationSelect={handleMapLocationSelect}
        height={height}
      />
    </div>
  );
}

export default LocationPicker;
