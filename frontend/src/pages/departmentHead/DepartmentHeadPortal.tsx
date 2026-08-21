import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import {
  getStoredComplaints, getStaffTasks, assignTaskByDepartmentHead,
  requestReworkDepartmentHead, approveResolutionDepartmentHead, getComplaintById
} from '../../services/complaintService';
import { getAllServiceStaffRecords, formatSlaRemainingTime, ServiceStaffMemberRecord } from '../../services/adminService';
import { getNotificationsForRole } from '../../services/notificationService';
import { Complaint, ComplaintStatus, UserProfile, NotificationItem } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Wrench, CheckCircle2, Clock, AlertTriangle, MapPin, Upload,
  Camera, Check, Play, Navigation, Eye, UserCheck, ShieldCheck, Zap, X,
  Search, Lock, Building2, User, RefreshCw, FileText, ChevronRight,
  MessageSquarePlus, Star, ArrowRight, Map, Bell, Sliders, Calendar,
  TrendingUp, Award, Activity, Droplets, Trash2, Waves, Shield, PlusCircle,
  Users, Layers, CornerDownRight, RotateCcw
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
      description: 'Garbage Collection, Overflowing Dustbins & Waste Cleanup',
      taskTypes: ['Garbage Collection', 'Dustbin Cleanup', 'Waste Removal']
    };
  }
  if (nameLower.includes('water')) {
    return {
      fullName: 'Water Supply & Sewerage',
      shortName: 'Water & Sewerage',
      icon: Droplets,
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-300',
      description: 'Pipeline Maintenance, Water Leakage & Civic Water Supply',
      taskTypes: ['Pipeline Repair', 'Water Leakage', 'Water Supply Issue']
    };
  }
  if (nameLower.includes('drainage') || nameLower.includes('sewage')) {
    return {
      fullName: 'Drainage & Sewage Department',
      shortName: 'Drainage & Sewage',
      icon: Waves,
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-300',
      description: 'Drain Cleaning, Sewage Overflow & Underground Drainage',
      taskTypes: ['Drain Blockage', 'Sewage Overflow', 'Drain Cleaning']
    };
  }
  if (nameLower.includes('electric') || nameLower.includes('light')) {
    return {
      fullName: 'Electrical & Street Lighting',
      shortName: 'Electrical & Lighting',
      icon: Zap,
      badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      description: 'Streetlight Repair & Electrical Infrastructure Maintenance',
      taskTypes: ['Streetlight Repair', 'Electrical Maintenance', 'Cable Repair']
    };
  }
  if (nameLower.includes('traffic')) {
    return {
      fullName: 'Traffic Management Department',
      shortName: 'Traffic Management',
      icon: Activity,
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-300',
      description: 'Traffic Signal Repair & Roadside Signage Infrastructure',
      taskTypes: ['Traffic Signal Repair', 'Signage Maintenance', 'Traffic Infrastructure']
    };
  }
  return {
    fullName: 'Public Works Department (PWD)',
    shortName: 'Public Works (PWD)',
    icon: Wrench,
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    description: 'Pothole Patching, Road Damage & Public Infrastructure Repairs',
    taskTypes: ['Pothole Repair', 'Road Maintenance', 'Infrastructure Repair']
  };
};

