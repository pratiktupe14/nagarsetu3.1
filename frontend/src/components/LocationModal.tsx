import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LocationMapPicker } from './LocationMapPicker';
import { MapPin, Navigation, X, CheckCircle2, Cpu } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  locationSource?: 'live_gps' | 'exif_gps' | 'manual_pin' | 'geocoded' | 'geocode_failed' | 'unavailable' | 'gps';
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  title,
  address,
  latitude,
  longitude,
  locationSource
}) => {
  if (!isOpen) return null;

  const sourceLabel = locationSource === 'live_gps' ? 'Live GPS Location' : locationSource === 'exif_gps' ? 'Photo EXIF GPS' : 'Manual Pin Drop';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
      <div className="max-w-2xl w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-xl space-y-4">
        
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-lg font-extrabold text-gray-900 font-outfit flex items-center space-x-1.5">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>Location Details</span>
            </h3>
            <p className="text-xs text-gray-500">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ADDRESS & COORDINATES */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900">{address || 'Municipal Area'}</span>
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{sourceLabel}</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-600 font-mono text-[11px] pt-1 border-t border-gray-200">
            <span>Coordinates:</span>
            <span className="font-bold text-gray-900">{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
          </div>
        </div>

        {/* INTERACTIVE LEAFLET MAP */}
        <div className="rounded-xl overflow-hidden border border-gray-200 h-64">
          <LocationMapPicker
            initialLat={latitude}
            initialLng={longitude}
            interactive={false}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-between pt-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center space-x-1.5 min-h-[44px]"
          >
            <Navigation className="w-4 h-4" />
            <span>Open in External Maps</span>
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs min-h-[44px]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
