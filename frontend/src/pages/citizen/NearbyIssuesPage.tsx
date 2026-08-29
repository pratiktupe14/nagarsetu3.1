import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { getAllComplaints, supportDuplicateComplaint } from '../../services/complaintService';
import { calculateDistanceMeters } from '../../services/locationService';
import { Complaint, PriorityLevel } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import {
  MapPin, PlusCircle, Search, Compass, ShieldCheck, ThumbsUp, ArrowRight,
  AlertTriangle, CheckCircle2, RefreshCw, Layers, Building2, Calendar, Filter, X,
  Maximize2, Minimize2, Locate, LayoutGrid, Map as MapIcon, ListFilter, AlertCircle
} from 'lucide-react';

// Leaflet Marker Icon Generators
function createDotIcon(color: string, isCurrentLocation: boolean = false) {
  const size = isCurrentLocation ? 22 : 14;
  const border = isCurrentLocation ? '3px solid #ffffff' : '2px solid #ffffff';
  const shadow = isCurrentLocation ? '0 0 12px rgba(5,150,105,0.7)' : '0 2px 5px rgba(0,0,0,0.3)';
  
  return L.divIcon({
    className: 'custom-nearby-marker',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${border}; box-shadow: ${shadow};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

const userLocationIcon = createDotIcon('#059669', true);
const blueIcon = createDotIcon('#2563eb');
const amberIcon = createDotIcon('#d97706');
const greenIcon = createDotIcon('#10b981');
const roseIcon = createDotIcon('#e11d48');
const orangeIcon = createDotIcon('#f97316');

function getComplaintMarkerIcon(complaint: Complaint) {
  if (complaint.priority === 'Critical') return roseIcon;
  if (complaint.status === 'Resolved' || complaint.status === 'Resolution Submitted') return greenIcon;
  if (complaint.status === 'In Progress' || complaint.status === 'On the Way' || complaint.status === 'Accepted') return amberIcon;
  if (complaint.status === 'Reopened') return orangeIcon;
  return blueIcon;
}

// Map Controller for Recenter & Popup Trigger
function MapController({
  center,
  zoom,
  fitBounds
}: {
  center: [number, number];
  zoom?: number;
  fitBounds?: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (fitBounds && fitBounds.length > 1) {
      const bounds = L.latLngBounds(fitBounds);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else {
      map.flyTo(center, zoom || 15, { animate: true });
    }
  }, [center, zoom, fitBounds, map]);

  return null;
}

export const NearbyIssuesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User Location State (Default: Nashik City Center)
  const [userLat, setUserLat] = useState<number>(20.0059);
  const [userLng, setUserLng] = useState<number>(73.7898);
  const [locationName, setLocationName] = useState<string>('Nashik City, Maharashtra');
  const [gpsGranted, setGpsGranted] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [showManualPinPicker, setShowManualPinPicker] = useState(false);

  // View Mode: 'split' (Map + List), 'map_only' (Map Only), 'list_only' (List Only)
  const [viewMode, setViewMode] = useState<'split' | 'map_only' | 'list_only'>('split');
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);

  // Filter & Radius State
  const [radiusMeters, setRadiusMeters] = useState<number>(500); // 100m, 500m, 1km, 2km, 5km
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [displayCount, setDisplayCount] = useState<number>(10);

  // Focus & Recenter State
  const [focusedComplaintId, setFocusedComplaintId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.0059, 73.7898]);
  const [fitBoundsCoords, setFitBoundsCoords] = useState<[number, number][] | undefined>(undefined);

  // Support Modal State
  const [supportModalComplaint, setSupportModalComplaint] = useState<Complaint | null>(null);
  const [supporting, setSupporting] = useState(false);

  // Ref for Card Elements (Auto-scroll list when marker is clicked)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await getAllComplaints();
      setAllComplaints(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setErrorMsg('Unable to load nearby complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  // Request Device Geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError(true);
      return;
    }
    setGpsLoading(true);
    setGpsError(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setMapCenter([lat, lng]);
        setGpsGranted(true);
        setGpsLoading(false);
        setLocationName('Your Current GPS Location');
      },
      (err) => {
        console.error(err);
        setGpsLoading(false);
        setGpsError(true);
        setGpsGranted(false);
      },
      { timeout: 8000 }
    );
  }, []);

  // Request Location on Initial Mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Distance & Filtering Logic
  const safeComplaints = Array.isArray(allComplaints) ? allComplaints : [];

  const nearbyItems = safeComplaints
    .filter((c) => c.status !== 'Rejected')
    .map((c) => {
      const dist = calculateDistanceMeters(userLat, userLng, Number(c.latitude), Number(c.longitude));
      const isPossibleDuplicate = dist <= 100 && c.status !== 'Resolved';
      return { complaint: c, distanceMeters: Math.round(dist), isPossibleDuplicate };
    })
    .filter((item) => item.distanceMeters <= radiusMeters)
    .filter((item) => {
      const c = item.complaint;
      // Search Query
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.complaint_number.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.location_address && c.location_address.toLowerCase().includes(q));

      // Category Filter
      const matchesCat = selectedCategory === 'All' || c.category.toLowerCase() === selectedCategory.toLowerCase();

      // Status Filter
      const matchesStatus = selectedStatus === 'All' || c.status.toLowerCase() === selectedStatus.toLowerCase();

      // Priority Filter
      const matchesPriority = selectedPriority === 'All' || c.priority === selectedPriority;

      return matchesSearch && matchesCat && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      if (a.isPossibleDuplicate && !b.isPossibleDuplicate) return -1;
      if (b.isPossibleDuplicate && !a.isPossibleDuplicate) return 1;
      return a.distanceMeters - b.distanceMeters;
    });

  const visibleItems = nearbyItems.slice(0, displayCount);

  // Auto-fit bounds on initial load if complaints exist
  useEffect(() => {
    if (nearbyItems.length > 0) {
      const coords: [number, number][] = [
        [userLat, userLng],
        ...nearbyItems.map((item) => [Number(item.complaint.latitude), Number(item.complaint.longitude)] as [number, number])
      ];
      setFitBoundsCoords(coords);
    }
  }, [nearbyItems.length, userLat, userLng]);

  // Recenter to Citizen Location
  const handleRecenter = () => {
    setMapCenter([userLat, userLng]);
    setFitBoundsCoords(undefined);
  };

  // Card Click -> Center Map & Highlight
  const handleSelectCard = (complaint: Complaint) => {
    setFocusedComplaintId(complaint.id);
    setMapCenter([Number(complaint.latitude), Number(complaint.longitude)]);
    setFitBoundsCoords(undefined);
  };

  // Marker Click -> Select & Scroll Card into View
  const handleMarkerClick = (complaint: Complaint) => {
    setFocusedComplaintId(complaint.id);
    const cardEl = cardRefs.current[complaint.id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Handle Support Action
  const handleConfirmSupport = async () => {
    if (!supportModalComplaint) return;
    setSupporting(true);
    try {
      await supportDuplicateComplaint(supportModalComplaint.id);
      alert(`Thank you! Your support for complaint ${supportModalComplaint.complaint_number} has been recorded.`);
      setSupportModalComplaint(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Error updating support.');
    } finally {
      setSupporting(false);
    }
  };

  return (
    <DashboardLayout title="Nearby Issues">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Nearby Civic Issues
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              See civic issues reported around you and help your community get them resolved.
            </p>
          </div>

          <Link
            to="/citizen/report"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ Report Civic Issue</span>
          </Link>
        </div>

        {/* LOCATION BAR & VIEW MODE TOGGLE */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* GPS LOCATION BUTTON */}
            <button
              onClick={requestLocation}
              disabled={gpsLoading}
              className={`px-4 py-2.5 rounded-xl font-bold border flex items-center space-x-2 min-h-[44px] ${
                gpsGranted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Compass className={`w-4 h-4 ${gpsLoading ? 'animate-spin text-emerald-600' : 'text-emerald-600'}`} />
              <span>{gpsLoading ? 'Finding location...' : gpsGranted ? '✓ Your Location Active' : '📍 Use My Location'}</span>
            </button>

            <button
              onClick={() => setShowManualPinPicker(!showManualPinPicker)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold border border-gray-300 min-h-[44px]"
            >
              Select Location Manually
            </button>

            <div className="flex items-center space-x-2 text-gray-700 font-medium">
              <span className="text-gray-500">📍 Showing issues near:</span>
              <span className="font-bold text-gray-900 font-outfit">{locationName}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* RADIUS DROPDOWN */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-700 font-outfit">Radius:</span>
              <select
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value={100}>100 m</option>
                <option value={500}>500 m</option>
                <option value={1000}>1 km</option>
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
              </select>
            </div>

            {/* VIEW MODE TOGGLE (Map+List / Map Only / List Only) */}
            <div className="bg-gray-100 p-1 rounded-xl border border-gray-200 flex items-center space-x-1">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition-all min-h-[44px] ${
                  viewMode === 'split' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Map + List</span>
              </button>

              <button
                onClick={() => setViewMode('map_only')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition-all min-h-[44px] ${
                  viewMode === 'map_only' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map Only</span>
              </button>

              <button
                onClick={() => setViewMode('list_only')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1 transition-all min-h-[44px] ${
                  viewMode === 'list_only' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>List Only</span>
              </button>
            </div>
          </div>

        </div>

        {/* GPS ERROR ALERT */}
        {gpsError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Location access is unavailable or denied by browser.</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={requestLocation}
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 min-h-[44px]"
              >
                Try Again
              </button>
              <button
                onClick={() => setShowManualPinPicker(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 min-h-[44px]"
              >
                Select Location Manually
              </button>
            </div>
          </div>
        )}

        {/* MANUAL LOCATION PIN PICKER MODAL */}
        {showManualPinPicker && (
          <div className="bg-white p-5 rounded-2xl border border-emerald-300 shadow-md space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">Drag Marker to Pick Location Center</span>
              <button onClick={() => setShowManualPinPicker(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>
            <div className="h-56 rounded-xl overflow-hidden border border-gray-200">
              <LocationMapPicker
                initialLat={userLat}
                initialLng={userLng}
                onLocationSelect={(newLat, newLng) => {
                  setUserLat(newLat);
                  setUserLng(newLng);
                  setMapCenter([newLat, newLng]);
                  setLocationName(`Manual Pin (${newLat.toFixed(4)}, ${newLng.toFixed(4)})`);
                }}
              />
            </div>
          </div>
        )}

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* SEARCH FIELD */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search nearby civic issues by title, ID, category, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            {/* STATUS & PRIORITY DROPDOWNS */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-semibold text-gray-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Status: All</option>
                <option value="Submitted">Submitted</option>
                <option value="Verified">Verified</option>
                <option value="Department Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-semibold text-gray-800 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Priority: All</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

          </div>

          {/* CATEGORY TABS */}
          <div className="flex items-center space-x-1.5 border-t border-gray-100 pt-3 overflow-x-auto font-semibold">
            {['All', 'Pothole', 'Garbage', 'Overflowing Dustbin', 'Water Leakage', 'Streetlight', 'Drainage', 'Road Damage', 'Traffic Signal'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap min-h-[44px] ${
                  selectedCategory === cat
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-600 font-extrabold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat === 'All' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* DYNAMIC VIEW LAYOUT (Split / Map Only / List Only) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* MAP CONTAINER */}
          {viewMode !== 'list_only' && (
            <div
              className={`bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3 sticky top-20 z-0 transition-all ${
                viewMode === 'map_only' ? 'lg:col-span-12' : 'lg:col-span-7'
              }`}
            >
              <div className="flex items-center justify-between text-xs border-b border-gray-100 pb-2">
                <span className="font-extrabold text-gray-900 font-outfit flex items-center space-x-1">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Interactive Civic Map</span>
                </span>

                {/* FLOATING CONTROLS & FULLSCREEN TOGGLE */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRecenter}
                    title="Recenter Map on Current Location"
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] flex items-center space-x-1 min-h-[44px]"
                  >
                    <Locate className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Recenter</span>
                  </button>

                  <button
                    onClick={() => setIsFullscreenMap(!isFullscreenMap)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={isFullscreenMap ? 'Exit Fullscreen Map' : 'Fullscreen Map'}
                  >
                    {isFullscreenMap ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* LEAFLET MAP */}
              <div className={`rounded-xl overflow-hidden border border-gray-200 relative transition-all ${
                isFullscreenMap ? 'h-[75vh]' : 'h-[520px]'
              }`}>
                <MapContainer
                  center={mapCenter}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapController center={mapCenter} fitBounds={fitBoundsCoords} />

                  {/* CITIZEN LOCATION MARKER */}
                  <Marker position={[userLat, userLng]} icon={userLocationIcon}>
                    <Popup>
                      <div className="text-xs font-sans space-y-1">
                        <strong className="text-emerald-700 font-outfit block">📍 Your Current Location</strong>
                        <span className="font-mono text-[10px] text-gray-500 block">
                          {userLat.toFixed(4)}, {userLng.toFixed(4)}
                        </span>
                      </div>
                    </Popup>
                  </Marker>

                  {/* NEARBY COMPLAINT MARKERS */}
                  {nearbyItems.map(({ complaint, distanceMeters }) => (
                    <Marker
                      key={complaint.id}
                      position={[Number(complaint.latitude), Number(complaint.longitude)]}
                      icon={getComplaintMarkerIcon(complaint)}
                      eventHandlers={{
                        click: () => handleMarkerClick(complaint)
                      }}
                    >
                      <Popup>
                        <div className="text-xs font-sans space-y-2 max-w-[220px]">
                          {/* POPUP PREVIEW IMAGE */}
                          <div className="relative rounded-lg overflow-hidden h-24 border border-gray-200">
                            {complaint.photo_before_url ? (
                              <img
                                src={getValidImageUrl(complaint.photo_before_url)}
                                alt={complaint.title}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 space-y-1">
                                <span className="text-[10px] font-semibold text-gray-400">No image available</span>
                              </div>
                            )}
                            <div className="absolute top-1 left-1"><StatusBadge status={complaint.status} /></div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold text-emerald-700">{complaint.complaint_number}</span>
                              <span className="font-mono text-[10px] font-bold text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                📍 {distanceMeters}m away
                              </span>
                            </div>
                            <strong className="block text-gray-900 leading-snug font-outfit">{complaint.title}</strong>
                            <p className="text-[11px] text-gray-500 line-clamp-1">{complaint.description}</p>
                          </div>

                          <div className="pt-1 flex items-center justify-between border-t border-gray-100">
                            <button
                              type="button"
                              onClick={() => setSupportModalComplaint(complaint)}
                              className="text-[10px] font-bold text-gray-700 hover:text-emerald-700 underline min-h-[44px]"
                            >
                              Support ({complaint.support_count || 1})
                            </button>

                            <Link
                              to={`/citizen/complaint/${complaint.id}`}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white font-extrabold text-[10px] hover:bg-emerald-700"
                            >
                              View Complaint →
                            </Link>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                </MapContainer>

                {/* COMPACT MAP LEGEND INSIDE MAP */}
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-gray-200 shadow-md text-[10px] font-mono font-bold flex flex-wrap gap-2 z-10">
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /><span>Your Location</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /><span>Assigned</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /><span>In Progress</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /><span>Resolved</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /><span>Critical</span></span>
                </div>
              </div>

            </div>
          )}

          {/* NEARBY ISSUE CARDS LIST */}
          {viewMode !== 'map_only' && (
            <div className={`space-y-4 ${viewMode === 'list_only' ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
              
              <div className="flex items-center justify-between text-xs">
                <h3 className="text-sm font-extrabold text-gray-900 font-outfit">
                  Nearby Issues ({nearbyItems.length})
                </h3>
                <span className="text-[11px] text-gray-500 font-mono">Sorted by closest first</span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-3 animate-pulse">
                      <div className="h-28 bg-gray-100 rounded-xl" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : nearbyItems.length === 0 ? (
                /* EMPTY STATE */
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-gray-900 font-outfit">No civic issues reported nearby</h4>
                  <p className="text-xs text-gray-500">There are no reported civic issues within the selected radius.</p>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => setRadiusMeters(2000)}
                      className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs min-h-[44px]"
                    >
                      Increase Radius to 2 km
                    </button>

                    <Link
                      to="/citizen/report"
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 min-h-[44px]"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Report a Civic Issue</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* CARDS LIST WITH PAGINATION & LOAD MORE */
                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                  {visibleItems.map(({ complaint, distanceMeters, isPossibleDuplicate }) => {
                    const isFocused = focusedComplaintId === complaint.id;

                    return (
                      <div
                        key={complaint.id}
                        ref={(el) => (cardRefs.current[complaint.id] = el)}
                        onClick={() => handleSelectCard(complaint)}
                        className={`bg-white rounded-2xl p-4 border transition-all space-y-3 cursor-pointer ${
                          isFocused
                            ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                            : 'border-gray-200 hover:border-emerald-400 shadow-sm'
                        }`}
                      >
                        {/* POSSIBLE DUPLICATE WARNING */}
                        {isPossibleDuplicate && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>⚠ Possible Duplicate ({distanceMeters}m away)</span>
                            </div>
                            <Link to={`/citizen/complaint/${complaint.id}`} className="text-emerald-700 font-bold underline">
                              View Existing →
                            </Link>
                          </div>
                        )}

                        <div className="flex gap-3">
                          {complaint.photo_before_url ? (
                            <img
                              src={getValidImageUrl(complaint.photo_before_url)}
                              alt={complaint.title}
                              className="w-24 h-24 rounded-xl object-cover border border-gray-200 shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center justify-center text-gray-400 shrink-0 text-center p-1">
                              <span className="text-[10px] font-semibold text-gray-400">No image available</span>
                            </div>
                          )}

                          <div className="space-y-1 flex-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] font-bold text-emerald-700">{complaint.complaint_number}</span>
                              <span className="font-mono text-[11px] font-bold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                📍 {distanceMeters}m away
                              </span>
                            </div>

                            <h4 className="font-extrabold text-gray-900 leading-snug line-clamp-1 font-outfit">{complaint.title}</h4>
                            
                            <div className="flex items-center space-x-2 pt-0.5">
                              <StatusBadge status={complaint.status} />
                              <PriorityBadge priority={complaint.priority} />
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 text-[11px] flex items-center justify-between text-gray-600 font-mono">
                          <span>Dept: {complaint.department_name || 'Public Works'}</span>
                          <span>Source: {complaint.location_source === 'live_gps' ? 'Live GPS' : complaint.location_source === 'exif_gps' ? 'Photo EXIF' : 'Manual Pin'}</span>
                        </div>

                        {/* CARD ACTIONS */}
                        <div className="pt-1 flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSupportModalComplaint(complaint);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-bold border border-gray-300 flex items-center space-x-1 min-h-[44px]"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span>Support ({complaint.support_count || 1})</span>
                          </button>

                          <Link
                            to={`/citizen/complaint/${complaint.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-sm flex items-center space-x-1 min-h-[44px]"
                          >
                            <span>View Issue</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>

                      </div>
                    );
                  })}

                  {/* LOAD MORE BUTTON */}
                  {nearbyItems.length > displayCount && (
                    <button
                      type="button"
                      onClick={() => setDisplayCount((prev) => prev + 10)}
                      className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs shadow-xs min-h-[44px]"
                    >
                      Load More Nearby Issues ({nearbyItems.length - displayCount} remaining)
                    </button>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* SUPPORT CONFIRMATION MODAL */}
      {supportModalComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Support Existing Complaint?</h3>
              <button onClick={() => setSupportModalComplaint(null)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Your support will help the municipality understand that this issue affects multiple citizens.
            </p>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
              <span className="font-mono text-emerald-700 font-bold block">{supportModalComplaint.complaint_number}</span>
              <strong className="block text-gray-900 mt-0.5">{supportModalComplaint.title}</strong>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSupportModalComplaint(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSupport}
                disabled={supporting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase min-h-[44px]"
              >
                {supporting ? 'Updating...' : 'Support Complaint'}
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
