import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import {
  getStoredComplaints, getStaffTasks, assignTaskByDepartmentHead,
  requestReworkDepartmentHead, approveResolutionDepartmentHead, getComplaintById,
  getDepartmentComplaints
} from '../../services/complaintService';
import {
  getAllServiceStaffRecords, formatSlaRemainingTime, ServiceStaffMemberRecord,
  getDepartmentServiceStaff
} from '../../services/adminService';
import { getNotificationsForRole } from '../../services/notificationService';
import { Complaint, ComplaintStatus, UserProfile, NotificationItem } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Wrench, CheckCircle2, Clock, AlertTriangle, MapPin, Upload,
  Camera, Check, Play, Navigation, Eye, UserCheck, ShieldCheck, Zap, X,
  Search, Lock, Building2, User, RefreshCw, FileText, ChevronRight,
  MessageSquarePlus, Star, ArrowRight, Map, Bell, Sliders, Calendar,
  TrendingUp, Award, Activity, Droplets, Trash2, Waves, Shield, PlusCircle,
  Users, Layers, CornerDownRight, RotateCcw, Download, Filter, CheckSquare,
  Square, ChevronLeft, ExternalLink, FileSpreadsheet, Info
} from 'lucide-react';

// Fix standard Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getDepartmentInfo = (departmentName: string) => {
  const nameLower = (departmentName || '').toLowerCase();
  if (nameLower.includes('sanitation') || nameLower.includes('waste')) {
    return {
      fullName: 'Sanitation & Waste Management',
      shortName: 'Sanitation & Waste',
      icon: Trash2,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
      description: 'Solid waste collection, dumpster clearing, street sweeping & public sanitation.',
      taskTypes: ['Garbage Collection', 'Dustbin Cleanup', 'Waste Removal']
    };
  }
  if (nameLower.includes('water')) {
    return {
      fullName: 'Water Supply & Sewerage Board',
      shortName: 'Water Supply & Sewerage',
      icon: Droplets,
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-300',
      description: 'Potable water mains, underground pipeline leakage sealing & sewerage network maintenance.',
      taskTypes: ['Pipeline Repair', 'Water Leakage', 'Water Supply Issue']
    };
  }
  if (nameLower.includes('drainage') || nameLower.includes('sewage')) {
    return {
      fullName: 'Drainage & Stormwater Dept',
      shortName: 'Drainage & Stormwater',
      icon: Waves,
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-300',
      description: 'Monsoon stormwater channels, drain de-silting & urban flood mitigation.',
      taskTypes: ['Drain Blockage', 'Sewage Overflow', 'Drain Cleaning']
    };
  }
  if (nameLower.includes('electric') || nameLower.includes('light')) {
    return {
      fullName: 'Electrical & Lighting Dept',
      shortName: 'Electrical & Lighting',
      icon: Zap,
      badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      description: 'LED streetlights, junction box repairs & municipal electrical grid maintenance.',
      taskTypes: ['Streetlight Repair', 'Electrical Maintenance', 'Cable Repair']
    };
  }
  if (nameLower.includes('traffic')) {
    return {
      fullName: 'Traffic Management Dept',
      shortName: 'Traffic Management',
      icon: Activity,
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-300',
      description: 'Traffic light signals, road signage & junction traffic flow.',
      taskTypes: ['Traffic Signal Repair', 'Signage Maintenance', 'Traffic Infrastructure']
    };
  }
  return {
    fullName: 'Roads & Public Works (PWD)',
    shortName: 'Public Works (PWD)',
    icon: Wrench,
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    description: 'Pothole Patching, Road Damage & Public Infrastructure Repairs.',
    taskTypes: ['Pothole Repair', 'Road Maintenance', 'Infrastructure Repair']
  };
};

