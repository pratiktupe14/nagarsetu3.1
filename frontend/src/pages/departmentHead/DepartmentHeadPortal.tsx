import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, Link, useNavigate, useParams } from 'react-router-dom';
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
  getDepartmentServiceStaff, getStaffMemberById
} from '../../services/adminService';
import { getNotificationsForRole, pushNotification } from '../../services/notificationService';
import { Complaint, ComplaintStatus, UserProfile, NotificationItem } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Wrench, CheckCircle2, Clock, AlertTriangle, MapPin, Upload,
  Camera, Check, Play, Navigation, Eye, UserCheck, ShieldCheck, Zap, X,
  Search, Lock, Building2, User, RefreshCw, FileText, ChevronRight,
  MessageSquarePlus, Star, ArrowRight, Map, Bell, Sliders, Calendar,
  TrendingUp, Award, Activity, Droplets, Trash2, Waves, Shield, PlusCircle,
  Users, Layers, CornerDownRight, RotateCcw, Download, Filter, CheckSquare,
  Square, ChevronLeft, ExternalLink, FileSpreadsheet, Info, Phone, Mail,
  UserPlus, ArrowLeft, CheckSquare2, AlertCircle, PlayCircle, UserX,
  ZoomIn, ZoomOut, Maximize2, FileCheck, CheckCircle, Siren, AlertOctagon, ShieldAlert
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

