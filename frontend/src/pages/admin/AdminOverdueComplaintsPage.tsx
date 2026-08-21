import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { getAllComplaints } from '../../services/complaintService';
import {
  formatSlaRemainingTime, getDepartmentStaffRoster, assignStaffToTask,
  changeDepartmentRouting, escalateComplaint
} from '../../services/adminService';
import { exportComplaintsToCSV } from '../../services/analyticsService';
import { Complaint, PriorityLevel } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Search, Download, RefreshCw, AlertTriangle, MapPin, Clock,
  ArrowUpDown, ChevronLeft, ChevronRight, X, Maximize2, Building2,
  UserCheck, ShieldAlert, Layers, ExternalLink, Send, ArrowRight,
  Sparkles, CheckCircle2, UserPlus, SlidersHorizontal
} from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  'Roads & Public Works',
  'Sanitation & Solid Waste',
  'Water Supply & Sewerage',
  'Electrical & Lighting',
  'Drainage & Stormwater',
  'Traffic Management'
];

const CATEGORY_OPTIONS = [
  'Pothole',
  'Overflowing Dustbin',
  'Water Leakage',
  'Streetlight',
  'Drainage Overflow',
  'Traffic Signal'
];

const WARD_OPTIONS = [
  'Ward 1',
  'Ward 4',
  'Ward 8',
  'Ward 12',
  'Ward 15',
  'Ward 20'
];

type SortField = 'complaint_number' | 'priority' | 'overdue_ms' | 'created_at' | 'department_name' | 'assigned_staff_name';

