import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotification } from '../../context/NotificationContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationModal } from '../../components/LocationModal';
import { getCitizenComplaints } from '../../services/complaintService';
import { formatSlaRemainingTime } from '../../services/adminService';
import { calculateDistanceMeters } from '../../services/locationService';
import { Complaint, PriorityLevel } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import {
  PlusCircle, Search, Filter, Clock, ArrowRight, ShieldCheck, FileText,
  AlertTriangle, CheckCircle2, RotateCcw, Star, Calendar, Building2, MapPin, RefreshCw, Navigation, Compass
} from 'lucide-react';

const STAGES = [
  'Submitted',
  'Verified',
  'Approved',
  'Department Assigned',
  'Staff Assigned',
  'In Progress',
  'Resolved'
];

function getStageIndex(status: string): number {
  if (status === 'Submitted') return 0;
  if (status === 'Verified') return 1;
  if (status === 'Approved') return 2;
  if (status === 'Department Assigned') return 3;
  if (status === 'Staff Assigned') return 4;
  if (status === 'Accepted' || status === 'On the Way' || status === 'In Progress') return 5;
  if (status === 'Resolution Submitted' || status === 'Resolved') return 6;
  if (status === 'Reopened') return 4;
  return 0;
}

export const MyComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const { t, translateCategory, translateStatus } = useLanguage();
  const { toast } = useNotification();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'IN PROGRESS' | 'RESOLVED' | 'REOPENED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [areaFilter, setAreaFilter] = useState<string>('All Areas');
  const [dateFilter, setDateFilter] = useState<string>('All Time');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'updated'>('newest');

  // GPS Near Me State
  const [useNearMeGps, setUseNearMeGps] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Location Modal State
  const [selectedLocation, setSelectedLocation] = useState<{
    isOpen: boolean;
    title: string;
    address: string;
    latitude: number;
    longitude: number;
    source?: 'live_gps' | 'exif_gps' | 'manual_pin' | 'geocoded' | 'geocode_failed' | 'unavailable' | 'gps';
  }>({
    isOpen: false,
    title: '',
    address: '',
    latitude: 0,
    longitude: 0,
    source: 'live_gps'
  });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await getCitizenComplaints(user?.id || '');
      if (Array.isArray(list)) {
        setComplaints(list);
      } else {
        setComplaints([]);
      }
    } catch (e: any) {
      console.error('Error loading complaints:', e);
      setErrorMsg('Unable to load your complaints.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useRealtimeComplaints(useCallback(() => {
    loadComplaints();
  }, [loadComplaints]));

  const safeComplaints = Array.isArray(complaints) ? complaints : [];

  // Dynamically extract unique Areas from complaint location addresses
  const areaList = Array.from(
    new Set(
      safeComplaints
        .map((c) => c.location_address?.split(',')[0]?.trim())
        .filter(Boolean)
    )
  ) as string[];

  // Request Device Geolocation
  const handleRequestNearMe = () => {
    if (useNearMeGps) {
      setUseNearMeGps(false);
      setUserCoords(null);
      return;
    }

    if (!navigator.geolocation) {
      toast.warning('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUseNearMeGps(true);
        setGpsLoading(false);
      },
      (err) => {
        console.error(err);
        toast.warning('Could not access current location. Please check browser permissions.');
        setGpsLoading(false);
      }
    );
  };

  // Summary Metrics
  const totalCount = safeComplaints.length;
  const pendingCount = safeComplaints.filter((c) => c.status === 'Submitted' || c.status === 'Verified' || c.status === 'Approved').length;
  const inProgressCount = safeComplaints.filter((c) => c.status === 'Department Assigned' || c.status === 'Staff Assigned' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'In Progress').length;
  const resolvedCount = safeComplaints.filter((c) => c.status === 'Resolved' || c.status === 'Resolution Submitted').length;
  const reopenedCount = safeComplaints.filter((c) => c.status === 'Reopened').length;

  // Filter & Search Logic
  const filteredComplaints = safeComplaints.filter((c) => {
    // Search Query (ID, Title, Category, Location)
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.complaint_number.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.location_address && c.location_address.toLowerCase().includes(q));

    // Tab Filter
    let matchesTab = true;
    if (activeTab === 'PENDING') matchesTab = c.status === 'Submitted' || c.status === 'Verified' || c.status === 'Approved';
    if (activeTab === 'IN PROGRESS') matchesTab = c.status === 'Department Assigned' || c.status === 'Staff Assigned' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'In Progress';
    if (activeTab === 'RESOLVED') matchesTab = c.status === 'Resolved' || c.status === 'Resolution Submitted';
    if (activeTab === 'REOPENED') matchesTab = c.status === 'Reopened';

    // Priority Filter
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;

    // Department Filter
    const matchesDept = departmentFilter === 'All' || (c.department_name && c.department_name.toLowerCase().includes(departmentFilter.toLowerCase()));

    // Area Filter
    const matchesArea = areaFilter === 'All Areas' || (c.location_address && c.location_address.toLowerCase().includes(areaFilter.toLowerCase()));

    // Near Me GPS Filter (within 2km radius if active)
    let matchesGps = true;
    if (useNearMeGps && userCoords) {
      const dist = calculateDistanceMeters(userCoords.lat, userCoords.lng, Number(c.latitude), Number(c.longitude));
      matchesGps = dist <= 2000;
    }

    // Date Filter
    let matchesDate = true;
    const createdDate = new Date(c.created_at);
    const now = new Date();
    if (dateFilter === 'Today') {
      matchesDate = createdDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'This Week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      matchesDate = createdDate >= oneWeekAgo;
    } else if (dateFilter === 'This Month') {
      matchesDate = createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
    }

    return matchesSearch && matchesTab && matchesPriority && matchesDept && matchesArea && matchesGps && matchesDate;
  });

  // Sort Logic
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'updated') return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    if (sortBy === 'priority') {
      const pMap: Record<PriorityLevel, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    }
    return 0;
  });

  return (
    <DashboardLayout title="My Complaints">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              My Complaints
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 font-mono font-bold">
              {totalCount} {totalCount === 1 ? 'complaint' : 'complaints'}
            </p>
          </div>

          <Link
            to="/citizen/report"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-2 transition-all min-h-[44px]"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ Report a Complaint</span>
          </Link>
        </div>

        {/* 5 COMPACT SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
          
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-gray-500 block tracking-wider font-outfit">All Complaints</span>
            <div className="text-2xl font-extrabold text-gray-900 font-mono">{totalCount}</div>
            <span className="text-[10px] text-gray-400 block">Total logged issues</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-blue-700 block tracking-wider font-outfit">Pending</span>
            <div className="text-2xl font-extrabold text-blue-700 font-mono">{pendingCount}</div>
            <span className="text-[10px] text-gray-400 block">Awaiting verification</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-amber-800 block tracking-wider font-outfit">In Progress</span>
            <div className="text-2xl font-extrabold text-amber-800 font-mono">{inProgressCount}</div>
            <span className="text-[10px] text-gray-400 block">Staff assigned / repairing</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-emerald-800 block tracking-wider font-outfit">Resolved</span>
            <div className="text-2xl font-extrabold text-emerald-800 font-mono">{resolvedCount}</div>
            <span className="text-[10px] text-gray-400 block">Successfully resolved</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-orange-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-orange-800 block tracking-wider font-outfit">Reopened</span>
            <div className="text-2xl font-extrabold text-orange-800 font-mono">{reopenedCount}</div>
            <span className="text-[10px] text-gray-400 block">Citizen re-inspections</span>
          </div>

        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* SEARCH INPUT */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search by complaint ID or issue title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            {/* GPS NEAR ME TOGGLE BUTTON */}
            <button
              onClick={handleRequestNearMe}
              disabled={gpsLoading}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs border flex items-center space-x-1.5 transition-all min-h-[44px] ${
                useNearMeGps
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white hover:bg-emerald-50 text-gray-700 border-gray-300'
              }`}
            >
              <Compass className={`w-4 h-4 ${useNearMeGps ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? 'Locating...' : useNearMeGps ? '📍 Near Me (Active 2km)' : '📍 Filter Near Me'}</span>
            </button>

            {/* FILTER DROPDOWNS & SORT */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              
              {/* Area Dropdown */}
              <div>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="All Areas">Area: All Areas</option>
                  {areaList.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              {/* Priority Dropdown */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="All">Priority: All</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Department Dropdown */}
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="All">Dept: All</option>
                  <option value="Roads">Roads / PWD</option>
                  <option value="Sanitation">Sanitation & Waste</option>
                  <option value="Water">Water Supply</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Traffic">Traffic Management</option>
                </select>
              </div>

              {/* Date Filter Dropdown */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="All Time">Date: All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-emerald-800 font-extrabold focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="priority">Sort: Priority High ➔ Low</option>
                  <option value="updated">Sort: Recently Updated</option>
                </select>
              </div>

            </div>

          </div>

          {/* FILTER TABS */}
          <div className="flex items-center space-x-1.5 border-t border-gray-100 pt-3 overflow-x-auto text-xs font-semibold">
            {(['ALL', 'PENDING', 'IN PROGRESS', 'RESOLVED', 'REOPENED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap min-h-[44px] ${
                  activeTab === tab
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-600 font-extrabold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

        </div>

        {/* LOADING SKELETON STATE */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4 animate-pulse">
                <div className="h-40 bg-gray-100 rounded-xl" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-8 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          /* ERROR STATE */
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900 font-outfit">{t('somethingWentWrong')}</h3>
            <p className="text-xs text-gray-500">{t('unableToLoadData')}</p>
            <button
              onClick={loadComplaints}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1.5 mx-auto min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t('pleaseTryAgain')}</span>
            </button>
          </div>
        ) : sortedComplaints.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 font-outfit">
              {activeTab === 'ALL'
                ? 'No complaints reported yet.'
                : activeTab === 'PENDING'
                ? 'No pending complaints.'
                : activeTab === 'IN PROGRESS'
                ? 'No complaints currently in progress.'
                : activeTab === 'RESOLVED'
                ? 'No resolved complaints yet.'
                : 'No reopened complaints.'}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {activeTab === 'ALL'
                ? "You haven't submitted any complaints yet."
                : activeTab === 'PENDING'
                ? "You don't have any complaints awaiting verification."
                : activeTab === 'IN PROGRESS'
                ? 'No staff assigned or ongoing repairs at this moment.'
                : activeTab === 'RESOLVED'
                ? 'No complaints have been marked resolved yet.'
                : 'No complaints currently marked for re-inspection.'}
            </p>
            <Link
              to="/citizen/report"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Report a Complaint</span>
            </Link>
          </div>
        ) : (
          /* COMPLAINT CARDS GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedComplaints.map((c) => {
              const currentStageIdx = getStageIndex(c.status);
              const slaInfo = formatSlaRemainingTime(c.sla_deadline);

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    
                    {/* ISSUE IMAGE (16/10 aspect ratio) */}
                    <div className="relative rounded-xl overflow-hidden h-44 bg-gray-100 border border-gray-200">
                      {c.photo_before_url ? (
                        <img
                          src={getValidImageUrl(c.photo_before_url)}
                          alt={c.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 space-y-1">
                          <FileText className="w-8 h-8 text-gray-300" />
                          <span className="text-xs font-semibold text-gray-400">No image available</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="absolute top-2 right-2">
                        <PriorityBadge priority={c.priority} />
                      </div>
                    </div>

                    {/* TITLE & COMPLAINT ID */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider font-mono">
                          ID: {c.complaint_number}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500">{c.category}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-gray-900 leading-snug line-clamp-1 font-outfit">
                        {c.title}
                      </h3>

                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    {/* LOCATION & METADATA DETAILS */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="text-gray-500 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>Location:</span>
                        </span>
                        <span className="font-semibold text-gray-900 truncate max-w-[150px]">{c.location_address || 'Location unavailable'}</span>
                      </div>

                      {/* GPS COORDINATES (MONOSPACE) */}
                      <div className="flex items-center justify-between text-gray-500 font-mono text-[10px]">
                        <span>Coordinates:</span>
                        <span className="text-gray-700 font-bold">
                          {c.latitude != null && c.longitude != null && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude))
                            ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`
                            : 'Unavailable'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-700 pt-0.5">
                        <span className="text-gray-500 flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          <span>Department:</span>
                        </span>
                        <span className="font-semibold text-gray-900">{c.department_name || 'Unassigned'}</span>
                      </div>

                      <div className="flex items-center justify-between text-gray-700">
                        <span className="text-gray-500 flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>Submitted:</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-gray-800">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* COMPACT 7-STAGE PROGRESS INDICATOR */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider font-outfit">
                        <span>Workflow Progress</span>
                        <span className="text-emerald-700 font-mono">Stage {currentStageIdx + 1}/7</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {STAGES.map((stg, idx) => {
                          const isDone = idx < currentStageIdx;
                          const isCurrent = idx === currentStageIdx;
                          return (
                            <div
                              key={stg}
                              title={stg}
                              className={`h-1.5 flex-1 rounded-full transition-all ${
                                isDone
                                  ? 'bg-emerald-600'
                                  : isCurrent
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* SLA RESOLUTION TIME OR OVERDUE WARNING */}
                    {c.status !== 'Resolved' && c.status !== 'Resolution Submitted' && c.sla_deadline && (
                      <div className="flex items-center justify-between text-xs pt-1 font-mono">
                        <span className="text-[11px] text-gray-500">Expected SLA:</span>
                        <span className={`text-[11px] font-bold ${slaInfo.isOverdue ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-gray-700'}`}>
                          {slaInfo.isOverdue ? `⚠ Overdue (${slaInfo.text})` : slaInfo.text}
                        </span>
                      </div>
                    )}

                    {/* REOPENED COMPLAINT REASON BOX */}
                    {c.status === 'Reopened' && (
                      <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs space-y-1">
                        <div className="flex items-center space-x-1.5 font-bold">
                          <RotateCcw className="w-4 h-4 text-orange-600" />
                          <span>Complaint Reopened for Re-inspection</span>
                        </div>
                        <p className="text-[11px] text-orange-800">Your complaint has been sent back to the municipal team for re-inspection.</p>
                      </div>
                    )}

                    {/* RESOLVED COMPLAINT RATING / PROOF BOX */}
                    {c.status === 'Resolved' && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center space-x-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>✓ Resolved</span>
                          </span>
                          <span className="font-mono text-[10px] text-emerald-800">
                            {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {c.rating ? (
                          <div className="flex items-center space-x-1 text-amber-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3.5 h-3.5 ${star <= (c.rating || 0) ? 'fill-amber-400' : 'text-gray-300'}`} />
                            ))}
                            <span className="text-[11px] font-bold text-gray-700 ml-1 font-mono">✓ Feedback Submitted</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => navigate(`/citizen/complaint/${c.id}`)}
                            className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-extrabold text-[11px] hover:bg-emerald-700 min-h-[44px]"
                          >
                            Rate Resolution Quality
                          </button>
                        )}
                      </div>
                    )}

                  </div>

                  {/* CARD FOOTER CTAS (VIEW COMPLAINT & VIEW LOCATION) */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedLocation({
                        isOpen: true,
                        title: c.title,
                        address: c.location_address || 'City Location',
                        latitude: Number(c.latitude),
                        longitude: Number(c.longitude),
                        source: c.location_source || 'live_gps'
                      })}
                      className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center space-x-1 min-h-[44px]"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>View Location</span>
                    </button>

                    <Link
                      to={`/citizen/complaint/${c.id}`}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center space-x-1 transition-all min-h-[44px]"
                    >
                      <span>View Complaint</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* LOCATION VIEW MODAL */}
      <LocationModal
        isOpen={selectedLocation.isOpen}
        onClose={() => setSelectedLocation((prev) => ({ ...prev, isOpen: false }))}
        title={selectedLocation.title}
        address={selectedLocation.address}
        latitude={selectedLocation.latitude}
        longitude={selectedLocation.longitude}
        locationSource={selectedLocation.source}
      />
    </DashboardLayout>
  );
};
