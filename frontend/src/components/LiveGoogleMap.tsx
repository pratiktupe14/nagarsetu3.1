import React, { useEffect, useRef, useState } from 'react';
import { Complaint } from '../types/database.types';
import { MapPin, AlertTriangle, Navigation, Zap, Building2, Info, Compass, ShieldCheck } from 'lucide-react';
import { LocationMapPicker } from './LocationMapPicker';

interface LiveGoogleMapProps {
  complaint: Complaint | null;
  nearbyComplaints?: Complaint[];
  isRealtimeConnected?: boolean;
}

declare global {
  interface Window {
    google?: any;
    initGoogleMapCallback?: () => void;
    GOOGLE_MAPS_API_KEY?: string;
  }
}

export const LiveGoogleMap: React.FC<LiveGoogleMapProps> = ({
  complaint,
  nearbyComplaints = [],
  isRealtimeConnected = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mainMarkerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const nearbyMarkersRef = useRef<any[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const apiKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY as string) ||
    (typeof window !== 'undefined' ? window.GOOGLE_MAPS_API_KEY : undefined);

  const lat = complaint?.latitude != null ? Number(complaint.latitude) : null;
  const lng = complaint?.longitude != null ? Number(complaint.longitude) : null;
  const hasValidCoords = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);

  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');

  // Google Maps Ultra-Clean Light Map Theme (White base, soft grey roads, pale green parks, light blue water)
  const LIGHT_MAP_STYLES = [
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e6ff' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fef3c7' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#fcd34d' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
    { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] }
  ];

  // Helper to create Google Maps SVG Pin Symbol
  const createPinSymbol = (color: string, scale = 1.2) => {
    if (!window.google || !window.google.maps) return undefined;
    return {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: scale * 1.5,
      anchor: new window.google.maps.Point(12, 22),
    };
  };

  // 1. Initialize or Load Google Maps API Script
  useEffect(() => {
    if (!apiKey || apiKey.trim() === '') {
      console.warn('Google Maps API Key not configured. Enabling fallback map viewer.');
      setUseFallback(true);
      return;
    }

    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = 'nagarsetu-google-maps-script';
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapLoaded(true);
      };
      script.onerror = () => {
        console.warn('Failed to load Google Maps JS SDK. Using fallback map viewer.');
        setUseFallback(true);
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setMapLoaded(true));
    }
  }, [apiKey]);

  // 2. Initialize Google Map Instance (ONCE)
  useEffect(() => {
    if (!mapLoaded || !window.google || !window.google.maps || !containerRef.current || !hasValidCoords) return;
    if (mapInstanceRef.current) return; // Map already initialized, do not recreate!

    try {
      const center = { lat, lng };
      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: 16,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        mapTypeControl: false, // We render custom clean floating controls
        streetViewControl: false,
        zoomControl: false, // We render custom clean floating zoom buttons
        fullscreenControl: false,
        styles: LIGHT_MAP_STYLES
      });

      mapInstanceRef.current = map;

      // Create Primary Complaint Marker (🔴 Red Pin)
      const primarySymbol = createPinSymbol('#ef4444', 1.4);
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        title: complaint?.title || 'Complaint Location',
        icon: primarySymbol,
        animation: window.google.maps.Animation.DROP
      });

      mainMarkerRef.current = marker;

      // Create InfoWindow
      const infoWindow = new window.google.maps.InfoWindow({
        content: createInfoWindowHtml(complaint)
      });
      infoWindowRef.current = infoWindow;

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      // Auto-open InfoWindow initially
      infoWindow.open(map, marker);

    } catch (err: any) {
      console.error('Error initializing Google Map instance:', err);
      setUseFallback(true);
    }
  }, [mapLoaded, hasValidCoords]);

  // Handle Map Type Change (Roadmap vs Hybrid/Satellite)
  useEffect(() => {
    if (mapInstanceRef.current && window.google && window.google.maps) {
      const targetType = mapTypeId === 'hybrid' ? window.google.maps.MapTypeId.HYBRID : window.google.maps.MapTypeId.ROADMAP;
      mapInstanceRef.current.setMapTypeId(targetType);
      if (mapTypeId === 'roadmap') {
        mapInstanceRef.current.setOptions({ styles: LIGHT_MAP_STYLES });
      }
    }
  }, [mapTypeId]);

  // 3. Update Marker & InfoWindow in Real-Time WITHOUT Recreating Map
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !hasValidCoords || !complaint) return;

    const newCenter = { lat, lng };
    mapInstanceRef.current.panTo(newCenter);

    if (mainMarkerRef.current) {
      mainMarkerRef.current.setPosition(newCenter);
      mainMarkerRef.current.setTitle(complaint.title);
      const primarySymbol = createPinSymbol('#ef4444', 1.4);
      if (primarySymbol) mainMarkerRef.current.setIcon(primarySymbol);
    }

    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(createInfoWindowHtml(complaint));
    }

    // Update Nearby Markers safely with color coding:
    // 🟠 In progress, 🟢 Resolved, 🔵 Other
    clearNearbyMarkers();
    if (Array.isArray(nearbyComplaints) && nearbyComplaints.length > 0) {
      nearbyComplaints.forEach((nc) => {
        if (nc.id !== complaint.id && nc.latitude != null && nc.longitude != null) {
          const nLat = Number(nc.latitude);
          const nLng = Number(nc.longitude);
          if (!isNaN(nLat) && !isNaN(nLng)) {
            let pinColor = '#3b82f6'; // Blue default
            if (String(nc.status) === 'Resolved' || String(nc.status) === 'Closed') pinColor = '#10b981'; // Green
            else if (String(nc.status) === 'In Progress' || String(nc.status) === 'Accepted' || String(nc.status) === 'On the Way') pinColor = '#f59e0b'; // Amber

            const nSymbol = createPinSymbol(pinColor, 1.0);
            const nMarker = new window.google.maps.Marker({
              position: { lat: nLat, lng: nLng },
              map: mapInstanceRef.current,
              title: `Nearby Complaint: ${nc.complaint_number}`,
              icon: nSymbol || { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }
            });

            const nInfoWindow = new window.google.maps.InfoWindow({
              content: `<div style="padding: 10px; font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a; border-radius: 8px;">
                <div style="font-weight: 800; color: #047857; margin-bottom: 2px;">📍 Nearby Complaint</div>
                <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #3b82f6;">ID: ${nc.complaint_number || nc.id}</div>
                <div style="font-weight: 700; color: #0f172a; margin-top: 4px;">${nc.title || nc.category}</div>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;"><strong>Status:</strong> ${nc.status}</div>
              </div>`
            });

            nMarker.addListener('click', () => {
              nInfoWindow.open(mapInstanceRef.current, nMarker);
            });

            nearbyMarkersRef.current.push(nMarker);
          }
        }
      });
    }
  }, [complaint, nearbyComplaints, lat, lng, hasValidCoords]);

  const clearNearbyMarkers = () => {
    nearbyMarkersRef.current.forEach((m) => m.setMap(null));
    nearbyMarkersRef.current = [];
  };

  const centerMapOnComplaint = () => {
    if (mapInstanceRef.current && hasValidCoords) {
      mapInstanceRef.current.setZoom(16);
      mapInstanceRef.current.panTo({ lat, lng });
      if (mainMarkerRef.current && infoWindowRef.current) {
        infoWindowRef.current.open(mapInstanceRef.current, mainMarkerRef.current);
      }
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() - 1);
    }
  };

  // 4. INVALID / MISSING LOCATION CARD
  if (!hasValidCoords) {
    return (
      <div className="w-full p-8 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-3 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto">
          <MapPin className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-amber-900 font-outfit">Complaint Location Unavailable</h3>
        <p className="text-xs text-amber-800 max-w-md mx-auto">
          Geographic coordinates are missing or pending municipal verification for this complaint.
        </p>
        <div className="text-[11px] text-amber-700 font-mono bg-white p-2.5 rounded-xl border border-amber-200 inline-block">
          Address: {complaint?.location_address || 'Address pending verification'}
        </div>
      </div>
    );
  }

  // 5. FALLBACK VIEW (Leaflet / OpenStreetMap with CartoDB Voyager Light Tiles)
  if (useFallback) {
    return (
      <div className="relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden border border-gray-200 shadow-sm font-sans bg-slate-50">
        {/* Floating Top Controls */}
        <div className="absolute top-4 right-4 z-[400] flex items-center space-x-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 shadow-md">
          <button
            onClick={centerMapOnComplaint}
            className="p-2 text-gray-700 hover:text-emerald-700 hover:bg-slate-100 rounded-xl font-bold text-xs flex items-center space-x-1"
            title="Recenter Map"
          >
            <Compass className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Recenter</span>
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-xs flex items-center space-x-1"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">Directions</span>
          </a>
        </div>

        <LocationMapPicker
          initialLat={lat}
          initialLng={lng}
          interactive={false}
          showDuplicateRadius={true}
        />

        {/* Floating Legend Bottom Right */}
        <div className="absolute bottom-4 right-4 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-gray-200 shadow-md font-sans text-xs space-y-1.5">
          <div className="font-extrabold text-[10px] uppercase tracking-wider text-gray-500 font-mono">Legend</div>
          <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>Your Complaint</span>
          </div>
          {nearbyComplaints.length > 0 && (
            <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Nearby Complaints ({nearbyComplaints.length})</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. MAIN GOOGLE MAP CANVAS WITH FLOATING LIGHT CONTROLS & LEGEND
  return (
    <div className="relative w-full h-full min-h-[550px] rounded-3xl overflow-hidden border border-gray-200 shadow-sm font-sans bg-slate-50">
      
      {/* FLOATING TOP-RIGHT MAP CONTROLS */}
      <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2.5">
        
        {/* SEGMENTED MAP / SATELLITE TOGGLE */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-gray-200 shadow-md flex items-center space-x-1 text-xs">
          <button
            onClick={() => setMapTypeId('roadmap')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              mapTypeId === 'roadmap'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-slate-100'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapTypeId('hybrid')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              mapTypeId === 'hybrid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* ZOOM + / - & RECENTER FLOATING BUTTONS */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-gray-200 shadow-md flex flex-col items-center space-y-1">
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 text-gray-700 font-extrabold text-lg flex items-center justify-center transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <div className="w-6 h-[1px] bg-gray-200" />
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 text-gray-700 font-extrabold text-lg flex items-center justify-center transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <div className="w-6 h-[1px] bg-gray-200" />
          <button
            onClick={centerMapOnComplaint}
            className="w-9 h-9 rounded-xl hover:bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors"
            title="Recenter Map"
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* FLOATING LEGEND BOTTOM RIGHT */}
      <div className="absolute bottom-16 right-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-gray-200 shadow-lg font-sans text-xs space-y-1.5 min-w-[150px]">
        <div className="font-extrabold text-[10px] uppercase tracking-wider text-gray-400 font-mono border-b border-gray-100 pb-1">
          LEGEND
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-800">
          <span className="w-3 h-3 rounded-full bg-rose-500 border border-white shadow-xs shrink-0" />
          <span>Your Complaint</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Resolved</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-700">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          <span>Other Complaints</span>
        </div>
      </div>

      {/* MAP CANVAS CONTAINER */}
      <div className="relative w-full h-full min-h-[550px]">
        {!mapLoaded && (
          <div className="absolute inset-0 z-10 bg-slate-50 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-gray-600 font-outfit">Loading Light Google Map...</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full min-h-[550px]" />
      </div>
    </div>
  );
};

function createInfoWindowHtml(complaint: Complaint | null): string {
  if (!complaint) return '';
  const updatedTime = complaint.updated_at ? new Date(complaint.updated_at).toLocaleTimeString() : 'Just now';
  return `
    <div style="padding: 12px; min-width: 240px; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.4; border-radius: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #047857; background: #ecfdf5; padding: 3px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">
          ${complaint.complaint_number || 'NS-2026'}
        </span>
        <span style="font-size: 10px; font-weight: 800; color: #059669; background: #f0fdf4; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0;">
          ${complaint.status || 'Active'}
        </span>
      </div>

      <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 6px; font-family: sans-serif;">
        ${complaint.title || 'Civic Issue'}
      </div>

      <div style="font-size: 11px; color: #475569; margin-bottom: 8px; background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9;">
        <strong>Category:</strong> ${complaint.category || 'Municipal'}<br />
        <strong>Department:</strong> ${complaint.department_name || 'Public Works'}<br />
        <strong>Priority:</strong> ${complaint.priority || 'Medium'}
      </div>

      <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; align-items: center; justify-content: space-between;">
        <span>Location Pins Active</span>
        <span style="font-family: monospace;">${updatedTime}</span>
      </div>
    </div>
  `;
}