export const DepartmentHeadPortal: React.FC = () => {
  const { user } = useAuth();
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
  const headName = user?.full_name || 'Department Head';
  const headDepartmentFull = user?.department_name || 'Public Works Department (PWD)';
  const headDepartment = headDepartmentFull.split('(')[0].trim() || 'Department';
  const headId = user?.id || 'head-001';

  const deptInfo = useMemo(() => getDepartmentInfo(headDepartmentFull), [headDepartmentFull]);

  // Data States
  const [departmentComplaints, setDepartmentComplaints] = useState<Complaint[]>([]);
  const [departmentStaff, setDepartmentStaff] = useState<ServiceStaffMemberRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Assign Staff Modal State
  const [assignModalComplaint, setAssignModalComplaint] = useState<Complaint | null>(null);
  const [selectedStaffForAssign, setSelectedStaffForAssign] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Completed Review Modal State
  const [reviewModalComplaint, setReviewModalComplaint] = useState<Complaint | null>(null);
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Load Department Data (Complaints & Staff filtered strictly by department)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch All Complaints & Filter strictly for this department
      const allComplaints = getStoredComplaints();
      const cleanHeadDept = headDepartmentFull.split('(')[0].trim().toLowerCase();
      
      const deptFilteredComplaints = allComplaints.filter((c) => {
        const cDept = (c.department_name || '').toLowerCase();
        return cDept.includes(cleanHeadDept) || cleanHeadDept.includes(cDept) || c.category.toLowerCase().includes(cleanHeadDept);
      });
      setDepartmentComplaints(deptFilteredComplaints);

      // 2. Fetch All Service Staff & Filter strictly for this department
      const allStaff = getAllServiceStaffRecords();
      const deptFilteredStaff = allStaff.filter((s) => {
        const sDept = (s.department_name || '').toLowerCase();
        return sDept.includes(cleanHeadDept) || cleanHeadDept.includes(sDept);
      });
      setDepartmentStaff(deptFilteredStaff);

      // 3. Notifications
      const notifs = getNotificationsForRole(headId, 'department_head');
      setNotifications(notifs);

    } catch (err) {
      console.error('Error loading Department Head data:', err);
      setError('Unable to load department operational data.');
    } finally {
      setLoading(false);
    }
  }, [headDepartmentFull, headId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  const now = new Date();

  // Calculate Metrics from Real Database Data
  const metrics = useMemo(() => {
    const total = departmentComplaints.length;
    const unassigned = departmentComplaints.filter((c) => !c.assigned_staff_id && c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const assigned = departmentComplaints.filter((c) => c.assigned_staff_id && c.status === 'Staff Assigned').length;
    const inProgress = departmentComplaints.filter((c) => c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'In Progress').length;
    const completedReviews = departmentComplaints.filter((c) => c.status === 'Resolution Submitted').length;
    const resolved = departmentComplaints.filter((c) => c.status === 'Resolved').length;
    
    const overdue = departmentComplaints.filter((c) => {
      if (c.status === 'Resolved' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    const critical = departmentComplaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved').length;
    const staffCount = departmentStaff.length;

    return { total, unassigned, assigned, inProgress, completedReviews, resolved, overdue, critical, staffCount };
  }, [departmentComplaints, departmentStaff, now]);

  // Filtered Complaint List for Current Tab
  const filteredComplaints = useMemo(() => {
    return departmentComplaints.filter((c) => {
      if (isAssign && c.assigned_staff_id) return false;
      if (isInProgress && (c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way')) return false;
      if (isCompleted && (c.status !== 'Resolution Submitted' && c.status !== 'Resolved')) return false;
      if (isOverdue && (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now)) return false;

      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = c.complaint_number.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        const locMatch = (c.location_address || '').toLowerCase().includes(q);
        if (!numMatch && !titleMatch && !locMatch) return false;
      }
      return true;
    });
  }, [departmentComplaints, isAssign, isInProgress, isCompleted, isOverdue, statusFilter, priorityFilter, searchQuery, now]);

  // Handle Task Assignment to Staff
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
      console.error('Task assignment failed:', err);
      setAssignError(err.message || 'Cross-department assignment rejected.');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Resolution Approval
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

  // Handle Request Rework
  const handleRequestRework = async (complaintId: string) => {
    if (!reworkReason.trim()) {
      alert('Please enter a valid reason for rework.');
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
    <DashboardLayout title="Department Operations">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* ================================================== */}
        {/* 1. DYNAMIC DEPARTMENT HEADER */}
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
                <span className="font-mono text-[10px] font-extrabold bg-white text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                  DEPARTMENT HEAD PORTAL
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Managed by <span className="font-bold text-gray-900">{headName}</span> • {deptInfo.description}
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
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 2. PROFILE PAGE VIEW */}
        {/* ================================================== */}
        {isProfileView ? (
          <div className="max-w-3xl mx-auto space-y-6 py-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-6 shadow-xs">
              <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-purple-500 shrink-0">
                  {headName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 font-outfit">{headName}</h2>
                  <span className="text-xs font-bold text-purple-700 block">Department Head</span>
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
                    <span className="font-extrabold text-purple-900">{deptInfo.fullName}</span>
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
          /* MAIN PORTAL BODY & DASHBOARD */
          /* ================================================== */
          <div className="space-y-6">

            {/* SUMMARY METRIC CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-6 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <Link to="/department-head/complaints" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Complaints</span>
                <span className="text-2xl font-extrabold text-gray-900 font-mono block">{metrics.total}</span>
              </Link>

              <Link to="/department-head/tasks/assign" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Unassigned</span>
                <span className="text-2xl font-extrabold text-blue-700 font-mono block">{metrics.unassigned}</span>
              </Link>

              <Link to="/department-head/tasks/in-progress" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
                <span className="text-2xl font-extrabold text-amber-700 font-mono block">{metrics.inProgress}</span>
              </Link>

              <Link to="/department-head/tasks/completed" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Pending Review</span>
                <span className="text-2xl font-extrabold text-purple-700 font-mono block">{metrics.completedReviews}</span>
              </Link>

              <Link to="/department-head/tasks/overdue" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue SLA</span>
                <span className="text-2xl font-extrabold text-rose-700 font-mono block">{metrics.overdue}</span>
              </Link>

              <Link to="/department-head/staff" className="p-4 text-center space-y-1 hover:bg-slate-50 transition-colors">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Available Staff</span>
                <span className="text-2xl font-extrabold text-emerald-700 font-mono block">{metrics.staffCount}</span>
              </Link>
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

            {/* VIEW MODE: STAFF MANAGEMENT */}
            {isStaffView ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-purple-600" />
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
                            <td className="p-3.5 font-mono font-bold text-purple-700">
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
                              <Link
                                to="/department-head/tasks/assign"
                                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-extrabold rounded-lg transition-colors text-[11px] inline-flex items-center space-x-1"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Assign Work</span>
                              </Link>
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
                    <Map className="w-5 h-5 text-purple-600" />
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
                            <span className="inline-block mt-1 font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
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
              /* DEFAULT / COMPLAINTS / ASSIGNMENT / REVIEWS TABLE VIEW */
              <div className="space-y-4">
                
                {/* SEARCH & FILTERS TOOLBAR */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-gray-200">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search complaint number, issue title, location..."
                      className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold"
                    >
                      <option value="All">All Priorities</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Department Assigned">Unassigned Tasks</option>
                      <option value="Staff Assigned">Staff Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolution Submitted">Resolution Submitted</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                {/* COMPLAINTS / TASKS TABLE */}
                {filteredComplaints.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                    <span className="font-bold text-gray-900 text-sm font-outfit block">No records found</span>
                    <span className="text-xs text-gray-500 block">No matching complaints for {deptInfo.shortName}.</span>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                          <th className="p-3.5">Complaint ID</th>
                          <th className="p-3.5">Title & Category</th>
                          <th className="p-3.5">Location</th>
                          <th className="p-3.5">Priority</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Assigned Staff</th>
                          <th className="p-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredComplaints.map((comp) => {
                          const isUnassigned = !comp.assigned_staff_id;
                          const isPendingReview = comp.status === 'Resolution Submitted';

                          return (
                            <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                                {comp.complaint_number}
                              </td>
                              <td className="p-3.5">
                                <span className="font-bold text-gray-900 block">{comp.title}</span>
                                <span className="text-[10px] text-gray-500 font-mono">{comp.category}</span>
                              </td>
                              <td className="p-3.5 text-gray-700 font-medium max-w-xs truncate">
                                {comp.location_address || 'Nashik Service Area'}
                              </td>
                              <td className="p-3.5">
                                <PriorityBadge priority={comp.priority} />
                              </td>
                              <td className="p-3.5">
                                <StatusBadge status={comp.status} />
                              </td>
                              <td className="p-3.5 font-semibold text-gray-800">
                                {comp.assigned_staff_name ? (
                                  <span className="inline-flex items-center space-x-1 text-purple-900 font-bold">
                                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                                    <span>{comp.assigned_staff_name}</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-mono text-[11px] font-bold">Unassigned</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                {isUnassigned ? (
                                  <button
                                    onClick={() => {
                                      setAssignModalComplaint(comp);
                                      setSelectedStaffForAssign(departmentStaff[0]?.id || '');
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                    <span>Assign Staff</span>
                                  </button>
                                ) : isPendingReview ? (
                                  <button
                                    onClick={() => setReviewModalComplaint(comp)}
                                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Review Proof</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setAssignModalComplaint(comp)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                                  >
                                    Reassign
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Assign Department Task</h3>
                </div>
                <button onClick={() => setAssignModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                <span className="font-mono text-emerald-700 font-bold block">{assignModalComplaint.complaint_number}</span>
                <h4 className="font-bold text-gray-900">{assignModalComplaint.title}</h4>
                <p className="text-gray-600 text-[11px]">{assignModalComplaint.location_address}</p>
              </div>

              {assignError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {assignError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  Select {deptInfo.shortName} Staff Member *
                </label>
                
                {departmentStaff.length === 0 ? (
                  <p className="text-xs text-rose-600 font-bold">No active service staff registered under {deptInfo.fullName}.</p>
                ) : (
                  <select
                    value={selectedStaffForAssign}
                    onChange={(e) => setSelectedStaffForAssign(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
                  >
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.employee_id || 'STF-001'}) — {s.department_name || headDepartmentFull}
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
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Confirm Task Assignment'}
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
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-purple-600" />
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

              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                <span className="font-bold text-gray-900 block">Work Notes: {reviewModalComplaint.work_performed || 'Field maintenance work completed.'}</span>
                <span className="text-gray-600 block">Materials Used: {reviewModalComplaint.materials_used || 'Standard repair materials'}</span>
                <span className="text-gray-500 text-[11px] block">Executed by Staff: {reviewModalComplaint.assigned_staff_name}</span>
              </div>

              {showReworkInput ? (
                <div className="space-y-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900">Enter Rework Instructions for Staff *</label>
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
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs inline-flex items-center justify-center space-x-1.5 disabled:opacity-50"
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