export const AdminOverdueComplaintsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [staffFilter, setStaffFilter] = useState('All');
  const [wardFilter, setWardFilter] = useState('All');
  const [overdueDurationFilter, setOverdueDurationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('overdue_ms');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Complaint for Detail Review Drawer / Modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showFullImageModal, setShowFullImageModal] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Escalation & Reassignment Modal State
  const [escalationTarget, setEscalationTarget] = useState('Senior Department Officer');
  const [isEscalating, setIsEscalating] = useState(false);

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignDept, setReassignDept] = useState('Roads & Public Works');
  const [reassignStaffId, setReassignStaffId] = useState('');
  const [reassignSlaHours, setReassignSlaHours] = useState(24);
  const [submittingReassign, setSubmittingReassign] = useState(false);

  // Load Complaints Data
  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getAllComplaints();
      setComplaints(list);
    } catch (e) {
      console.error(e);
      setError('Unable to load overdue complaints.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Subscribe to realtime updates
  useRealtimeComplaints(useCallback(() => {
    loadComplaints();
  }, [loadComplaints]));

  // Helper for overdue calculation
  const calculateOverdueInfo = useCallback((c: Complaint) => {
    if (c.status === 'Resolved') {
      return { isOverdue: false, text: 'Resolved', overdueMs: 0, hours: 0, mins: 0, days: 0 };
    }
    if (!c.sla_deadline) {
      // Default fallback 24h from created_at
      const fallbackDeadline = new Date(c.created_at).getTime() + 24 * 3600000;
      const diffMs = Date.now() - fallbackDeadline;
      if (diffMs > 0) {
        const overdueMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(overdueMins / 60);
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        const mins = overdueMins % 60;
        let text = `${hours}h ${mins}m overdue`;
        if (days > 0) text = `${days}d ${remHours}h overdue`;
        return { isOverdue: true, text, overdueMs: diffMs, hours, mins, days };
      }
      return { isOverdue: false, text: 'Within SLA', overdueMs: 0, hours: 0, mins: 0, days: 0 };
    }

    const deadlineTime = new Date(c.sla_deadline).getTime();
    const diffMs = Date.now() - deadlineTime;

    if (diffMs > 0) {
      const overdueMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(overdueMins / 60);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const mins = overdueMins % 60;

      let text = `${hours}h ${mins}m overdue`;
      if (days > 0) {
        text = `${days} day${days > 1 ? 's' : ''} ${remHours > 0 ? `${remHours}h` : ''} overdue`.trim();
      }

      return { isOverdue: true, text, overdueMs: diffMs, hours, mins, days };
    }

    return { isOverdue: false, text: 'Within SLA', overdueMs: 0, hours: 0, mins: 0, days: 0 };
  }, []);

  // Filter complaints that are currently overdue
  const overdueList = useMemo(() => {
    return complaints.filter((c) => {
      const info = calculateOverdueInfo(c);
      return info.isOverdue;
    });
  }, [complaints, calculateOverdueInfo]);

  // Compute Summary Statistics
  const summaryStats = useMemo(() => {
    const total = overdueList.length;
    const criticalCount = overdueList.filter((c) => c.priority === 'Critical').length;
    const highCount = overdueList.filter((c) => c.priority === 'High').length;
    
    const awaitingStaffCount = overdueList.filter((c) => !c.assigned_staff_id || !c.assigned_staff_name || ['Submitted', 'Verified', 'Approved', 'Department Assigned'].includes(c.status)).length;
    const inProgressCount = overdueList.filter((c) => ['Accepted', 'On the Way', 'In Progress', 'Resolution Submitted'].includes(c.status)).length;

    // Find longest overdue time text
    let maxMs = 0;
    let longestText = 'None';
    overdueList.forEach((c) => {
      const info = calculateOverdueInfo(c);
      if (info.overdueMs > maxMs) {
        maxMs = info.overdueMs;
        longestText = info.text;
      }
    });

    return {
      total,
      criticalCount,
      highCount,
      awaitingStaffCount,
      inProgressCount,
      longestText
    };
  }, [overdueList, calculateOverdueInfo]);

  // Filtered List based on toolbar selections
  const filteredList = useMemo(() => {
    return overdueList.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = c.complaint_number.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesLoc = (c.location_address || '').toLowerCase().includes(q);
        const matchesStaff = (c.assigned_staff_name || '').toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesLoc && !matchesStaff) return false;
      }

      // Department
      if (departmentFilter !== 'All' && c.department_name && !c.department_name.toLowerCase().includes(departmentFilter.toLowerCase())) return false;

      // Priority
      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;

      // Category
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;

      // Assigned Staff
      if (staffFilter !== 'All') {
        if (staffFilter === 'Unassigned' && (c.assigned_staff_id || c.assigned_staff_name)) return false;
        if (staffFilter === 'Assigned Staff' && (!c.assigned_staff_id && !c.assigned_staff_name)) return false;
      }

      // Ward / Area
      if (wardFilter !== 'All' && c.location_address && !c.location_address.toLowerCase().includes(wardFilter.toLowerCase())) return false;

      // Current Status
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;

      // Overdue Duration
      if (overdueDurationFilter !== 'All') {
        const info = calculateOverdueInfo(c);
        if (overdueDurationFilter === '< 6 Hours' && info.hours >= 6) return false;
        if (overdueDurationFilter === '6-24 Hours' && (info.hours < 6 || info.hours >= 24)) return false;
        if (overdueDurationFilter === '1-3 Days' && (info.days < 1 || info.days >= 3)) return false;
        if (overdueDurationFilter === '> 3 Days' && info.days < 3) return false;
      }

      return true;
    });
  }, [overdueList, searchQuery, departmentFilter, priorityFilter, categoryFilter, staffFilter, wardFilter, statusFilter, overdueDurationFilter, calculateOverdueInfo]);

  // Sorted List
  const sortedList = useMemo(() => {
    const priorityWeight: Record<PriorityLevel, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };

    return [...filteredList].sort((a, b) => {
      let valA: any = a[sortField as keyof Complaint] || '';
      let valB: any = b[sortField as keyof Complaint] || '';

      if (sortField === 'overdue_ms') {
        valA = calculateOverdueInfo(a).overdueMs;
        valB = calculateOverdueInfo(b).overdueMs;
      } else if (sortField === 'priority') {
        valA = priorityWeight[a.priority] || 0;
        valB = priorityWeight[b.priority] || 0;
      } else if (sortField === 'created_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredList, sortField, sortOrder, calculateOverdueInfo]);

  // Paginated List
  const totalPages = Math.ceil(sortedList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  // Toggle Sorting Column
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setStaffFilter('All');
    setWardFilter('All');
    setOverdueDurationFilter('All');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  // Escalate Complaint Action
  const handleEscalateAction = async (complaintId: string) => {
    setIsEscalating(true);
    try {
      await escalateComplaint(complaintId, escalationTarget);
      setActionSuccessMessage(`Complaint successfully escalated to ${escalationTarget}.`);
      loadComplaints();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEscalating(false);
    }
  };

  // Reassign Staff / Department Action
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setSubmittingReassign(true);
    try {
      const roster = getDepartmentStaffRoster(reassignDept);
      const staffMember = roster.find((s) => s.id === reassignStaffId);
      const staffName = staffMember ? staffMember.name : 'Ramesh Kumar';

      await changeDepartmentRouting(selectedComplaint.id, reassignDept);
      if (reassignStaffId) {
        await assignStaffToTask(selectedComplaint.id, reassignStaffId, staffName, reassignSlaHours);
      }

      setActionSuccessMessage(`Routing updated & assigned to ${staffName}.`);
      setShowReassignModal(false);
      loadComplaints();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReassign(false);
    }
  };

  return (
    <DashboardLayout title="Overdue Complaints">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen">

        {/* SUCCESS NOTIFICATION TOAST */}
        {actionSuccessMessage && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold font-outfit animate-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button onClick={() => setActionSuccessMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================================================== */}
        {/* 2. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Overdue Complaints
              </h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-rose-50 text-rose-800 border border-rose-300">
                {summaryStats.total} Overdue Complaints
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Monitor complaints that have exceeded their resolution timeline and require immediate attention.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadComplaints}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => exportComplaintsToCSV(filteredList)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 3. URGENT SUMMARY BAR (Compact bordered sections) */}
        {/* ================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
          
          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Total Overdue
            </span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">
              {summaryStats.total}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Critical Priority
            </span>
            <span className="text-xl font-extrabold text-rose-800 font-mono block">
              {summaryStats.criticalCount}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              High Priority
            </span>
            <span className="text-xl font-extrabold text-amber-700 font-mono block">
              {summaryStats.highCount}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Awaiting Staff
            </span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">
              {summaryStats.awaitingStaffCount}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              In Progress
            </span>
            <span className="text-xl font-extrabold text-blue-700 font-mono block">
              {summaryStats.inProgressCount}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Longest Overdue
            </span>
            <span className="text-sm font-extrabold text-rose-700 font-mono block truncate pt-1">
              {summaryStats.longestText}
            </span>
          </div>

        </div>

        {/* ================================================== */}
        {/* 4. FILTER TOOLBAR */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search complaint ID, issue or location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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

            {/* Filter Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
            
            {/* Department Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Depts</option>
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Categories</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Assigned Staff Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Assigned Staff
              </label>
              <select
                value={staffFilter}
                onChange={(e) => { setStaffFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Staff</option>
                <option value="Assigned Staff">Assigned</option>
                <option value="Unassigned">Unassigned</option>
              </select>
            </div>

            {/* Ward / Area Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Ward / Area
              </label>
              <select
                value={wardFilter}
                onChange={(e) => { setWardFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Wards</option>
                {WARD_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* Overdue Duration Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Overdue Duration
              </label>
              <select
                value={overdueDurationFilter}
                onChange={(e) => { setOverdueDurationFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Duration</option>
                <option value="< 6 Hours">&lt; 6 Hours</option>
                <option value="6-24 Hours">6–24 Hours</option>
                <option value="1-3 Days">1–3 Days</option>
                <option value="> 3 Days">&gt; 3 Days</option>
              </select>
            </div>

            {/* Current Status Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Current Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-rose-500"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="Department Assigned">Department Assigned</option>
                <option value="Staff Assigned">Staff Assigned</option>
                <option value="Accepted">Accepted</option>
                <option value="On the Way">On the Way</option>
                <option value="In Progress">In Progress</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* 5. MAIN OVERDUE TABLE */}
        {/* ================================================== */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          
          {loading ? (
            /* 22. LOADING STATE - Skeleton Rows */
            <div className="p-6 space-y-4">
              <div className="h-6 bg-gray-100 rounded w-1/4 animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded border border-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            /* 23. ERROR STATE */
            <div className="p-12 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">Unable to load overdue complaints</h3>
                <p className="text-xs text-gray-500">Please check system connection and try again.</p>
              </div>
              <button
                onClick={loadComplaints}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-lg hover:bg-rose-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : paginatedList.length === 0 ? (
            /* 21. EMPTY STATE */
            <div className="p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-gray-900 font-outfit">No Overdue Complaints</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Excellent — all active complaints are currently within their resolution timelines.
              </p>
              <button
                onClick={loadComplaints}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                
                {/* TABLE HEADER WITH SORTING */}
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                    
                    <th
                      onClick={() => handleSort('complaint_number')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Complaint ID</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th className="py-3 px-4 whitespace-nowrap">Issue</th>

                    <th className="py-3 px-4 whitespace-nowrap">Location</th>

                    <th
                      onClick={() => handleSort('priority')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Priority</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('department_name')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Department</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('assigned_staff_name')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Assigned Staff</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th className="py-3 px-4 whitespace-nowrap">Current Status</th>

                    <th
                      onClick={() => handleSort('overdue_ms')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Overdue By</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('created_at')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Reported On</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>

                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody className="divide-y divide-gray-200 text-xs font-medium text-gray-800">
                  {paginatedList.map((comp) => {
                    const overdueInfo = calculateOverdueInfo(comp);

                    return (
                      <tr
                        key={comp.id}
                        className={`hover:bg-slate-50/90 transition-colors ${
                          comp.priority === 'Critical' ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        {/* 1. Complaint ID */}
                        <td className="py-3 px-4 font-mono font-extrabold text-rose-700 whitespace-nowrap">
                          {comp.complaint_number}
                        </td>

                        {/* 2. Issue */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-900 line-clamp-1">
                              {comp.title}
                            </span>
                            <span className="inline-block text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                              {comp.category}
                            </span>
                          </div>
                        </td>

                        {/* 3. Location */}
                        <td className="py-3 px-4 max-w-xs text-gray-600 truncate">
                          {comp.location_address || `Ward ${comp.latitude.toFixed(2)}, Zone`}
                        </td>

                        {/* 4. Priority */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <PriorityBadge priority={comp.priority} />
                        </td>

                        {/* 5. Department */}
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap font-medium">
                          {comp.department_name || 'Unassigned'}
                        </td>

                        {/* 6. Assigned Staff */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {comp.assigned_staff_name ? (
                            <span className="font-bold text-gray-900 block">
                              {comp.assigned_staff_name}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold italic block">
                              Not Assigned
                            </span>
                          )}
                        </td>

                        {/* 7. Current Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={comp.status} />
                        </td>

                        {/* 6 & 8. Overdue By Indicator (NAGARSETU Rose alert styling) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold font-mono bg-rose-50 text-rose-800 border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600 mr-1" />
                            {overdueInfo.text}
                          </span>
                        </td>

                        {/* 9. Reported On */}
                        <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">
                          {new Date(comp.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>

                        {/* 10. Action Buttons */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => setSelectedComplaint(comp)}
                              className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-gray-700 font-bold rounded-lg text-xs transition-colors"
                            >
                              Review
                            </button>

                            <button
                              onClick={() => handleEscalateAction(comp.id)}
                              disabled={isEscalating}
                              className="px-2 py-1 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                            >
                              Escalate
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}

          {/* ================================================== */}
          {/* 20. PAGINATION */}
          {/* ================================================== */}
          {!loading && sortedList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 bg-slate-50">
              
              <div className="text-xs font-medium text-gray-600 font-mono">
                Showing{' '}
                <span className="font-bold text-gray-900">
                  {Math.min((currentPage - 1) * pageSize + 1, sortedList.length)}
                </span>
                –
                <span className="font-bold text-gray-900">
                  {Math.min(currentPage * pageSize, sortedList.length)}
                </span>{' '}
                of <span className="font-bold text-gray-900">{sortedList.length}</span> overdue complaints
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                  Previous
                </button>

                <div className="flex items-center space-x-1 px-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-colors ${
                        currentPage === pageNum
                          ? 'bg-rose-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* ================================================== */}
        {/* 11 & 18. OVERDUE COMPLAINT REVIEW DRAWER / MODAL */}
        {/* ================================================== */}
        {selectedComplaint && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-gray-900">
              
              {/* 18. ESCALATION & SLA BREACH WARNING BANNER */}
              <div className="bg-rose-600 text-white px-5 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2 font-outfit text-xs sm:text-sm font-extrabold tracking-wide">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>⚠ SLA BREACHED — This complaint has exceeded the expected resolution time.</span>
                </div>
                <span className="font-mono text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded border border-white/30 shrink-0">
                  Overdue By: {calculateOverdueInfo(selectedComplaint).text}
                </span>
              </div>

              {/* MODAL HEADER */}
              <div className="p-4 sm:p-5 border-b border-gray-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-extrabold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded border border-rose-300">
                      {selectedComplaint.complaint_number}
                    </span>
                    <StatusBadge status={selectedComplaint.status} />
                    <PriorityBadge priority={selectedComplaint.priority} />
                  </div>
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">
                    {selectedComplaint.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                
                {/* 12. SLA INFORMATION SECTION */}
                <div className="border border-rose-200 rounded-xl p-4 bg-rose-50/40 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 font-outfit flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-rose-700" />
                    <span>SLA INFORMATION & TIMELINE BREACH</span>
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Reported On</span>
                      <span className="font-mono font-bold text-gray-900 block">
                        {new Date(selectedComplaint.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">SLA Deadline</span>
                      <span className="font-mono font-bold text-rose-700 block">
                        {selectedComplaint.sla_deadline ? new Date(selectedComplaint.sla_deadline).toLocaleString() : '24h SLA'}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Current Time</span>
                      <span className="font-mono font-bold text-gray-900 block">
                        {new Date().toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-rose-800 uppercase block font-outfit">Overdue Duration</span>
                      <span className="font-mono font-extrabold text-rose-800 block">
                        {calculateOverdueInfo(selectedComplaint).text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 13. LATEST WORK UPDATE SECTION */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>LATEST MAINTENANCE WORK UPDATE</span>
                  </h3>

                  {selectedComplaint.work_performed ? (
                    <div className="space-y-1 bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-800">
                        "{selectedComplaint.work_performed}"
                      </p>
                      {selectedComplaint.materials_used && (
                        <p className="text-[11px] font-mono text-gray-600 pt-1">
                          <strong className="font-bold text-gray-700">Materials:</strong> {selectedComplaint.materials_used}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1 border-t border-gray-100">
                        <span>Updated By: {selectedComplaint.assigned_staff_name || 'Service Staff'}</span>
                        <span>Updated On: {new Date(selectedComplaint.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-lg border border-gray-200 text-center">
                      <p className="text-xs text-gray-500 italic">No maintenance update has been submitted yet.</p>
                    </div>
                  )}
                </div>

                {/* 10. ESCALATION STATUS & ACTION PANEL */}
                <div className="border border-amber-300 rounded-xl p-4 bg-amber-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 font-outfit flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>ESCALATION STATUS & PROTOCOL</span>
                    </h3>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-amber-200">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Select Escalation Level</span>
                      <select
                        value={escalationTarget}
                        onChange={(e) => setEscalationTarget(e.target.value)}
                        className="p-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-bold text-gray-800"
                      >
                        <option value="Senior Department Officer">Escalate to Senior Officer</option>
                        <option value="Department Head (HOD)">Escalate to Department Head (HOD)</option>
                        <option value="Municipal Commissioner Office">Escalate to Commissioner Office</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleEscalateAction(selectedComplaint.id)}
                        disabled={isEscalating}
                        className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-lg hover:bg-rose-700 transition-colors shadow-xs flex items-center space-x-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch Escalation</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 16. BEFORE / AFTER PROOF COMPARISON */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* BEFORE PHOTO */}
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <span className="text-xs font-bold text-gray-700 block font-outfit">BEFORE — Reported Issue</span>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                      {selectedComplaint.photo_before_url ? (
                        <img src={selectedComplaint.photo_before_url} alt="Before" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-gray-400 font-mono">No Image</div>
                      )}
                      {selectedComplaint.photo_before_url && (
                        <button
                          onClick={() => setShowFullImageModal(selectedComplaint.photo_before_url)}
                          className="absolute bottom-2 right-2 p-1 bg-black/60 text-white rounded hover:bg-black"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LATEST PROGRESS PHOTO */}
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    <span className="text-xs font-bold text-gray-700 block font-outfit">LATEST PROGRESS / WORK PROOF</span>
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                      {selectedComplaint.photo_after_url || selectedComplaint.photo_before_work_url ? (
                        <img
                          src={selectedComplaint.photo_after_url || selectedComplaint.photo_before_work_url}
                          alt="Progress Proof"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-gray-400 font-mono">
                          No Progress Image Uploaded
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 14. LOCATION & MAP */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>LOCATION & GPS DETAILS</span>
                  </h3>
                  <p className="text-xs font-medium text-gray-800">
                    {selectedComplaint.location_address || 'Municipal Zone 4, Ward 12'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500">
                    GPS Coordinates: {selectedComplaint.latitude.toFixed(4)}° N, {selectedComplaint.longitude.toFixed(4)}° E ({selectedComplaint.location_source})
                  </p>

                  <div className="h-44 rounded-xl overflow-hidden border border-gray-200">
                    <LocationMapPicker
                      initialLat={selectedComplaint.latitude}
                      initialLng={selectedComplaint.longitude}
                      interactive={false}
                    />
                  </div>
                </div>

                {/* 15. DUPLICATE INTELLIGENCE */}
                {(selectedComplaint.support_count || 0) > 1 && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-900 font-outfit flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>SIMILAR CITIZEN REPORTS & COMMUNITY IMPACT</span>
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold font-mono rounded-full">
                        {selectedComplaint.support_count} Upvotes / Linked Reports
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Multiple citizens have flagged this defect in the same neighborhood. High community impact.
                    </p>
                  </div>
                )}

                {/* COMPLAINT TIMELINE & LOG */}
                <div className="space-y-4 pt-2">
                  <ActivityTimeline complaintId={selectedComplaint.id} />
                </div>

              </div>

              {/* 17. MODAL FOOTER WITH ADMIN ACTIONS */}
              <div className="p-4 border-t border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setReassignDept(selectedComplaint.department_name || 'Roads & Public Works');
                      setShowReassignModal(true);
                    }}
                    className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-gray-600" />
                    <span>Reassign Staff / Dept</span>
                  </button>

                  <button
                    onClick={() => handleEscalateAction(selectedComplaint.id)}
                    disabled={isEscalating}
                    className="px-3.5 py-2 bg-rose-600 text-white hover:bg-rose-700 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Escalate Now</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>

            </div>

          </div>
        )}

        {/* REASSIGN MODAL */}
        {showReassignModal && selectedComplaint && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleReassignSubmit}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-gray-900 animate-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">
                  Reassign Overdue Task
                </h3>
                <button type="button" onClick={() => setShowReassignModal(false)}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Department</label>
                  <select
                    value={reassignDept}
                    onChange={(e) => setReassignDept(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                  >
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Select Field Staff</label>
                  <select
                    value={reassignStaffId}
                    onChange={(e) => setReassignStaffId(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold"
                  >
                    <option value="">Select Staff Officer</option>
                    {getDepartmentStaffRoster(reassignDept).map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.employee_id}) — {s.active_workload_count} active tasks</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">New SLA Deadline Extension (Hours)</label>
                  <select
                    value={reassignSlaHours}
                    onChange={(e) => setReassignSlaHours(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold font-mono"
                  >
                    <option value={12}>12 Hours SLA</option>
                    <option value={24}>24 Hours SLA (Default)</option>
                    <option value={48}>48 Hours SLA</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReassign}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700"
                >
                  {submittingReassign ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* FULL IMAGE LIGHTBOX MODAL */}
        {showFullImageModal && (
          <div
            onClick={() => setShowFullImageModal(null)}
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
              <img src={showFullImageModal} alt="Enlarged" className="w-full h-full object-contain" />
              <button
                onClick={() => setShowFullImageModal(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
