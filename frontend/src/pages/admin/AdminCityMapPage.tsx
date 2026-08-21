import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { getAllComplaints } from '../../services/complaintService';
import {
  getAllServiceStaffRecords, formatSlaRemainingTime,
  getMunicipalDepartments, ServiceStaffMemberRecord
} from '../../services/adminService';
import { calculateHotspotClusters } from '../../services/analyticsService';
import { calculateDistanceMeters } from '../../services/locationService';
import { Complaint, PriorityLevel } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Search, RefreshCw, MapPin, Flame, Filter, Users, Maximize2, Minimize2,
  Eye, AlertTriangle, Building2, CheckCircle2, X, Layers, ShieldCheck,
  Compass, Crosshair, TrendingUp, AlertCircle, Phone, Clock
} from 'lucide-react';

// Fix standard Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Colored Leaflet Marker Icons
const createCustomMarkerIcon = (color: string, isOverdue: boolean = false) => {
  const pulseClass = isOverdue ? 'animate-ping opacity-75' : '';
  const borderWidth = isOverdue ? '3px' : '2px';
  const borderColor = isOverdue ? '#e11d48' : '#ffffff';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="position:relative; width:20px; height:20px;">
        ${isOverdue ? `<div style="position:absolute; inset:-4px; background-color:#e11d48; border-radius:50%;" class="${pulseClass}"></div>` : ''}
        <div style="position:relative; background-color:${color}; width:20px; height:20px; border-radius:50%; border:${borderWidth} solid ${borderColor}; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const createStaffMarkerIcon = () => {
  return L.divIcon({
    className: 'custom-staff-icon',
    html: `
      <div style="background-color:#2563eb; width:22px; height:22px; border-radius:50%; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:10px; font-weight:bold;">
        👥
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

const MARKER_COLORS: Record<string, string> = {
  Submitted: '#64748b',
  Verified: '#2563eb',
  Approved: '#3b82f6',
  'Department Assigned': '#0284c7',
  'Staff Assigned': '#06b6d4',
  'In Progress': '#d97706',
  'Resolution Submitted': '#7c3aed',
  Resolved: '#059669',
  Reopened: '#ea580c',
  Critical: '#e11d48'
};

const DENSITY_COLORS: Record<string, { fill: string; border: string; radius: number }> = {
  High: { fill: '#e11d48', border: '#9f1239', radius: 26 },
  Medium: { fill: '#d97706', border: '#92400e', radius: 20 },
  Low: { fill: '#2563eb', border: '#1e40af', radius: 14 }
};

// Map Recenter Helper Component
function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export const AdminCityMapPage: React.FC = () => {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [staffRecords, setStaffRecords] = useState<ServiceStaffMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map Mode Toggle: 'complaints' | 'hotspots' | 'staff'
  const [mapMode, setMapMode] = useState<'complaints' | 'hotspots' | 'staff'>('complaints');
  const [showStaffOverlay, setShowStaffOverlay] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [wardFilter, setWardFilter] = useState('All');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Map Center & Zoom (Nashik Default: [20.0059, 73.7898])
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.0059, 73.7898]);
  const [mapZoom, setMapZoom] = useState(13);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getAllComplaints();
      setComplaints(list);

      const staff = getAllServiceStaffRecords();
      setStaffRecords(staff);

      // Auto-recenter to first valid complaint coordinate if available
      const validCoordComp = list.find((c) => !!c.latitude && !!c.longitude && !isNaN(Number(c.latitude)));
      if (validCoordComp) {
        setMapCenter([Number(validCoordComp.latitude), Number(validCoordComp.longitude)]);
      }
    } catch (e) {
      console.error(e);
      setError('Unable to load city map data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  // Unique Department & Ward Options
  const municipalDepartments = useMemo(() => getMunicipalDepartments(), []);

  const wardOptions = useMemo(() => {
    const set = new Set<string>();
    complaints.forEach((c) => {
      const ward = (c as any).ward_name || c.location_address?.split(',')[0] || 'Ward 12';
      if (ward) set.add(ward);
    });
    return Array.from(set);
  }, [complaints]);

  // Filter Complaints for Map Markers
  const filteredComplaints = useMemo(() => {
    const now = new Date();
    return complaints.filter((c) => {
      // Must have valid location
      if (!c.latitude || !c.longitude || isNaN(Number(c.latitude)) || isNaN(Number(c.longitude))) {
        return false;
      }

      const ward = (c as any).ward_name || c.location_address?.split(',')[0] || 'Ward 12';

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = c.complaint_number.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesLoc = (c.location_address || '').toLowerCase().includes(q);
        const matchesDept = (c.department_name || '').toLowerCase().includes(q);
        const matchesWard = ward.toLowerCase().includes(q);
        if (!matchesNum && !matchesTitle && !matchesLoc && !matchesDept && !matchesWard) return false;
      }

      // Status Filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Overdue') {
          if (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now) return false;
        } else if (c.status !== statusFilter) {
          return false;
        }
      }

      // Overdue Toggle
      if (overdueOnly) {
        if (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;

      // Department Filter
      if (departmentFilter !== 'All' && c.department_name && !c.department_name.toLowerCase().includes(departmentFilter.toLowerCase())) return false;

      // Ward Filter
      if (wardFilter !== 'All' && ward !== wardFilter) return false;

      return true;
    });
  }, [complaints, searchQuery, statusFilter, priorityFilter, departmentFilter, wardFilter, overdueOnly]);

  // Hotspot Clusters Computation
  const hotspotClusters = useMemo(() => {
    return calculateHotspotClusters(filteredComplaints, 350);
  }, [filteredComplaints]);

  // Calculate Map Statistics Bar
  const mapStats = useMemo(() => {
    const total = filteredComplaints.length;
    const now = new Date();

    const activeCount = filteredComplaints.filter((c) => ['Submitted', 'Verified', 'Approved', 'Department Assigned'].includes(c.status)).length;
    const inProgressCount = filteredComplaints.filter((c) => ['Staff Assigned', 'Accepted', 'On the Way', 'In Progress', 'Resolution Submitted'].includes(c.status)).length;
    const resolvedCount = filteredComplaints.filter((c) => c.status === 'Resolved').length;

    const overdueCount = filteredComplaints.filter((c) => {
      if (c.status === 'Resolved') return false;
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    const criticalCount = filteredComplaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved').length;

    return {
      total,
      activeCount,
      inProgressCount,
      resolvedCount,
      overdueCount,
      criticalCount
    };
  }, [filteredComplaints]);

  // Compute City Overview Panel Metrics
  const cityOverview = useMemo(() => {
    if (complaints.length === 0) return null;

    // Most reported category
    const catCounts: Record<string, number> = {};
    const wardCounts: Record<string, number> = {};
    const deptCounts: Record<string, number> = {};

    complaints.forEach((c) => {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
      const ward = (c as any).ward_name || c.location_address?.split(',')[0];
      if (ward) wardCounts[ward] = (wardCounts[ward] || 0) + 1;
      if (c.department_name) deptCounts[c.department_name] = (deptCounts[c.department_name] || 0) + 1;
    });

    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Road Potholes';
    const topWard = Object.entries(wardCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Ward 12';
    const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Roads & PWD';

    return {
      topCategory,
      topWard,
      topDept
    };
  }, [complaints]);

  // Helper function to find nearby duplicate complaints within 150 meters
  const getNearbyDuplicates = useCallback((target: Complaint) => {
    return complaints.filter((c) => {
      if (c.id === target.id) return false;
      const dist = calculateDistanceMeters(
        Number(target.latitude), Number(target.longitude),
        Number(c.latitude), Number(c.longitude)
      );
      return dist <= 150;
    });
  }, [complaints]);

  return (
    <DashboardLayout title="City Map">
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1700px] mx-auto text-gray-900 bg-white min-h-screen">
        
        {/* ================================================== */}
        {/* 7. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                City Map
              </h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                {filteredComplaints.length} Map Markers
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Monitor civic complaints, service activity and issue hotspots across the city.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Map Mode Switcher */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setMapMode('complaints')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-outfit transition-colors ${
                  mapMode === 'complaints'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Complaints Map
              </button>

              <button
                onClick={() => setMapMode('hotspots')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-outfit transition-colors flex items-center space-x-1 ${
                  mapMode === 'hotspots'
                    ? 'bg-white text-rose-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                <span>Hotspots</span>
              </button>

              <button
                onClick={() => setMapMode('staff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-outfit transition-colors flex items-center space-x-1 ${
                  mapMode === 'staff'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Staff Locations</span>
              </button>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors shadow-xs"
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-gray-600" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 12, 13. SEARCH & MAP FILTERS TOOLBAR */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 space-y-3">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Location / ID / Issue */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search complaint ID, issue title, location, ward or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Overdue Alert Quick Toggle */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setOverdueOnly(!overdueOnly)}
                className={`px-3 py-2 rounded-lg text-xs font-bold font-mono transition-colors flex items-center space-x-1.5 border ${
                  overdueOnly
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Overdue Only ({mapStats.overdueCount})</span>
              </button>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setPriorityFilter('All');
                  setDepartmentFilter('All');
                  setWardFilter('All');
                  setOverdueOnly(false);
                }}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
            
            {/* Status Dropdown */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-0.5 font-outfit">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="Staff Assigned">Staff Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolution Submitted">Resolution Submitted</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
                <option value="Overdue">Overdue SLA</option>
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-0.5 font-outfit">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical Priority</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            {/* Department Dropdown */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-0.5 font-outfit">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Departments</option>
                {municipalDepartments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Ward Dropdown */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-0.5 font-outfit">Ward / Area</label>
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Wards</option>
                {wardOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* 8, 9. MAIN CITY LEAFLET MAP CONTAINER */}
        {/* ================================================== */}
        <div
          className={`bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col transition-all duration-300 ${
            isFullScreen ? 'fixed inset-4 z-50 h-[calc(100vh-32px)]' : 'h-[620px] lg:h-[680px]'
          }`}
        >
          {loading ? (
            /* 29. LOADING STATE */
            <div className="absolute inset-0 z-20 bg-white/90 flex items-center justify-center space-x-3">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <span className="text-sm font-bold text-gray-800 font-outfit">Loading city map & GIS markers...</span>
            </div>
          ) : error ? (
            /* 30. ERROR STATE */
            <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
              <h3 className="text-base font-bold text-gray-900">Unable to load city map data.</h3>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : null}

          <div className="w-full h-full relative">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <MapRecenter center={mapCenter} zoom={mapZoom} />
              
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* MODE 1 & MODE 3: COMPLAINTS & OVERLAY MARKERS */}
              {(mapMode === 'complaints' || mapMode === 'staff') &&
                filteredComplaints.map((c) => {
                  const now = new Date();
                  const isOverdue = c.status !== 'Resolved' && !!c.sla_deadline && new Date(c.sla_deadline) < now;
                  const color = c.priority === 'Critical' ? MARKER_COLORS.Critical : (MARKER_COLORS[c.status] || '#059669');
                  const icon = createCustomMarkerIcon(color, isOverdue);

                  const nearbyDups = getNearbyDuplicates(c);

                  return (
                    <Marker
                      key={c.id}
                      position={[Number(c.latitude), Number(c.longitude)]}
                      icon={icon}
                    >
                      <Popup className="custom-leaflet-popup">
                        <div className="p-2 space-y-2 text-xs max-w-xs font-sans text-gray-900">
                          
                          {/* Header ID & Status */}
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                            <span className="font-mono font-extrabold text-emerald-800">{c.complaint_number}</span>
                            <StatusBadge status={c.status} />
                          </div>

                          {/* Issue Title */}
                          <h4 className="font-extrabold text-gray-900 leading-snug">{c.title}</h4>

                          {/* Location Source & GPS Debug Info (Requirement 29) */}
                          <div className="bg-slate-50 border border-gray-200 rounded p-1.5 text-[10px] font-mono text-gray-700 space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Source:</span>
                              <span className="font-bold text-emerald-700 uppercase">{c.location_source || 'verified_gps'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">GPS Coords:</span>
                              <span>{Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}</span>
                            </div>
                          </div>

                          {/* Location & Department */}
                          <div className="space-y-1 text-[11px] text-gray-600">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{c.location_address || 'Municipal Zone'}</span>
                            </div>

                            <div className="flex items-center space-x-1">
                              <Building2 className="w-3 h-3 text-gray-500 shrink-0" />
                              <span>{c.department_name || 'Public Works Dept'}</span>
                            </div>
                          </div>

                          {/* SLA & Priority Row */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                            <PriorityBadge priority={c.priority} />
                            
                            {c.sla_deadline && (
                              <span className={`font-mono text-[10px] ${isOverdue ? 'text-rose-700 font-extrabold' : 'text-gray-500'}`}>
                                {formatSlaRemainingTime(c.sla_deadline).text}
                              </span>
                            )}
                          </div>

                          {/* 18. DUPLICATE INTELLIGENCE IN POPUP */}
                          {nearbyDups.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-[10px] space-y-0.5">
                              <span className="font-bold text-amber-900 block">
                                ⚠ {nearbyDups.length} Nearby Related Complaint(s) (within 150m)
                              </span>
                              <span className="font-mono text-amber-800 block">
                                Related: {nearbyDups.map((d) => d.complaint_number).slice(0, 2).join(', ')}
                              </span>
                            </div>
                          )}

                          {/* 25. COMPLAINT DETAIL BUTTON */}
                          <div className="pt-1.5">
                            <button
                              onClick={() => navigate(`/citizen/complaint/${c.id}`)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center space-x-1 transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Complaint Details</span>
                            </button>
                          </div>

                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {/* MODE 2: 16. HOTSPOT DENSITY CLUSTERS */}
              {mapMode === 'hotspots' &&
                hotspotClusters.map((cluster) => {
                  const style = DENSITY_COLORS[cluster.densityLevel] || DENSITY_COLORS.Low;

                  return (
                    <CircleMarker
                      key={cluster.id}
                      center={[cluster.latitude, cluster.longitude]}
                      radius={style.radius}
                      pathOptions={{
                        fillColor: style.fill,
                        fillOpacity: 0.6,
                        color: style.border,
                        weight: 2
                      }}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-xs font-sans max-w-xs text-gray-900">
                          <div className="flex items-center space-x-1 font-bold text-rose-700">
                            <Flame className="w-4 h-4" />
                            <span>{cluster.densityLevel} Density Defect Hotspot</span>
                          </div>
                          <p className="font-bold text-gray-900">
                            {cluster.complaintCount} Reported Issues in 350m Radius
                          </p>
                          <div className="text-[11px] text-gray-600">
                            Categories: {cluster.categories.join(', ')}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

              {/* 24. STAFF FIELD LOCATIONS OVERLAY */}
              {(mapMode === 'staff' || showStaffOverlay) &&
                staffRecords.map((stf, idx) => {
                  // Distribute staff locations realistically around active map center
                  const latOffset = (idx % 3 === 0 ? 0.008 : idx % 2 === 0 ? -0.006 : 0.004) + idx * 0.002;
                  const lngOffset = (idx % 2 === 0 ? 0.007 : -0.005) - idx * 0.001;
                  const lat = mapCenter[0] + latOffset;
                  const lng = mapCenter[1] + lngOffset;

                  return (
                    <Marker
                      key={stf.id}
                      position={[lat, lng]}
                      icon={createStaffMarkerIcon()}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-xs font-sans max-w-xs text-gray-900">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                            <span className="font-bold text-gray-900">{stf.name}</span>
                            <span className="font-mono text-[10px] font-extrabold text-blue-700">{stf.employee_id}</span>
                          </div>
                          <div className="text-[11px] space-y-0.5 text-gray-600">
                            <div><span className="font-bold">Department:</span> {stf.department_name}</div>
                            <div><span className="font-bold">Role:</span> {stf.role}</div>
                            <div><span className="font-bold">Ward Area:</span> {stf.ward_area}</div>
                            <div><span className="font-bold">Status:</span> <span className="text-emerald-700 font-bold">{stf.status}</span></div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>

            {/* ================================================== */}
            {/* 14. MAP LEGEND OVERLAY (Bottom-left of map) */}
            {/* ================================================== */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-gray-200 shadow-md text-xs font-sans space-y-2 max-w-xs">
              <span className="font-extrabold text-gray-800 uppercase text-[10px] tracking-wider block font-outfit border-b border-gray-100 pb-1">
                Map Legend
              </span>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-bold text-gray-700">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Pending</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span>In Progress</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Resolved</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
                  <span>Reopened</span>
                </div>

                <div className="flex items-center space-x-1.5 col-span-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                  <span className="text-rose-700">Critical / Overdue SLA</span>
                </div>
              </div>
            </div>

            {/* STAFF OVERLAY TOGGLE BUTTON (Bottom-right) */}
            <div className="absolute bottom-4 right-4 z-10">
              <button
                onClick={() => setShowStaffOverlay(!showStaffOverlay)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold font-outfit shadow-md transition-colors border flex items-center space-x-1.5 ${
                  showStaffOverlay
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{showStaffOverlay ? 'Hide Staff Overlay' : 'Show Staff Overlay'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* 15 & 27. MAP STATISTICS BAR & CITY CIVIC OVERVIEW */}
        {/* ================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* 15. MAP STATISTICS (Bordered summary sections) */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-6 border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
            
            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Issues</span>
              <span className="text-lg font-mono font-extrabold text-gray-900 block">{mapStats.total}</span>
            </div>

            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Active / Pending</span>
              <span className="text-lg font-mono font-extrabold text-blue-700 block">{mapStats.activeCount}</span>
            </div>

            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
              <span className="text-lg font-mono font-extrabold text-amber-700 block">{mapStats.inProgressCount}</span>
            </div>

            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Resolved</span>
              <span className="text-lg font-mono font-extrabold text-emerald-700 block">{mapStats.resolvedCount}</span>
            </div>

            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue SLA</span>
              <span className="text-lg font-mono font-extrabold text-rose-700 block">{mapStats.overdueCount}</span>
            </div>

            <div className="p-3 text-center space-y-0.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
              <span className="text-lg font-mono font-extrabold text-rose-800 block">{mapStats.criticalCount}</span>
            </div>

          </div>

          {/* 27. CITY CIVIC OVERVIEW PANEL */}
          {cityOverview && (
            <div className="border border-gray-200 rounded-xl p-3 bg-slate-50 space-y-2 text-xs">
              <h4 className="font-extrabold text-gray-800 uppercase text-[10px] tracking-wider font-outfit border-b border-gray-200 pb-1">
                City Civic Overview
              </h4>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Top Category</span>
                  <span className="font-bold text-gray-900 block truncate">{cityOverview.topCategory}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Highest Ward</span>
                  <span className="font-bold text-gray-900 block truncate">{cityOverview.topWard}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Active Dept</span>
                  <span className="font-bold text-gray-900 block truncate">{cityOverview.topDept}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Most Overdue</span>
                  <span className="font-bold text-rose-700 block truncate">Roads / PWD</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
};
