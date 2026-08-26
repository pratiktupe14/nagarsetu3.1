import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix standard Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// MapController: Auto-center and invalidateSize when position updates
function MapController({ center, zoom = 16 }: { center: [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true });
      const timer = setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [center[0], center[1], zoom, map]);

  return null;
}

function MapClickEvents({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelectLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapPickerProps {
  initialLat?: number;
  initialLng?: number;
  accuracyMeters?: number | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
  showDuplicateRadius?: boolean;
  accuracyStatusText?: string | null;
}

export const LocationMapPicker: React.FC<MapPickerProps> = ({
  initialLat = 20.0059,
  initialLng = 73.7898,
  accuracyMeters = null,
  onLocationSelect,
  interactive = true,
  showDuplicateRadius = false,
  accuracyStatusText = null
}) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (initialLat != null && initialLng != null && !isNaN(initialLat) && !isNaN(initialLng)) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  const handleSelect = (lat: number, lng: number) => {
    if (!interactive) return;
    setPosition([lat, lng]);
    if (onLocationSelect) {
      onLocationSelect(lat, lng);
    }
  };

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          handleSelect(latLng.lat, latLng.lng);
        }
      },
    }),
    [interactive]
  );

  return (
    <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-gray-200 shadow-xs relative bg-white">
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapController center={position} zoom={16} />

        {/* GPS Accuracy Circle */}
        {accuracyMeters && accuracyMeters > 0 && (
          <Circle
            center={position}
            radius={accuracyMeters}
            pathOptions={{ color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.15, weight: 1.5 }}
          />
        )}

        {/* Selected Location Marker (Draggable) */}
        <Marker
          position={position}
          icon={customIcon}
          draggable={interactive}
          eventHandlers={eventHandlers}
          ref={markerRef}
        >
          <Popup>
            <div className="text-xs font-semibold text-gray-900 font-sans">
              📍 Selected Complaint Location<br />
              <span className="font-mono text-[10px] text-emerald-700 font-bold block pt-0.5">
                {position[0].toFixed(6)}, {position[1].toFixed(6)}
              </span>
              {interactive && (
                <span className="text-[10px] text-gray-400 block pt-0.5 font-normal">
                  (Drag pin or tap map to adjust)
                </span>
              )}
            </div>
          </Popup>
        </Marker>

        {showDuplicateRadius && (
          <Circle
            center={position}
            radius={100}
            pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.15 }}
          />
        )}

        {interactive && <MapClickEvents onSelectLocation={handleSelect} />}
      </MapContainer>

      {interactive && (
        <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] text-emerald-800 font-semibold z-[400] text-center shadow-xs flex items-center justify-between">
          <span className="truncate">📍 Tap anywhere on map or drag pin to adjust location</span>
          {accuracyStatusText && (
            <span className="ml-2 font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
              {accuracyStatusText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationMapPicker;