const getWorkloadInfo = (activeTaskCount: number) => {
  if (activeTaskCount <= 1) {
    return { label: 'Low Workload', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (activeTaskCount <= 3) {
    return { label: 'Normal Workload', color: 'bg-blue-50 text-blue-800 border-blue-200' };
  }
  return { label: 'High Workload', color: 'bg-rose-50 text-rose-800 border-rose-200' };
};

// Calculate Overdue Duration & Urgency Indicator
const getOverdueDetails = (slaDeadline: string | null, now: Date) => {
  if (!slaDeadline) return { text: 'N/A', urgency: 'Within SLA', badgeColor: 'bg-gray-100 text-gray-700' };
  const due = new Date(slaDeadline);
  const diffMs = now.getTime() - due.getTime();

  if (diffMs <= 0) {
    return { text: 'Within SLA', urgency: 'Within SLA', badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }

  const hoursTotal = Math.floor(diffMs / (1000 * 3600));
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  const mins = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));

  let timeStr = '';
  if (days > 0) {
    timeStr = `${days}d ${hours}h ${mins}m`;
  } else if (hours > 0) {
    timeStr = `${hours}h ${mins}m`;
  } else {
    timeStr = `${mins}m`;
  }

  if (hoursTotal < 6) {
    return { text: `Overdue by ${timeStr}`, urgency: 'Recently Overdue', badgeColor: 'bg-yellow-50 text-yellow-900 border-yellow-300 font-bold' };
  }
  if (hoursTotal < 24) {
    return { text: `Overdue by ${timeStr}`, urgency: 'Overdue', badgeColor: 'bg-amber-50 text-amber-900 border-amber-300 font-bold' };
  }
  if (days < 3) {
    return { text: `Overdue by ${timeStr}`, urgency: 'Severely Overdue', badgeColor: 'bg-orange-100 text-orange-900 border-orange-400 font-extrabold' };
  }
  return { text: `Overdue by ${timeStr}`, urgency: 'Critical Delay', badgeColor: 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold' };
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
  const isAssign = currentPath.startsWith('/department-head/tasks/assign');
  const isAssignWorkspace = currentPath.startsWith('/department-head/tasks/assign');
  const isInProgress = currentPath === '/department-head/tasks/in-progress';
  const isCompleted = currentPath === '/department-head/tasks/completed';
  const isOverdue = currentPath === '/department-head/tasks/overdue';
  const isStaffView = currentPath === '/department-head/staff';
  const isStaffDetailView = currentPath.startsWith('/department-head/staff/');
  const isMapView = currentPath === '/department-head/map';
  const isNotifView = currentPath === '/department-head/notifications';
  const isProfileView = currentPath === '/department-head/profile';
  const isSettingsView = currentPath === '/department-head/settings';

  // Extract staff ID if viewing single staff member
  const staffIdFromPath = isStaffDetailView ? currentPath.split('/department-head/staff/')[1] : null;

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
  const [slaFilter, setSlaFilter] = useState('All');
  const [overdueDurationFilter, setOverdueDurationFilter] = useState('All');
  const [reviewStatusTab, setReviewStatusTab] = useState<'All' | 'Pending Review' | 'Approved' | 'Rework Required' | 'Resolved'>('All');
  const [taskLoadFilter, setTaskLoadFilter] = useState('All');

  // Task Assignment Workspace States
  const [selectedAssignComplaint, setSelectedAssignComplaint] = useState<Complaint | null>(null);
  const [selectedAssignStaff, setSelectedAssignStaff] = useState<ServiceStaffMemberRecord | null>(null);
  const [assignmentPriority, setAssignmentPriority] = useState<string>('Medium');
  const [assignmentDueDate, setAssignmentDueDate] = useState<string>('');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');
  const [assignmentTab, setAssignmentTab] = useState<'Unassigned' | 'Assigned' | 'In Progress' | 'Pending Review' | 'Completed' | 'Overdue'>('Unassigned');

  // Reassignment Modal State
  const [reassignModalComplaint, setReassignModalComplaint] = useState<Complaint | null>(null);
  const [targetReassignStaffId, setTargetReassignStaffId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [reassigning, setReassigning] = useState<boolean>(false);

  // Escalation Modal State
  const [escalateModalComplaint, setEscalateModalComplaint] = useState<Complaint | null>(null);
  const [escalationReason, setEscalationReason] = useState<string>('');
  const [escalationPriority, setEscalationPriority] = useState<string>('Critical');
  const [escalationNotes, setEscalationNotes] = useState<string>('');
  const [escalating, setEscalating] = useState<boolean>(false);

  // Image Viewer Modal State
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Approval Confirmation Modal State
  const [confirmApproveModal, setConfirmApproveModal] = useState<Complaint | null>(null);

  // Bulk Operations State
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);

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

  // Single Staff Detail Record State
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<ServiceStaffMemberRecord | null>(null);

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

      // 3. If viewing staff detail, fetch staff profile
      if (staffIdFromPath) {
        const staffObj = await getStaffMemberById(staffIdFromPath);
        setSelectedStaffProfile(staffObj);
      }

      // 4. Notifications
      const notifs = getNotificationsForRole(headId, 'department_head');
      setNotifications(notifs);

    } catch (err) {
      console.error('Error loading Department Head data:', err);
      setError('Unable to load department data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [headDeptId, headDepartmentFull, headId, staffIdFromPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  const now = new Date();

  // Calculate Real Complaint Summary Statistics from Database Records
  const complaintMetrics = useMemo(() => {
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

  // In-Progress Specific Metric Cards
  const inProgressMetrics = useMemo(() => {
    const inProgressComplaints = departmentComplaints.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way');
    const total = inProgressComplaints.length;
    const highPriority = inProgressComplaints.filter((c) => c.priority === 'High').length;
    const critical = inProgressComplaints.filter((c) => c.priority === 'Critical').length;
    
    const dueToday = inProgressComplaints.filter((c) => {
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline).toDateString() === now.toDateString();
    }).length;

    const overdue = inProgressComplaints.filter((c) => {
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    return { total, highPriority, critical, dueToday, overdue };
  }, [departmentComplaints, now]);

  // Completed Specific Metric Cards (Real Database Data)
  const completedMetrics = useMemo(() => {
    const completedComplaints = departmentComplaints.filter((c) => c.status === 'Resolution Submitted' || c.status === 'Resolved' || c.status === 'Reopened');
    const total = completedComplaints.length;
    const pendingReview = departmentComplaints.filter((c) => c.status === 'Resolution Submitted').length;
    const approved = departmentComplaints.filter((c) => c.status === 'Resolved').length;
    const reworkRequired = departmentComplaints.filter((c) => c.status === 'Reopened').length;

    const completedToday = completedComplaints.filter((c) => {
      if (!c.updated_at) return false;
      return new Date(c.updated_at).toDateString() === now.toDateString();
    }).length;

    const completedThisWeek = completedComplaints.filter((c) => {
      if (!c.updated_at) return false;
      const diffTime = now.getTime() - new Date(c.updated_at).getTime();
      return diffTime <= 7 * 24 * 3600 * 1000;
    }).length;

    let totalResolutionHours = 0;
    let resolvedCount = 0;
    completedComplaints.forEach((c) => {
      if (c.created_at && c.updated_at) {
        const start = new Date(c.created_at).getTime();
        const end = new Date(c.updated_at).getTime();
        if (end > start) {
          totalResolutionHours += (end - start) / (1000 * 3600);
          resolvedCount += 1;
        }
      }
    });

    const avgResolutionTime = resolvedCount > 0 ? `${(totalResolutionHours / resolvedCount).toFixed(1)} hrs` : 'N/A';

    return { total, pendingReview, approved, reworkRequired, completedToday, completedThisWeek, avgResolutionTime };
  }, [departmentComplaints, now]);

  // Overdue Specific Metric Cards (Real Database Data)
  const overdueMetrics = useMemo(() => {
    const overdueList = departmentComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    });

    const totalOverdue = overdueList.length;
    const critical = overdueList.filter((c) => c.priority === 'Critical').length;
    const highPriority = overdueList.filter((c) => c.priority === 'High').length;
    
    const dueToday = overdueList.filter((c) => {
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline).toDateString() === now.toDateString();
    }).length;

    const overdueGt24h = overdueList.filter((c) => {
      if (!c.sla_deadline) return false;
      const diffMs = now.getTime() - new Date(c.sla_deadline).getTime();
      return diffMs > 24 * 3600 * 1000;
    }).length;

    const overdueGt3d = overdueList.filter((c) => {
      if (!c.sla_deadline) return false;
      const diffMs = now.getTime() - new Date(c.sla_deadline).getTime();
      return diffMs > 3 * 24 * 3600 * 1000;
    }).length;

    const staffWithOverdue = new Set(overdueList.map((c) => c.assigned_staff_id).filter(Boolean)).size;

    return { totalOverdue, critical, highPriority, dueToday, overdueGt24h, overdueGt3d, staffWithOverdue };
  }, [departmentComplaints, now]);

  // Calculate Real Staff Summary Statistics from Database Records
  const staffMetrics = useMemo(() => {
    const totalStaff = departmentStaff.length;
    const activeStaff = departmentStaff.filter((s) => s.status !== 'Offline' && s.status !== 'On Leave').length;
    const availableStaff = departmentStaff.filter((s) => s.status === 'Available').length;
    const busyStaff = departmentStaff.filter((s) => s.status === 'Busy' || s.status === 'On Task').length;
    const offlineStaff = departmentStaff.filter((s) => s.status === 'Offline' || s.status === 'On Leave').length;

    let activeTasks = 0;
    let overdueTasks = 0;
    let completedTasks = 0;

    departmentComplaints.forEach((c) => {
      if (c.assigned_staff_id) {
        if (c.status === 'Resolved') {
          completedTasks += 1;
        } else if (c.status === 'Resolution Submitted' || c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'Staff Assigned') {
          activeTasks += 1;
          if (c.sla_deadline && new Date(c.sla_deadline) < now) {
            overdueTasks += 1;
          }
        }
      }
    });

    return { totalStaff, activeStaff, availableStaff, busyStaff, offlineStaff, activeTasks, overdueTasks, completedTasks };
  }, [departmentStaff, departmentComplaints, now]);

  // Unique categories for filter dropdown
  const availableCategories = useMemo(() => {
    return Array.from(new Set(departmentComplaints.map((c) => c.category).filter(Boolean)));
  }, [departmentComplaints]);

  // Map each staff member to their real active, overdue & completed task counts
  const staffTaskCountsMap = useMemo(() => {
    const map: Record<string, { active: number; overdue: number; completed: number; currentTask: string | null }> = {};
    
    departmentStaff.forEach((s) => {
      map[s.id] = { active: 0, overdue: 0, completed: 0, currentTask: null };
    });

    departmentComplaints.forEach((c) => {
      if (c.assigned_staff_id && map[c.assigned_staff_id]) {
        if (c.status === 'Resolved') {
          map[c.assigned_staff_id].completed += 1;
        } else if (c.status !== 'Rejected') {
          map[c.assigned_staff_id].active += 1;
          if (!map[c.assigned_staff_id].currentTask) {
            map[c.assigned_staff_id].currentTask = c.title;
          }
          if (c.sla_deadline && new Date(c.sla_deadline) < now) {
            map[c.assigned_staff_id].overdue += 1;
          }
        }
      }
    });

    return map;
  }, [departmentStaff, departmentComplaints, now]);

  // Filtered Staff Roster for Staff Page
  const filteredStaffList = useMemo(() => {
    return departmentStaff.filter((s) => {
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;

      const activeCount = staffTaskCountsMap[s.id]?.active || 0;
      if (taskLoadFilter === 'Low' && activeCount > 1) return false;
      if (taskLoadFilter === 'Normal' && (activeCount < 2 || activeCount > 3)) return false;
      if (taskLoadFilter === 'High' && activeCount < 4) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = s.name.toLowerCase().includes(q);
        const idMatch = (s.employee_id || s.id).toLowerCase().includes(q);
        const emailMatch = (s.email || '').toLowerCase().includes(q);
        const phoneMatch = (s.contact_number || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !emailMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [departmentStaff, statusFilter, taskLoadFilter, searchQuery, staffTaskCountsMap]);

  // Filtered Complaint List with real Search, Filters & Route constraints
  const filteredComplaints = useMemo(() => {
    return departmentComplaints.filter((c) => {
      if (isOverdue) {
        if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline || new Date(c.sla_deadline) >= now) return false;
        
        if (overdueDurationFilter !== 'All') {
          const diffMs = now.getTime() - new Date(c.sla_deadline).getTime();
          const hours = diffMs / (1000 * 3600);
          if (overdueDurationFilter === '< 24 Hours' && hours >= 24) return false;
          if (overdueDurationFilter === '1-3 Days' && (hours < 24 || hours > 72)) return false;
          if (overdueDurationFilter === '> 3 Days' && hours <= 72) return false;
        }

      } else if (isCompleted) {
        if (c.status !== 'Resolution Submitted' && c.status !== 'Resolved' && c.status !== 'Reopened') return false;
        if (reviewStatusTab === 'Pending Review' && c.status !== 'Resolution Submitted') return false;
        if (reviewStatusTab === 'Approved' && c.status !== 'Resolved') return false;
        if (reviewStatusTab === 'Rework Required' && c.status !== 'Reopened') return false;
        if (reviewStatusTab === 'Resolved' && c.status !== 'Resolved') return false;

      } else if (isInProgress) {
        if (c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way') return false;
      } else if (isAssignWorkspace) {
        if (assignmentTab === 'Unassigned' && (c.assigned_staff_id || c.status === 'Resolved')) return false;
        if (assignmentTab === 'Assigned' && (!c.assigned_staff_id || (c.status !== 'Staff Assigned' && c.status !== 'Department Assigned'))) return false;
        if (assignmentTab === 'In Progress' && c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way') return false;
        if (assignmentTab === 'Pending Review' && c.status !== 'Resolution Submitted') return false;
        if (assignmentTab === 'Completed' && c.status !== 'Resolved') return false;
        if (assignmentTab === 'Overdue' && (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now)) return false;
      } else if (isComplaints) {
        if (statusFilter !== 'All') {
          if (statusFilter === 'Unassigned' && c.assigned_staff_id) return false;
          if (statusFilter === 'Assigned' && !c.assigned_staff_id) return false;
          if (statusFilter !== 'Unassigned' && statusFilter !== 'Assigned' && c.status !== statusFilter) return false;
        }
      }

      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;

      if (staffFilter !== 'All') {
        if (staffFilter === 'Unassigned' && c.assigned_staff_id) return false;
        if (staffFilter !== 'Unassigned' && c.assigned_staff_id !== staffFilter && c.assigned_staff_name !== staffFilter) return false;
      }

      if (slaFilter !== 'All') {
        if (!c.sla_deadline) return false;
        const isOver = new Date(c.sla_deadline) < now;
        const isToday = new Date(c.sla_deadline).toDateString() === now.toDateString();
        if (slaFilter === 'Overdue' && !isOver) return false;
        if (slaFilter === 'Due Today' && !isToday) return false;
        if (slaFilter === 'Within SLA' && isOver) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = c.complaint_number.toLowerCase().includes(q);
        const taskIdMatch = `task-${c.id.slice(0, 6)}`.includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        const catMatch = c.category.toLowerCase().includes(q);
        const locMatch = (c.location_address || '').toLowerCase().includes(q);
        const staffMatch = (c.assigned_staff_name || '').toLowerCase().includes(q);
        if (!numMatch && !taskIdMatch && !titleMatch && !catMatch && !locMatch && !staffMatch) return false;
      }

      return true;
    });
  }, [departmentComplaints, isOverdue, overdueDurationFilter, isCompleted, reviewStatusTab, isInProgress, isAssignWorkspace, assignmentTab, isComplaints, statusFilter, priorityFilter, categoryFilter, staffFilter, slaFilter, searchQuery, now]);

  // Tasks belonging to the selected single staff member profile
  const staffProfileTasks = useMemo(() => {
    if (!staffIdFromPath) return [];
    return departmentComplaints.filter((c) => c.assigned_staff_id === staffIdFromPath);
  }, [departmentComplaints, staffIdFromPath]);

  // Reset page index when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, staffFilter, dateFilter, slaFilter, taskLoadFilter, assignmentTab, reviewStatusTab, overdueDurationFilter]);

  // Paginated Complaints
  const paginatedComplaints = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredComplaints.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredComplaints, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;

  // Clear All Search & Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setStaffFilter('All');
    setDateFilter('All Time');
    setSlaFilter('All');
    setTaskLoadFilter('All');
    setReviewStatusTab('All');
    setOverdueDurationFilter('All');
  };

  // Export Real Department Complaints to CSV
  const handleExportCSV = (selectedOnly: boolean = false) => {
    const targetList = selectedOnly && selectedComplaints.length > 0
      ? departmentComplaints.filter((c) => selectedComplaints.includes(c.id))
      : filteredComplaints;

    if (targetList.length === 0) return;

    const headers = ['Task ID', 'Complaint Number', 'Title', 'Category', 'Location Address', 'Priority', 'Status', 'Assigned Staff', 'SLA Due Date', 'Overdue Duration'];
    const rows = targetList.map((c) => {
      const overdueInfo = getOverdueDetails(c.sla_deadline, now);
      return [
        `"TASK-${c.id.slice(0, 6).toUpperCase()}"`,
        `"${c.complaint_number}"`,
        `"${(c.title || '').replace(/"/g, '""')}"`,
        `"${(c.category || '').replace(/"/g, '""')}"`,
        `"${(c.location_address || '').replace(/"/g, '""')}"`,
        c.priority,
        c.status,
        `"${(c.assigned_staff_name || 'Unassigned').replace(/"/g, '""')}"`,
        `"${c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : 'N/A'}"`,
        `"${overdueInfo.text}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${deptInfo.shortName.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm Task Assignment to Department Staff with Department Security Validation
  const handleExecuteAssignment = async (compObj: Complaint, staffObj: ServiceStaffMemberRecord) => {
    const cleanHeadDept = headDepartmentFull.split('(')[0].trim().toLowerCase();
    const cleanStaffDept = (staffObj.department_name || '').split('(')[0].trim().toLowerCase();

    if (cleanStaffDept && cleanHeadDept && !cleanStaffDept.includes(cleanHeadDept) && !cleanHeadDept.includes(cleanStaffDept)) {
      alert(`CROSS-DEPARTMENT ASSIGNMENT BLOCKED: Service staff member '${staffObj.name}' (${staffObj.department_name}) does not belong to your department (${deptInfo.fullName}).`);
      return;
    }

    setAssigning(true);
    setAssignError(null);

    try {
      await assignTaskByDepartmentHead(
        compObj.id,
        staffObj.id,
        staffObj.name,
        staffObj.department_name || headDepartmentFull,
        headId,
        headName,
        headDepartmentFull
      );

      setAssignModalComplaint(null);
      setSelectedAssignComplaint(null);
      setSelectedAssignStaff(null);
      setSelectedStaffForAssign('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      setAssignError(err.message || 'Error executing task assignment.');
      alert(err.message || 'Error executing task assignment.');
    } finally {
      setAssigning(false);
    }
  };

  // Execute Reassignment to a New Service Staff Member in Same Department
  const handleExecuteReassignment = async () => {
    if (!reassignModalComplaint || !targetReassignStaffId) {
      alert('Please select a service staff member to reassign this task to.');
      return;
    }
    const newStaff = departmentStaff.find((s) => s.id === targetReassignStaffId);
    if (!newStaff) {
      alert('Selected staff member record not found.');
      return;
    }

    setReassigning(true);
    try {
      await assignTaskByDepartmentHead(
        reassignModalComplaint.id,
        newStaff.id,
        newStaff.name,
        newStaff.department_name || headDepartmentFull,
        headId,
        headName,
        headDepartmentFull
      );
      setReassignModalComplaint(null);
      setTargetReassignStaffId('');
      setReassignReason('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error reassigning task.');
    } finally {
      setReassigning(false);
    }
  };

  // Execute Real Task Escalation to City Admin & Department Head Audit Log
  const handleExecuteEscalation = async () => {
    if (!escalateModalComplaint || !escalationReason.trim()) {
      alert('Please state the reason for escalating this critical overdue task.');
      return;
    }

    setEscalating(true);
    try {
      pushNotification({
        user_id: 'admin-group',
        role: 'city_admin',
        complaint_id: escalateModalComplaint.id,
        complaint_number: escalateModalComplaint.complaint_number,
        type: 'sla_breached',
        title: `ESCALATION: Overdue Complaint ${escalateModalComplaint.complaint_number} (${escalationPriority})`,
        message: `Department Head ${headName} (${deptInfo.shortName}) escalated overdue complaint '${escalateModalComplaint.title}'. Reason: ${escalationReason.trim()}`
      });

      setEscalateModalComplaint(null);
      setEscalationReason('');
      setEscalationNotes('');
      alert(`Task ${escalateModalComplaint.complaint_number} has been officially escalated to City Administration.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error escalating task.');
    } finally {
      setEscalating(false);
    }
  };

  // Modal confirm assignment helper
  const handleConfirmModalAssignment = async () => {
    if (!assignModalComplaint || !selectedStaffForAssign) {
      setAssignError('Please select an active service staff member.');
      return;
    }

    const staffObj = departmentStaff.find((s) => s.id === selectedStaffForAssign);
    if (!staffObj) {
      setAssignError('Selected staff record not found.');
      return;
    }

    await handleExecuteAssignment(assignModalComplaint, staffObj);
  };

  // Confirm Approval of Completed Work Proof
  const handleApproveResolution = async (complaintId: string) => {
    setReviewing(true);
    try {
      await approveResolutionDepartmentHead(complaintId, headName);
      setReviewModalComplaint(null);
      setConfirmApproveModal(null);
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
    <DashboardLayout title={isOverdue ? "Overdue Tasks" : isCompleted ? "Completed Tasks" : isInProgress ? t('inProgress') : isStaffView ? t('staff') : isAssignWorkspace ? t('taskAssignment') : "Department Operations"}>
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
                <span className="font-mono text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-300">
                  {isOverdue ? 'OVERDUE TASKS' : isCompleted ? 'COMPLETED TASKS' : isInProgress ? 'IN PROGRESS TASKS' : 'DEPARTMENT HEAD PORTAL'}
                </span>
                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ID: {headDeptId}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                {isOverdue ? 'Tasks requiring immediate departmental attention.' : isCompleted ? 'Work completed by your department\'s service staff.' : isInProgress ? 'Assigned work currently being executed by service staff.' : `Managed by ${headName} • Scope: ${deptInfo.description}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-xs flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] font-mono text-gray-500 font-bold block">{t('staff')}</span>
                <span className="font-extrabold text-gray-900 font-mono">{complaintMetrics.staffCount} Active Members</span>
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
        {/* VIEW ROUTE RENDERER */}
        {/* ================================================== */}
        
        {/* A. DEPARTMENT HEAD → OVERDUE TASKS PAGE (/department-head/tasks/overdue) */}
        {isOverdue ? (
          <div className="space-y-6">

            {/* 7 OVERDUE SUMMARY METRIC CARDS (REAL SUPABASE DATA) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1 bg-rose-50/50">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block font-outfit">Total Overdue</span>
                <span className="text-xl font-extrabold text-rose-900 font-mono block">{overdueMetrics.totalOverdue}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
                <span className="text-xl font-extrabold text-rose-700 font-mono block">{overdueMetrics.critical}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">High Priority</span>
                <span className="text-xl font-extrabold text-orange-700 font-mono block">{overdueMetrics.highPriority}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Due Today</span>
                <span className="text-xl font-extrabold text-amber-700 font-mono block">{overdueMetrics.dueToday}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue &gt; 24 Hours</span>
                <span className="text-xl font-extrabold text-rose-800 font-mono block">{overdueMetrics.overdueGt24h}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue &gt; 3 Days</span>
                <span className="text-xl font-extrabold text-rose-950 font-mono block">{overdueMetrics.overdueGt3d}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Staff w/ Overdue</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{overdueMetrics.staffWithOverdue}</span>
              </div>
            </div>

            {/* SEARCH AND FILTER TOOLBAR */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Task ID, Complaint ID, Issue, Location, Staff Name..."
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Priority Filter */}
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
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
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>

                  {/* Overdue Duration Filter */}
                  <select
                    value={overdueDurationFilter}
                    onChange={(e) => setOverdueDurationFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                  >
                    <option value="All">All Overdue Durations</option>
                    <option value="< 24 Hours">&lt; 24 Hours Overdue</option>
                    <option value="1-3 Days">1 to 3 Days Overdue</option>
                    <option value="> 3 Days">&gt; 3 Days Critical Overdue</option>
                  </select>

                  {(searchQuery || priorityFilter !== 'All' || categoryFilter !== 'All' || staffFilter !== 'All' || overdueDurationFilter !== 'All') && (
                    <button
                      onClick={handleClearFilters}
                      className="px-3.5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition-colors min-h-[42px]"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* OVERDUE TASKS TABLE (DESKTOP) & CARDS (MOBILE) */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-12 bg-white border border-rose-200 rounded-2xl text-center space-y-3 max-w-md mx-auto">
                <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">Unable to load overdue tasks</h3>
                <p className="text-xs text-gray-600">Please try again.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Retry
                </button>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">No overdue tasks</h3>
                <p className="text-xs text-gray-500">All tasks in your department are currently within their assigned deadlines.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* DESKTOP TABLE */}
                <div className="hidden md:block border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                        <th className="p-3.5">Task ID / Complaint</th>
                        <th className="p-3.5">Issue & Category</th>
                        <th className="p-3.5">Location</th>
                        <th className="p-3.5">Assigned Staff</th>
                        <th className="p-3.5">Priority</th>
                        <th className="p-3.5">Due Date</th>
                        <th className="p-3.5">Overdue Duration</th>
                        <th className="p-3.5">Urgency Indicator</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedComplaints.map((comp) => {
                        const taskIdStr = `TASK-${comp.id.slice(0, 6).toUpperCase()}`;
                        const overdueDetails = getOverdueDetails(comp.sla_deadline, now);
                        const staffOverdueCount = staffTaskCountsMap[comp.assigned_staff_id || '']?.overdue || 0;

                        return (
                          <tr key={comp.id} className="hover:bg-rose-50/40 transition-colors">
                            <td className="p-3.5 font-mono">
                              <span className="font-bold text-gray-900 block">{taskIdStr}</span>
                              <button onClick={() => setDetailModalComplaint(comp)} className="text-[11px] text-emerald-700 font-bold hover:underline">
                                {comp.complaint_number}
                              </button>
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-gray-900 block">{comp.title}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{comp.category}</span>
                            </td>
                            <td className="p-3.5 text-gray-700 font-medium max-w-xs truncate">
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{comp.location_address || 'Nashik Service Area'}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              {comp.assigned_staff_id ? (
                                <Link to={`/department-head/staff/${comp.assigned_staff_id}`} className="hover:underline flex items-center space-x-1.5">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center font-outfit text-[10px] border border-emerald-300 shrink-0">
                                    {comp.assigned_staff_name?.charAt(0) || 'S'}
                                  </div>
                                  <div>
                                    <span className="font-bold text-gray-900 block">{comp.assigned_staff_name}</span>
                                    {staffOverdueCount > 1 && (
                                      <span className="text-[9px] font-bold text-rose-700 block">
                                        High Workload ({staffOverdueCount} overdue)
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              ) : (
                                <span className="text-amber-700 font-mono text-[11px] font-bold">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <PriorityBadge priority={comp.priority} />
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-rose-700 font-bold whitespace-nowrap">
                              {comp.sla_deadline ? new Date(comp.sla_deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </td>
                            <td className="p-3.5 font-mono text-[11px] font-extrabold text-rose-800 whitespace-nowrap">
                              {overdueDetails.text}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider border ${overdueDetails.badgeColor}`}>
                                {overdueDetails.urgency}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => setDetailModalComplaint(comp)}
                                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                                >
                                  View Task
                                </button>

                                <button
                                  onClick={() => {
                                    setReassignModalComplaint(comp);
                                    setTargetReassignStaffId(departmentStaff[0]?.id || '');
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg text-[11px] transition-colors"
                                >
                                  Reassign
                                </button>

                                <button
                                  onClick={() => setEscalateModalComplaint(comp)}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                >
                                  <Siren className="w-3 h-3" />
                                  <span>Escalate</span>
                                </button>
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
                    const taskIdStr = `TASK-${comp.id.slice(0, 6).toUpperCase()}`;
                    const overdueDetails = getOverdueDetails(comp.sla_deadline, now);

                    return (
                      <div key={comp.id} className="p-4 bg-white border border-rose-200 rounded-2xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-gray-900">{taskIdStr} • <span className="text-emerald-700">{comp.complaint_number}</span></span>
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${overdueDetails.badgeColor}`}>
                            {overdueDetails.urgency}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</h4>
                          <span className="text-[11px] text-gray-500 font-mono block">{comp.category}</span>
                        </div>

                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Staff: <strong>{comp.assigned_staff_name || 'Unassigned'}</strong></span>
                            <PriorityBadge priority={comp.priority} />
                          </div>
                        </div>

                        <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between text-xs font-mono">
                          <span className="text-rose-800 font-bold">Overdue Duration:</span>
                          <span className="text-rose-900 font-extrabold">{overdueDetails.text}</span>
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => setDetailModalComplaint(comp)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 font-bold rounded-lg text-xs"
                          >
                            View
                          </button>

                          <button
                            onClick={() => {
                              setReassignModalComplaint(comp);
                              setTargetReassignStaffId(departmentStaff[0]?.id || '');
                            }}
                            className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 font-extrabold rounded-lg text-xs"
                          >
                            Reassign
                          </button>

                          <button
                            onClick={() => setEscalateModalComplaint(comp)}
                            className="px-3 py-1.5 bg-rose-600 text-white font-extrabold rounded-lg text-xs"
                          >
                            Escalate
                          </button>
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
                      <span className="font-extrabold text-gray-900">{filteredComplaints.length}</span> overdue tasks
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
        ) : isCompleted ? (
          /* B. DEPARTMENT HEAD → COMPLETED TASKS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Completed</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{completedMetrics.total}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Pending Review</span>
                <span className="text-xl font-extrabold text-purple-700 font-mono block">{completedMetrics.pendingReview}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Approved</span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono block">{completedMetrics.approved}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Rework Required</span>
                <span className="text-xl font-extrabold text-amber-700 font-mono block">{completedMetrics.reworkRequired}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Completed Today</span>
                <span className="text-xl font-extrabold text-blue-700 font-mono block">{completedMetrics.completedToday}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Completed This Week</span>
                <span className="text-xl font-extrabold text-cyan-700 font-mono block">{completedMetrics.completedThisWeek}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Avg Resolution Time</span>
                <span className="text-xl font-extrabold text-emerald-800 font-mono block">{completedMetrics.avgResolutionTime}</span>
              </div>
            </div>
          </div>
        ) : isInProgress ? (
          /* C. DEPARTMENT HEAD → IN PROGRESS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
                <span className="text-2xl font-extrabold text-amber-700 font-mono block">{inProgressMetrics.total}</span>
              </div>
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Department</span>
                <span className="text-2xl font-extrabold text-gray-900 font-mono block">{complaintMetrics.total}</span>
              </div>
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">High Priority</span>
                <span className="text-2xl font-extrabold text-orange-700 font-mono block">{inProgressMetrics.highPriority}</span>
              </div>
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
                <span className="text-2xl font-extrabold text-rose-800 font-mono block">{inProgressMetrics.critical}</span>
              </div>
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Due Today / Overdue</span>
                <span className="text-2xl font-extrabold text-rose-700 font-mono block">
                  {inProgressMetrics.dueToday + inProgressMetrics.overdue}
                </span>
              </div>
            </div>
          </div>
        ) : isStaffDetailView && selectedStaffProfile ? (
          /* D. STAFF PROFILE DETAIL VIEW */
          <div className="space-y-6">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                  {selectedStaffProfile.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 font-outfit">{selectedStaffProfile.name}</h2>
                </div>
              </div>
            </div>
          </div>
        ) : isStaffView ? (
          /* E. DEPARTMENT HEAD → STAFF ROSTER PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Staff</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{staffMetrics.totalStaff}</span>
              </div>
            </div>
          </div>
        ) : isAssignWorkspace ? (
          /* F. DEPARTMENT HEAD → TASK ASSIGNMENT WORKSPACE */
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">Task Assignment Workspace</h2>
            </div>
          </div>
        ) : (
          /* G. DEFAULT COMPLAINTS TABLE VIEW */
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                    <th className="p-3.5">Complaint ID</th>
                    <th className="p-3.5">Title & Category</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map((comp) => (
                    <tr key={comp.id}>
                      <td className="p-3.5 font-mono text-emerald-700">{comp.complaint_number}</td>
                      <td className="p-3.5">{comp.title}</td>
                      <td className="p-3.5"><StatusBadge status={comp.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* ESCALATE OVERDUE TASK MODAL */}
        {/* ================================================== */}
        {escalateModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-rose-700">
                  <Siren className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Escalate Overdue Task to City Admin</h3>
                </div>
                <button onClick={() => setEscalateModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 space-y-1 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-rose-800 font-bold">{escalateModalComplaint.complaint_number}</span>
                  <span className="text-rose-900 font-extrabold">{getOverdueDetails(escalateModalComplaint.sla_deadline, now).text}</span>
                </div>
                <h4 className="font-extrabold text-gray-900 text-sm">{escalateModalComplaint.title}</h4>
                <p className="text-gray-700 text-[11px]">Assigned Staff: {escalateModalComplaint.assigned_staff_name || 'Unassigned'}</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Escalation Priority Level *</label>
                  <select
                    value={escalationPriority}
                    onChange={(e) => setEscalationPriority(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium min-h-[44px]"
                  >
                    <option value="Critical">Critical Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Emergency">Emergency Intervention</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Reason for Escalation *</label>
                  <textarea
                    rows={3}
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    placeholder="Specify why this task has exceeded SLA and requires City Admin intervention..."
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setEscalateModalComplaint(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleExecuteEscalation}
                  disabled={escalating}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px] inline-flex items-center space-x-1.5"
                >
                  <Siren className="w-3.5 h-3.5" />
                  <span>{escalating ? 'Escalating...' : 'Submit Escalation to City Admin'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* REASSIGN TASK MODAL */}
        {/* ================================================== */}
        {reassignModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Reassign Overdue Task to Service Staff</h3>
                </div>
                <button onClick={() => setReassignModalComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-mono text-emerald-700 font-bold block">{reassignModalComplaint.complaint_number}</span>
                  <span className="text-gray-500 font-mono">Current Staff: <strong className="text-amber-800">{reassignModalComplaint.assigned_staff_name || 'Unassigned'}</strong></span>
                </div>
                <h4 className="font-extrabold text-gray-900 text-sm">{reassignModalComplaint.title}</h4>
                <p className="text-gray-600 text-[11px]">{reassignModalComplaint.location_address}</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Select New {deptInfo.shortName} Service Staff Member *
                  </label>
                  <select
                    value={targetReassignStaffId}
                    onChange={(e) => setTargetReassignStaffId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium min-h-[44px]"
                  >
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.employee_id || 'STF-001'}) — Status: {s.status || 'Available'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Reassignment Reason *</label>
                  <textarea
                    rows={2}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="Provide reason for reassigning task..."
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setReassignModalComplaint(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleExecuteReassignment}
                  disabled={reassigning}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px]"
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* COMPLAINT / TASK DETAIL MODAL */}
        {/* ================================================== */}
        {detailModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8 font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">
                    Task Details & Overdue Audit (TASK-{detailModalComplaint.id.slice(0, 6).toUpperCase()})
                  </h3>
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
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer" onClick={() => setZoomImageUrl(detailModalComplaint.photo_before_url)}>
                    {detailModalComplaint.photo_before_url ? (
                      <img src={detailModalComplaint.photo_before_url} alt="Before" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Original complaint image unavailable</div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-emerald-700 block">Staff Repair Proof Evidence</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50 cursor-pointer flex items-center justify-center" onClick={() => detailModalComplaint.photo_after_url && setZoomImageUrl(detailModalComplaint.photo_after_url)}>
                    {detailModalComplaint.photo_after_url ? (
                      <img src={detailModalComplaint.photo_after_url} alt="After" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    ) : (
                      <div className="text-center p-4 space-y-1">
                        <Camera className="w-6 h-6 text-gray-400 mx-auto" />
                        <span className="text-xs font-bold text-gray-600 block">No progress evidence uploaded yet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* LOCATION & SLA DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 font-medium p-3.5 bg-rose-50/50 rounded-xl border border-rose-200">
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Location Address</span>
                  <span>{detailModalComplaint.location_address || 'Nashik Service Area'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Assigned Field Staff</span>
                  <span>{detailModalComplaint.assigned_staff_name || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">SLA Due Deadline</span>
                  <span className="font-mono text-rose-700 font-bold">{detailModalComplaint.sla_deadline ? new Date(detailModalComplaint.sla_deadline).toLocaleString() : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Overdue Duration</span>
                  <span className="font-mono text-rose-900 font-extrabold">{getOverdueDetails(detailModalComplaint.sla_deadline, now).text}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const comp = detailModalComplaint;
                      setDetailModalComplaint(null);
                      setReassignModalComplaint(comp);
                      setTargetReassignStaffId(departmentStaff[0]?.id || '');
                    }}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs rounded-xl transition-colors"
                  >
                    Reassign Task
                  </button>

                  <button
                    onClick={() => {
                      const comp = detailModalComplaint;
                      setDetailModalComplaint(null);
                      setEscalateModalComplaint(comp);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-colors"
                  >
                    Escalate Task
                  </button>
                </div>

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

      </div>
    </DashboardLayout>
  );
};
