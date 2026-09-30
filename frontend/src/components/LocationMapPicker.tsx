import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
import { LocationPicker } from './LocationPicker';
import { NagarSetuMap } from './NagarSetuMap';
import { isValidCoordinate, requestFreshGpsLocation } from '../services/locationService';

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
    try {
      map.invalidateSize();
    } catch (e) {}

    if (center && isValidCoordinate(center[0], center[1])) {
      map.setView(center, zoom, { animate: true });
    }

    const t1 = setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    const t2 = setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [center ? center[0] : 0, center ? center[1] : 0, zoom, map]);

  return null;
}

function MapClickEvents({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (e?.latlng && isValidCoordinate(e.latlng.lat, e.latlng.lng)) {
        onSelectLocation(e.latlng.lat, e.latlng.lng);
      }
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
  initialLat,
  initialLng,
  accuracyMeters = null,
  onLocationSelect,
  interactive = true,
  showDuplicateRadius = false,
  accuracyStatusText = null
}) => {
  const [position, setPosition] = useState<[number, number] | null>(() => {
    if (isValidCoordinate(initialLat, initialLng)) {
      return [Number(initialLat), Number(initialLng)];
    }
    return null;
  });
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const hasGoogleMapsKey = Boolean(
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY as string)
  );

  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>(
    hasGoogleMapsKey ? 'google' : 'leaflet'
  );

  useEffect(() => {
    if (isValidCoordinate(initialLat, initialLng)) {
      setPosition([Number(initialLat), Number(initialLng)]);
      setGpsErrorMsg(null);
    }
  }, [initialLat, initialLng]);

  const handleSelect = (lat: number, lng: number) => {
    if (!interactive) return;
    if (isValidCoordinate(lat, lng)) {
      setPosition([lat, lng]);
      if (onLocationSelect) {
        onLocationSelect(lat, lng);
      }
    }
  };

  const handleDetectLocation = async () => {
    setDetectingGps(true);
    setGpsErrorMsg(null);
    try {
      const gps = await requestFreshGpsLocation();
      if (gps && isValidCoordinate(gps.latitude, gps.longitude)) {
        setPosition([gps.latitude, gps.longitude]);
        if (onLocationSelect) {
          onLocationSelect(gps.latitude, gps.longitude);
        }
      } else {
        setGpsErrorMsg('Could not detect GPS location. Please ensure location services are enabled on your device.');
      }
    } catch (e: any) {
      setGpsErrorMsg(e?.message || 'Location permission denied or unavailable.');
    } finally {
      setDetectingGps(false);
    }
  };

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          if (latLng && isValidCoordinate(latLng.lat, latLng.lng)) {
            handleSelect(latLng.lat, latLng.lng);
          }
        }
      },
    }),
    [interactive]
  );

  const hasValidPosition = Boolean(position && isValidCoordinate(position[0], position[1]));

  return (
    <div className="w-full flex flex-col space-y-2">
      {/* Engine Switcher Bar */}
      {hasGoogleMapsKey && hasValidPosition && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="font-bold text-gray-500 text-[11px] font-outfit uppercase tracking-wider">
            Map Provider
          </span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setMapEngine('google')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all min-h-[30px] ${
                mapEngine === 'google'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Google Maps
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('leaflet')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all min-h-[30px] ${
                mapEngine === 'leaflet'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              OpenStreetMap GIS
            </button>
          </div>
        </div>
      )}

      {!hasValidPosition ? (
        <div className="w-full h-full min-h-[360px] rounded-2xl border border-gray-200 shadow-xs relative bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <MapPin className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h4 className="text-base font-extrabold text-gray-900 font-outfit">Location Pin Unavailable</h4>
            <p className="text-xs text-gray-600">
              Valid geographic coordinates are not yet available for this map. Enable your device GPS to accurately locate the civic issue.
            </p>
            {gpsErrorMsg && (
              <p className="text-xs text-rose-600 font-medium pt-1">
                {gpsErrorMsg}
              </p>
            )}
          </div>
          {interactive && (
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingGps}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center space-x-2 transition-all min-h-[44px]"
            >
              {detectingGps ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Detecting GPS Location...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  <span>Turn On / Detect Location</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : mapEngine === 'google' && hasGoogleMapsKey && position ? (
        interactive ? (
          <LocationPicker
            initialPosition={{ lat: position[0], lng: position[1] }}
            onChange={(pos) => handleSelect(pos.lat, pos.lng)}
            height="440px"
          />
        ) : (
          <div className="w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-gray-200 shadow-xs relative bg-white">
            <NagarSetuMap
              center={{ lat: position[0], lng: position[1] }}
              selectedPosition={{ lat: position[0], lng: position[1] }}
              height="300px"
            />
          </div>
        )
      ) : position ? (
        /* LEAFLET / OPENSTREETMAP ENGINE */
        <div className="w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-xs relative bg-white">
          <MapContainer
            center={position}
            zoom={16}
            scrollWheelZoom={false}
            className="w-full h-full min-h-[420px]"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <MapController center={position} zoom={16} />

            {/* GPS Accuracy Circle */}
            {accuracyMeters && accuracyMeters > 0 && Number.isFinite(accuracyMeters) && (
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
      ) : null}
    </div>
  );
};

export default LocationMapPicker;