export const DepartmentHeadPortal: React.FC = () => {
  const { user } = useAuth();
  const { t, translateCategory, translateStatus, translatePriority } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Sub-routes & active view modes
  const currentPath = location.pathname;
  const isDashboard = currentPath === '/department-head/portal';
  const isComplaints = currentPath === '/department-head/complaints';
  const isAssign = currentPath === '/department-head/tasks/assign';
  const isInProgress = currentPath === '/department-head/tasks/in-progress';
  const isCompleted = currentPath === '/department-head/tasks/completed';
  const isOverdue = currentPath === '/department-head/tasks/overdue';
  const isStaffView = currentPath === '/department-head/staff';
  const isMapView = currentPath === '/department-head/map';
  const isNotifView = currentPath === '/department-head/notifications';
  const isProfileView = currentPath === '/department-head/profile';
  const isSettingsView = currentPath === '/department-head/settings';

  // Department Identity
  const headName = user?.full_name || 'Anil Kulkarni';
  const headDepartmentFull = user?.department_name || 'Public Works Department (PWD)';
  const headDepartment = headDepartmentFull.split('(')[0].trim() || 'Department';
  const headDeptId = user?.department_id || 'dept-pwd-001';
  const headId = user?.id || 'head-001';

  const deptInfo = useMemo(() => getDepartmentInfo(headDepartmentFull), [headDepartmentFull]);

  // Data States
  const [departmentComplaints, setDepartmentComplaints] = useState<Complaint[]>([]);
  const [departmentStaff, setDepartmentStaff] = useState<ServiceStaffMemberRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter Toolbar States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [staffFilter, setStaffFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');

  // Bulk Operations State
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [bulkPriorityModalOpen, setBulkPriorityModalOpen] = useState(false);
  const [targetBulkPriority, setTargetBulkPriority] = useState<string>('High');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals & Detail View
  const [assignModalComplaint, setAssignModalComplaint] = useState<Complaint | null>(null);
  const [selectedStaffForAssign, setSelectedStaffForAssign] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [reviewModalComplaint, setReviewModalComplaint] = useState<Complaint | null>(null);
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [detailModalComplaint, setDetailModalComplaint] = useState<Complaint | null>(null);
  const [mapLocationModal, setMapLocationModal] = useState<Complaint | null>(null);

  // Load Department Data (Complaints & Staff filtered strictly by department from Supabase)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Query complaints strictly for this department from Supabase
      const deptFilteredComplaints = await getDepartmentComplaints(headDeptId, headDepartmentFull);
      setDepartmentComplaints(deptFilteredComplaints);

      // 2. Query service staff strictly belonging to this department from Supabase
      const deptFilteredStaff = await getDepartmentServiceStaff(headDeptId, headDepartmentFull);
      setDepartmentStaff(deptFilteredStaff);

      // 3. Notifications
      const notifs = getNotificationsForRole(headId, 'department_head');
      setNotifications(notifs);

    } catch (err) {
      console.error('Error loading Department Head data:', err);
      setError('Unable to load complaints for your department. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [headDeptId, headDepartmentFull, headId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  const now = new Date();

  // Calculate Real Summary Statistics from Database Records
  const metrics = useMemo(() => {
    const total = departmentComplaints.length;
    const unassigned = departmentComplaints.filter((c) => !c.assigned_staff_id && c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const assigned = departmentComplaints.filter((c) => c.assigned_staff_id && (c.status === 'Staff Assigned' || c.status === 'Department Assigned')).length;
    const inProgress = departmentComplaints.filter((c) => c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'In Progress').length;
    const completedReviews = departmentComplaints.filter((c) => c.status === 'Resolution Submitted').length;
    const resolved = departmentComplaints.filter((c) => c.status === 'Resolved').length;
    
    const overdue = departmentComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    const critical = departmentComplaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const staffCount = departmentStaff.length;

    return { total, unassigned, assigned, inProgress, completedReviews, resolved, overdue, critical, staffCount };
  }, [departmentComplaints, departmentStaff, now]);

  // Unique categories for filter dropdown
  const availableCategories = useMemo(() => {
    return Array.from(new Set(departmentComplaints.map((c) => c.category).filter(Boolean)));
  }, [departmentComplaints]);

  // Filtered Complaint List with real Search, Filters & Route constraints
  const filteredComplaints = useMemo(() => {
    return departmentComplaints.filter((c) => {
      // Route specific filters
      if (isAssign && c.assigned_staff_id) return false;
      if (isInProgress && (c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way')) return false;
      if (isCompleted && (c.status !== 'Resolution Submitted' && c.status !== 'Resolved')) return false;
      if (isOverdue && (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline || new Date(c.sla_deadline) >= now)) return false;

      // Status Filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Unassigned' && c.assigned_staff_id) return false;
        if (statusFilter === 'Assigned' && !c.assigned_staff_id) return false;
        if (statusFilter !== 'Unassigned' && statusFilter !== 'Assigned' && c.status !== statusFilter) return false;
      }

      // Priority Filter
      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;

      // Category Filter
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;

      // Staff Filter
      if (staffFilter !== 'All') {
        if (staffFilter === 'Unassigned' && c.assigned_staff_id) return false;
        if (staffFilter !== 'Unassigned' && c.assigned_staff_id !== staffFilter && c.assigned_staff_name !== staffFilter) return false;
      }

      // Date Range Filter
      if (dateFilter !== 'All Time') {
        const createdDate = new Date(c.created_at);
        if (dateFilter === 'Today') {
          if (createdDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'This Week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
          if (createdDate < oneWeekAgo) return false;
        } else if (dateFilter === 'This Month') {
          if (createdDate.getMonth() !== now.getMonth() || createdDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // Search Query (ID, Title, Category, Location Address)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = c.complaint_number.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        const catMatch = c.category.toLowerCase().includes(q);
        const locMatch = (c.location_address || '').toLowerCase().includes(q);
        if (!numMatch && !titleMatch && !catMatch && !locMatch) return false;
      }

      return true;
    });
  }, [departmentComplaints, isAssign, isInProgress, isCompleted, isOverdue, statusFilter, priorityFilter, categoryFilter, staffFilter, dateFilter, searchQuery, now]);

  // Reset page index when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, staffFilter, dateFilter]);

  // Paginated Complaints
  const paginatedComplaints = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredComplaints.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredComplaints, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;

  // Select All Checkbox Handler
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedComplaints(paginatedComplaints.map((c) => c.id));
    } else {
      setSelectedComplaints([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedComplaints((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setStaffFilter('All');
    setDateFilter('All Time');
  };

  // Export Real Department Complaints to CSV
  const handleExportCSV = (selectedOnly: boolean = false) => {
    const targetList = selectedOnly && selectedComplaints.length > 0
      ? departmentComplaints.filter((c) => selectedComplaints.includes(c.id))
      : filteredComplaints;

    if (targetList.length === 0) return;

    const headers = ['Complaint ID', 'Title', 'Category', 'Location Address', 'Latitude', 'Longitude', 'Priority', 'Status', 'Assigned Staff', 'Reported Date'];
    const rows = targetList.map((c) => [
      `"${c.complaint_number}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${(c.category || '').replace(/"/g, '""')}"`,
      `"${(c.location_address || '').replace(/"/g, '""')}"`,
      c.latitude || '',
      c.longitude || '',
      c.priority,
      c.status,
      `"${(c.assigned_staff_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${new Date(c.created_at).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${deptInfo.shortName.replace(/[^a-z0-9]/gi, '_')}_Complaints_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm Task Assignment to Department Staff
  const handleConfirmAssignment = async () => {
    if (!assignModalComplaint || !selectedStaffForAssign) {
      setAssignError('Please select an active service staff member.');
      return;
    }

    const staffObj = departmentStaff.find((s) => s.id === selectedStaffForAssign);
    if (!staffObj) {
      setAssignError('Selected staff record not found.');
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      await assignTaskByDepartmentHead(
        assignModalComplaint.id,
        staffObj.id,
        staffObj.name,
        staffObj.department_name || headDepartmentFull,
        headId,
        headName,
        headDepartmentFull
      );

      setAssignModalComplaint(null);
      setSelectedStaffForAssign('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      setAssignError(err.message || 'Error executing task assignment.');
    } finally {
      setAssigning(false);
    }
  };

  // Confirm Approval of Completed Work Proof
  const handleApproveResolution = async (complaintId: string) => {
    setReviewing(true);
    try {
      await approveResolutionDepartmentHead(complaintId, headName);
      setReviewModalComplaint(null);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error approving resolution.');
    } finally {
      setReviewing(false);
    }
  };

  // Request Field Work Rework
  const handleRequestRework = async (complaintId: string) => {
    if (!reworkReason.trim()) {
      alert('Please provide instructions for the rework.');
      return;
    }
    setReviewing(true);
    try {
      await requestReworkDepartmentHead(complaintId, reworkReason.trim(), headName);
      setReviewModalComplaint(null);
      setShowReworkInput(false);
      setReworkReason('');
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error requesting rework.');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <DashboardLayout title="All Complaints">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* ================================================== */}
        {/* 1. DYNAMIC DEPARTMENT HEADER CARD */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className={`p-3.5 rounded-xl border ${deptInfo.badgeColor} shrink-0 shadow-2xs`}>
              <deptInfo.icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                  {deptInfo.fullName}
                </h1>
                <span className="font-mono text-[10px] font-extrabold bg-white text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  DEPARTMENT HEAD PORTAL
                </span>
                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ID: {headDeptId}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                Managed by <span className="font-bold text-gray-900">{headName}</span> • Primary Work: <span className="text-gray-800 font-semibold">{deptInfo.description}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-xs flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] font-mono text-gray-500 font-bold block">Department Staff</span>
                <span className="font-extrabold text-gray-900 font-mono">{metrics.staffCount} Active Members</span>
              </div>
            </div>

            <button
              onClick={() => handleExportCSV(false)}
              className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-all min-h-[40px]"
              title="Export Report to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Report</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[40px]"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 2. PROFILE VIEW (If route is /department-head/profile) */}
        {/* ================================================== */}
        {isProfileView ? (
          <div className="max-w-3xl mx-auto space-y-6 py-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-6 shadow-xs">
              <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                  {headName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 font-outfit">{headName}</h2>
                  <span className="text-xs font-bold text-emerald-700 block">Department Head</span>
                  <span className="font-mono text-xs text-gray-500 block">Scope: {deptInfo.fullName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Official Email</span>
                  <span className="font-extrabold text-gray-900 block">{user?.email || 'N/A'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Department Command</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-extrabold text-emerald-900">{deptInfo.fullName}</span>
                    <Lock className="w-3 h-3 text-gray-400" />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Operational Role</span>
                  <span className="font-extrabold text-gray-900 block">DEPARTMENT_HEAD</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Governance Status</span>
                  <span className="font-extrabold text-emerald-700 block">Active Municipal Executive</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================== */
          /* 3. MAIN PORTAL BODY & SUMMARY STATISTICS */
          /* ================================================== */
          <div className="space-y-6">

            {/* 8 SUMMARY METRIC CARDS (CALCULATED FROM REAL SUPABASE DATA) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div
                onClick={() => { setStatusFilter('All'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Complaints</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{metrics.total}</span>
              </div>

              <div
                onClick={() => { setStatusFilter('Unassigned'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Unassigned</span>
                <span className="text-xl font-extrabold text-blue-700 font-mono block">{metrics.unassigned}</span>
              </div>

              <div
                onClick={() => { setStatusFilter('Assigned'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Assigned</span>
                <span className="text-xl font-extrabold text-cyan-700 font-mono block">{metrics.assigned}</span>
              </div>

              <div
                onClick={() => { setStatusFilter('In Progress'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
                <span className="text-xl font-extrabold text-amber-700 font-mono block">{metrics.inProgress}</span>
              </div>

              <div
                onClick={() => { setStatusFilter('Resolution Submitted'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Pending Review</span>
                <span className="text-xl font-extrabold text-purple-700 font-mono block">{metrics.completedReviews}</span>
              </div>

              <div
                onClick={() => { navigate('/department-head/tasks/overdue'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue</span>
                <span className="text-xl font-extrabold text-rose-700 font-mono block">{metrics.overdue}</span>
              </div>

              <div
                onClick={() => { setStatusFilter('Resolved'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Resolved</span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono block">{metrics.resolved}</span>
              </div>

              <div
                onClick={() => { setPriorityFilter('Critical'); navigate('/department-head/complaints'); }}
                className="p-3.5 text-center space-y-1 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
                <span className="text-xl font-extrabold text-rose-800 font-mono block">{metrics.critical}</span>
              </div>
            </div>

            {/* CRITICAL SLA WARNING BANNER */}
            {metrics.overdue > 0 && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3 text-rose-900">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-extrabold font-outfit text-sm block">DEPARTMENT SLA BREACH WARNING</span>
                    <span className="text-rose-800">
                      There are <span className="font-mono font-extrabold">{metrics.overdue}</span> complaints in {deptInfo.shortName} that have exceeded SLA deadline.
                    </span>
                  </div>
                </div>
                <Link to="/department-head/tasks/overdue" className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg transition-colors shrink-0">
                  View Overdue Tasks
                </Link>
              </div>
            )}

            {/* VIEW MODE: STAFF ROSTER VIEW */}
            {isStaffView ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                      {deptInfo.shortName} Service Staff Roster ({departmentStaff.length})
                    </h2>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Filtered strictly by department constraint</span>
                </div>

                {departmentStaff.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                    <Users className="w-8 h-8 text-gray-400 mx-auto" />
                    <span className="font-bold text-gray-900 text-sm font-outfit block">No staff members found</span>
                    <span className="text-xs text-gray-500 block">No service staff registered under {deptInfo.fullName}.</span>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                          <th className="p-3.5">Staff ID</th>
                          <th className="p-3.5">Name</th>
                          <th className="p-3.5">Email</th>
                          <th className="p-3.5">Department</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {departmentStaff.map((staff) => (
                          <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-emerald-800">
                              {staff.employee_id || `STF-${staff.id.slice(0, 4).toUpperCase()}`}
                            </td>
                            <td className="p-3.5 font-bold text-gray-900">{staff.name}</td>
                            <td className="p-3.5 text-gray-600 font-mono">{staff.email}</td>
                            <td className="p-3.5 font-semibold text-gray-700">{staff.department_name || headDepartmentFull}</td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                <span>Active</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => {
                                  setStatusFilter('Unassigned');
                                  navigate('/department-head/complaints');
                                }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold rounded-lg transition-colors text-[11px] inline-flex items-center space-x-1"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Assign Work</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : isMapView ? (
              /* VIEW MODE: DEPARTMENT MAP */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Map className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                      {deptInfo.shortName} Live Civic Issue Map
                    </h2>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Nashik Municipal GIS Coordinates</span>
                </div>

                <div className="h-[550px] w-full rounded-2xl overflow-hidden border border-gray-200 shadow-xs relative z-0">
                  <MapContainer center={[20.0059, 73.7898]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    {departmentComplaints.map((c) => (
                      <Marker key={c.id} position={[c.latitude, c.longitude]}>
                        <Popup>
                          <div className="space-y-1 text-xs font-sans">
                            <strong className="text-emerald-700 block font-mono">{c.complaint_number}</strong>
                            <p className="font-bold text-gray-900">{c.title}</p>
                            <p className="text-gray-600">{c.location_address}</p>
                            <span className="inline-block mt-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Status: {c.status}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            ) : (
              /* ================================================== */
              /* 4. MAIN COMPLAINTS TABLE & SEARCH/FILTER TOOLBAR */
              /* ================================================== */
              <div className="space-y-4">
                
                {/* SEARCH & FILTERS TOOLBAR */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search complaint number, issue title, location..."
                        className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Unassigned">Unassigned</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Verified">Verified</option>
                        <option value="Approved">Approved</option>
                        <option value="Staff Assigned">Staff Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolution Submitted">Pending Review</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Reopened">Reopened</option>
                      </select>

                      {/* Priority Filter */}
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                      >
                        <option value="All">All Priorities</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>

                      {/* Category Filter */}
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                      >
                        <option value="All">All Categories</option>
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>

                      {/* Staff Filter */}
                      <select
                        value={staffFilter}
                        onChange={(e) => setStaffFilter(e.target.value)}
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                      >
                        <option value="All">All Staff</option>
                        <option value="Unassigned">Unassigned</option>
                        {departmentStaff.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>

                      {/* Date Range Filter */}
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                      >
                        <option value="All Time">Date: All Time</option>
                        <option value="Today">Today</option>
                        <option value="This Week">This Week</option>
                        <option value="This Month">This Month</option>
                      </select>

                      {/* Clear Filters Button */}
                      {(searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || categoryFilter !== 'All' || staffFilter !== 'All' || dateFilter !== 'All Time') && (
                        <button
                          onClick={handleClearFilters}
                          className="px-3.5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition-colors min-h-[42px]"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>

                  {/* FLOATING / BULK SELECTION ACTION BAR */}
                  {selectedComplaints.length > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-xs animate-fadeIn">
                      <div className="flex items-center space-x-2 text-emerald-900 font-bold">
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span>{selectedComplaints.length} Complaint(s) Selected</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const firstComp = departmentComplaints.find((c) => selectedComplaints.includes(c.id));
                            if (firstComp) setAssignModalComplaint(firstComp);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition-colors text-[11px]"
                        >
                          Bulk Assign Staff
                        </button>

                        <button
                          onClick={() => handleExportCSV(true)}
                          className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold rounded-lg transition-colors text-[11px]"
                        >
                          Export Selected CSV
                        </button>

                        <button
                          onClick={() => setSelectedComplaints([])}
                          className="px-2.5 py-1.5 bg-transparent hover:bg-emerald-200/50 text-emerald-800 font-semibold text-[11px] rounded"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. LOADING SKELETON STATE */}
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : error ? (
                  /* 6. ERROR STATE */
                  <div className="p-12 bg-white border border-rose-200 rounded-2xl text-center space-y-3 max-w-md mx-auto">
                    <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">Unable to load complaints</h3>
                    <p className="text-xs text-gray-600">Please check your connection and try again.</p>
                    <button
                      onClick={loadData}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredComplaints.length === 0 ? (
                  /* 7. EMPTY STATE */
                  <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                    <FileText className="w-10 h-10 text-gray-400 mx-auto" />
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">No complaints found</h3>
                    <p className="text-xs text-gray-500">There are currently no complaints assigned to your department matching your criteria.</p>
                    <button
                      onClick={loadData}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  /* 8. COMPLAINTS TABLE (DESKTOP) & CARDS (MOBILE) */
                  <div className="space-y-4">
                    
                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                            <th className="p-3.5 w-10 text-center">
                              <input
                                type="checkbox"
                                onChange={handleSelectAll}
                                checked={paginatedComplaints.length > 0 && paginatedComplaints.every((c) => selectedComplaints.includes(c.id))}
                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </th>
                            <th className="p-3.5">Complaint ID</th>
                            <th className="p-3.5">Issue & Category</th>
                            <th className="p-3.5">Location</th>
                            <th className="p-3.5">Priority</th>
                            <th className="p-3.5">Reported On</th>
                            <th className="p-3.5">Assigned Staff</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5">SLA Remaining</th>
                            <th className="p-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {paginatedComplaints.map((comp) => {
                            const isUnassigned = !comp.assigned_staff_id;
                            const isPendingReview = comp.status === 'Resolution Submitted';
                            const isSelected = selectedComplaints.includes(comp.id);
                            const slaInfo = formatSlaRemainingTime(comp.sla_deadline);

                            return (
                              <tr key={comp.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}>
                                <td className="p-3.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectRow(comp.id)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                                  <button onClick={() => setDetailModalComplaint(comp)} className="hover:underline text-left">
                                    {comp.complaint_number}
                                  </button>
                                </td>
                                <td className="p-3.5">
                                  <span className="font-bold text-gray-900 block line-clamp-1">{comp.title}</span>
                                  <span className="text-[10px] text-gray-500 font-mono">{comp.category}</span>
                                </td>
                                <td className="p-3.5 text-gray-700 font-medium max-w-xs">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">{comp.location_address || 'Nashik Service Area'}</span>
                                  </div>
                                  {comp.latitude && comp.longitude ? (
                                    <button
                                      onClick={() => setMapLocationModal(comp)}
                                      className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center space-x-0.5 mt-0.5"
                                    >
                                      <span>View on Map</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 block font-mono">Location unavailable</span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <PriorityBadge priority={comp.priority} />
                                </td>
                                <td className="p-3.5 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                                  {new Date(comp.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="p-3.5 font-semibold text-gray-800">
                                  {comp.assigned_staff_name ? (
                                    <span className="inline-flex items-center space-x-1 text-emerald-900 font-bold">
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{comp.assigned_staff_name}</span>
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 font-mono text-[11px] font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      Unassigned
                                    </span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <StatusBadge status={comp.status} />
                                </td>
                                <td className="p-3.5 font-mono text-[11px]">
                                  {comp.status === 'Resolved' ? (
                                    <span className="text-emerald-700 font-bold">Resolved</span>
                                  ) : slaInfo.isOverdue ? (
                                    <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 block w-fit">
                                      {slaInfo.text}
                                    </span>
                                  ) : (
                                    <span className="text-gray-700 font-semibold">{slaInfo.text}</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    <button
                                      onClick={() => setDetailModalComplaint(comp)}
                                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                                      title="View Details"
                                    >
                                      View
                                    </button>

                                    {isUnassigned ? (
                                      <button
                                        onClick={() => {
                                          setAssignModalComplaint(comp);
                                          setSelectedStaffForAssign(departmentStaff[0]?.id || '');
                                        }}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                        <span>Assign Staff</span>
                                      </button>
                                    ) : isPendingReview ? (
                                      <button
                                        onClick={() => setReviewModalComplaint(comp)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Review Proof</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setAssignModalComplaint(comp)}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                                      >
                                        Reassign
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* MOBILE CARDS VIEW */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {paginatedComplaints.map((comp) => {
                        const isUnassigned = !comp.assigned_staff_id;
                        const isPendingReview = comp.status === 'Resolution Submitted';
                        const slaInfo = formatSlaRemainingTime(comp.sla_deadline);

                        return (
                          <div key={comp.id} className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-bold text-emerald-700">{comp.complaint_number}</span>
                              <StatusBadge status={comp.status} />
                            </div>

                            <div>
                              <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</h4>
                              <span className="text-[11px] text-gray-500 font-mono block">{comp.category}</span>
                            </div>

                            <div className="text-xs text-gray-600 space-y-1">
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{comp.location_address || 'Nashik Service Area'}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span>Reported: {new Date(comp.created_at).toLocaleDateString()}</span>
                                <PriorityBadge priority={comp.priority} />
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs font-semibold">
                              <span className="text-gray-600">Assigned: {comp.assigned_staff_name || 'Unassigned'}</span>
                              <span className="font-mono text-[11px] text-gray-800">{slaInfo.text}</span>
                            </div>

                            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                              <button
                                onClick={() => setDetailModalComplaint(comp)}
                                className="px-3 py-1.5 bg-gray-100 text-gray-800 font-bold rounded-lg text-xs"
                              >
                                View Details
                              </button>
                              {isUnassigned ? (
                                <button
                                  onClick={() => setAssignModalComplaint(comp)}
                                  className="px-3.5 py-1.5 bg-emerald-600 text-white font-extrabold rounded-lg text-xs"
                                >
                                  Assign Staff
                                </button>
                              ) : isPendingReview ? (
                                <button
                                  onClick={() => setReviewModalComplaint(comp)}
                                  className="px-3.5 py-1.5 bg-emerald-600 text-white font-extrabold rounded-lg text-xs"
                                >
                                  Review Proof
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* PAGINATION BAR */}
                    {totalPages > 1 && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex items-center justify-between text-xs text-gray-700">
                        <span className="font-semibold">
                          Showing <span className="font-extrabold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                          <span className="font-extrabold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredComplaints.length)}</span> of{' '}
                          <span className="font-extrabold text-gray-900">{filteredComplaints.length}</span> complaints
                        </span>

                        <div className="flex items-center space-x-2 font-bold">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 min-h-[36px]"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-mono">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 min-h-[36px]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* ================================================== */}
        {/* ASSIGN STAFF MODAL (STRICT DEPARTMENT VALIDATION) */}
        {/* ================================================== */}
        {assignModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Assign Department Task</h3>
                </div>
                <button onClick={() => setAssignModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                <span className="font-mono text-emerald-700 font-bold block">{assignModalComplaint.complaint_number}</span>
                <h4 className="font-extrabold text-gray-900 text-sm">{assignModalComplaint.title}</h4>
                <p className="text-gray-600 text-[11px]">{assignModalComplaint.location_address}</p>
              </div>

              {assignError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {assignError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Select {deptInfo.shortName} Service Staff Member *
                </label>
                
                {departmentStaff.length === 0 ? (
                  <p className="text-xs text-rose-600 font-bold">No active service staff registered under {deptInfo.fullName}.</p>
                ) : (
                  <select
                    value={selectedStaffForAssign}
                    onChange={(e) => setSelectedStaffForAssign(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium min-h-[44px]"
                  >
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.employee_id || 'STF-001'}) — Status: {s.status || 'Active'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setAssignModalComplaint(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmAssignment}
                  disabled={assigning || departmentStaff.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px]"
                >
                  {assigning ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* COMPLAINT DETAIL MODAL */}
        {/* ================================================== */}
        {detailModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8 font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Complaint Details & Audit</h3>
                </div>
                <button onClick={() => setDetailModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-emerald-800 text-sm">{detailModalComplaint.complaint_number}</span>
                <div className="flex items-center space-x-2">
                  <PriorityBadge priority={detailModalComplaint.priority} />
                  <StatusBadge status={detailModalComplaint.status} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-extrabold text-gray-900 font-outfit">{detailModalComplaint.title}</h2>
                <p className="text-xs text-gray-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-gray-200">
                  {detailModalComplaint.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* CITIZEN PHOTO VS REPAIR PROOF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-gray-500 block">Citizen Issue Photo</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={detailModalComplaint.photo_before_url} alt="Before" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-emerald-700 block">Staff Repair Proof</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50">
                    {detailModalComplaint.photo_after_url ? (
                      <img src={detailModalComplaint.photo_after_url} alt="After" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Proof Pending</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 font-medium p-3.5 bg-slate-50 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Location Address</span>
                  <span>{detailModalComplaint.location_address || 'Nashik Service Area'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Assigned Field Staff</span>
                  <span>{detailModalComplaint.assigned_staff_name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-200">
                <button
                  onClick={() => setDetailModalComplaint(null)}
                  className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* MAP LOCATION MODAL */}
        {/* ================================================== */}
        {mapLocationModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">GIS Map Location</h3>
                </div>
                <button onClick={() => setMapLocationModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs space-y-1">
                <span className="font-mono font-bold text-emerald-700 block">{mapLocationModal.complaint_number}</span>
                <p className="font-bold text-gray-900">{mapLocationModal.title}</p>
                <p className="text-gray-600">{mapLocationModal.location_address}</p>
              </div>

              <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-200 relative z-0">
                <MapContainer center={[mapLocationModal.latitude, mapLocationModal.longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[mapLocationModal.latitude, mapLocationModal.longitude]}>
                    <Popup>
                      <strong className="text-xs text-emerald-700">{mapLocationModal.complaint_number}</strong>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setMapLocationModal(null)}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs"
                >
                  Close Map
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* REVIEW RESOLUTION PROOF MODAL */}
        {/* ================================================== */}
        {reviewModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8 font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Review Field Repair Proof</h3>
                </div>
                <button onClick={() => setReviewModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BEFORE VS AFTER PROOF COMPARISON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-gray-500 block">BEFORE (Citizen Complaint)</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={reviewModalComplaint.photo_before_url} alt="Before" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-emerald-700 block">AFTER (Staff Repair Proof)</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50">
                    {reviewModalComplaint.photo_after_url ? (
                      <img src={reviewModalComplaint.photo_after_url} alt="After" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Proof Unavailable</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                <span className="font-bold text-gray-900 block">Work Notes: {reviewModalComplaint.work_performed || 'Field maintenance work completed.'}</span>
                <span className="text-gray-600 block">Materials Used: {reviewModalComplaint.materials_used || 'Standard repair materials'}</span>
                <span className="text-gray-500 text-[11px] block">Executed by Staff: {reviewModalComplaint.assigned_staff_name}</span>
              </div>

              {showReworkInput ? (
                <div className="space-y-3 p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                  <label className="block font-bold text-amber-900">Enter Rework Instructions for Staff *</label>
                  <textarea
                    rows={2}
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    placeholder="Specify why repair proof was incomplete or needs rework..."
                    className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-gray-900"
                  />
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowReworkInput(false)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-xs font-bold text-gray-800">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRequestRework(reviewModalComplaint.id)}
                      disabled={reviewing}
                      className="px-4 py-1.5 rounded-lg bg-amber-700 text-white font-extrabold text-xs"
                    >
                      Confirm Rework Request
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setShowReworkInput(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs transition-colors inline-flex items-center justify-center space-x-1"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <span>Request Rework</span>
                  </button>

                  <button
                    onClick={() => handleApproveResolution(reviewModalComplaint.id)}
                    disabled={reviewing}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs inline-flex items-center justify-center space-x-1.5 disabled:opacity-50 min-h-[40px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{reviewing ? 'Approving...' : 'Approve Field Resolution'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
