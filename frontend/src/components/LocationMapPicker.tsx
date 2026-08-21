import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
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
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
  showDuplicateRadius?: boolean;
}

export const LocationMapPicker: React.FC<MapPickerProps> = ({
  initialLat = 20.0059,
  initialLng = 73.7898,
  onLocationSelect,
  interactive = true,
  showDuplicateRadius = false
}) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  useEffect(() => {
    if (initialLat && initialLng) {
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

  return (
    <div className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-gray-200 shadow-xs relative bg-white">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={position} icon={customIcon}>
          <Popup>
            <div className="text-xs font-semibold text-gray-900">
              Selected Complaint Location<br />
              <span className="font-mono text-[10px] text-gray-500">
                {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </span>
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
        <div className="absolute bottom-2 left-2 right-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] text-emerald-700 font-semibold z-[400] text-center shadow-sm">
          📍 Tap anywhere on the map to mark or adjust the exact complaint pin location.
        </div>
      )}
    </div>
  );
};

export default LocationMapPicker;
