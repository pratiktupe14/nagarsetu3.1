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
  ZoomIn, ZoomOut, Maximize2, FileCheck, CheckCircle, Siren, AlertOctagon, ShieldAlert,
  Compass
} from 'lucide-react';

// Fix standard Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom DivIcon generator for priority-based map markers
const createCustomMapMarkerIcon = (priority: string) => {
  let bgColor = '#059669'; // Emerald Low
  let pulseColor = '#10b981';

  if (priority === 'Critical') {
    bgColor = '#e11d48'; // Rose Critical
    pulseColor = '#f43f5e';
  } else if (priority === 'High') {
    bgColor = '#ea580c'; // Orange High
    pulseColor = '#fb923c';
  } else if (priority === 'Medium') {
    bgColor = '#d97706'; // Amber Medium
    pulseColor = '#f59e0b';
  }

  const svgHtml = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; background-color: ${pulseColor}; opacity: 0.35; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 24px; height: 24px; background-color: ${bgColor}; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

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
  const [mapLayerTab, setMapLayerTab] = useState<'All' | 'Unassigned' | 'Active Tasks' | 'Overdue' | 'Completed'>('All');
  const [taskLoadFilter, setTaskLoadFilter] = useState('All');
  const [selectedMapComplaint, setSelectedMapComplaint] = useState<Complaint | null>(null);
  const [showNoLocationDrawer, setShowNoLocationDrawer] = useState(false);

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

  // Completed Specific Metric Cards
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

  // Overdue Specific Metric Cards
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

  // Calculate Real Staff Summary Statistics
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
      if (isMapView) {
        if (mapLayerTab === 'Unassigned' && (c.assigned_staff_id || c.status === 'Resolved')) return false;
        if (mapLayerTab === 'Active Tasks' && c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way') return false;
        if (mapLayerTab === 'Overdue' && (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now)) return false;
        if (mapLayerTab === 'Completed' && c.status !== 'Resolved' && c.status !== 'Resolution Submitted') return false;
      } else if (isOverdue) {
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

      if (statusFilter !== 'All' && !isComplaints && !isMapView) {
        if (statusFilter === 'Unassigned' && c.assigned_staff_id) return false;
        if (statusFilter === 'Assigned' && !c.assigned_staff_id) return false;
        if (statusFilter !== 'Unassigned' && statusFilter !== 'Assigned' && c.status !== statusFilter) return false;
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
  }, [departmentComplaints, isMapView, mapLayerTab, isOverdue, overdueDurationFilter, isCompleted, reviewStatusTab, isInProgress, isAssignWorkspace, assignmentTab, isComplaints, statusFilter, priorityFilter, categoryFilter, staffFilter, slaFilter, searchQuery, now]);

  // Split Map Complaints into Plottable (valid lat/lng) vs Unavailable Coordinates
  const { mapPlottableComplaints, mapNoLocationComplaints } = useMemo(() => {
    const plottable: Complaint[] = [];
    const noLocation: Complaint[] = [];

    filteredComplaints.forEach((c) => {
      if (typeof c.latitude === 'number' && typeof c.longitude === 'number' && !isNaN(c.latitude) && !isNaN(c.longitude) && c.latitude !== 0 && c.longitude !== 0) {
        plottable.push(c);
      } else {
        noLocation.push(c);
      }
    });

    return { mapPlottableComplaints: plottable, mapNoLocationComplaints: noLocation };
  }, [filteredComplaints]);

  // Tasks belonging to the selected single staff member profile
  const staffProfileTasks = useMemo(() => {
    if (!staffIdFromPath) return [];
    return departmentComplaints.filter((c) => c.assigned_staff_id === staffIdFromPath);
  }, [departmentComplaints, staffIdFromPath]);

  // Reset page index when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, staffFilter, dateFilter, slaFilter, taskLoadFilter, assignmentTab, reviewStatusTab, overdueDurationFilter, mapLayerTab]);

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
    setMapLayerTab('All');
  };

  // Export Real Department Complaints to CSV
  const handleExportCSV = (selectedOnly: boolean = false) => {
    const targetList = selectedOnly && selectedComplaints.length > 0
      ? departmentComplaints.filter((c) => selectedComplaints.includes(c.id))
      : filteredComplaints;

    if (targetList.length === 0) return;

    const headers = ['Task ID', 'Complaint Number', 'Title', 'Category', 'Location Address', 'Latitude', 'Longitude', 'Priority', 'Status', 'Assigned Staff', 'SLA Due Date'];
    const rows = targetList.map((c) => [
      `"TASK-${c.id.slice(0, 6).toUpperCase()}"`,
      `"${c.complaint_number}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${(c.category || '').replace(/"/g, '""')}"`,
      `"${(c.location_address || '').replace(/"/g, '""')}"`,
      c.latitude || '',
      c.longitude || '',
      c.priority,
      c.status,
      `"${(c.assigned_staff_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : 'N/A'}"`
    ]);

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
    <DashboardLayout title={isMapView ? "Department Map" : isOverdue ? "Overdue Tasks" : isCompleted ? "Completed Tasks" : isInProgress ? t('inProgress') : isStaffView ? t('staff') : isAssignWorkspace ? t('taskAssignment') : "Department Operations"}>
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
                  {isMapView ? 'INTERACTIVE GIS DEPARTMENT MAP' : isOverdue ? 'OVERDUE TASKS' : isCompleted ? 'COMPLETED TASKS' : isInProgress ? 'IN PROGRESS TASKS' : 'DEPARTMENT HEAD PORTAL'}
                </span>
                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ID: {headDeptId}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                {isMapView ? 'Monitor your department\'s complaints, active tasks, and field operations across Nashik.' : isOverdue ? 'Tasks requiring immediate departmental attention.' : isCompleted ? 'Work completed by your department\'s service staff.' : isInProgress ? 'Assigned work currently being executed by service staff.' : `Managed by ${headName} • Scope: ${deptInfo.description}`}
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
        
        {/* A. DEPARTMENT HEAD → DEPARTMENT MAP PAGE (/department-head/map) */}
        {isMapView ? (
          <div className="space-y-6">

            {/* MAP FILTER TOOLBAR */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
              
              {/* LAYER QUICK TABS */}
              <div className="flex items-center space-x-2 border-b border-gray-200 pb-3 overflow-x-auto text-xs font-bold font-outfit">
                {(['All', 'Unassigned', 'Active Tasks', 'Overdue', 'Completed'] as const).map((layer) => (
                  <button
                    key={layer}
                    onClick={() => setMapLayerTab(layer)}
                    className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
                      mapLayerTab === layer
                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-slate-100'
                    }`}
                  >
                    {layer === 'All' ? 'All Department' : layer}
                  </button>
                ))}
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search location address, Complaint ID, Issue, Staff Name..."
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Staff Filter */}
                  <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                  >
                    <option value="All">All Department Staff</option>
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
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

                  {(searchQuery || priorityFilter !== 'All' || categoryFilter !== 'All' || staffFilter !== 'All' || mapLayerTab !== 'All') && (
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

            {/* MAIN MAP WORKSPACE (8 COL MAP + 4 COL ACTIVITY PANEL) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* LEFT / CENTER: LARGE INTERACTIVE MAP CONTAINER (COL 8) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-xs bg-slate-100 min-h-[600px] h-[650px] z-10">
                  
                  <MapContainer
                    center={[20.0059, 73.7898]}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* REAL SUPABASE COMPLAINT MARKERS */}
                    {mapPlottableComplaints.map((comp) => {
                      const markerIcon = createCustomMapMarkerIcon(comp.priority);
                      const isSelected = selectedMapComplaint?.id === comp.id;

                      return (
                        <Marker
                          key={comp.id}
                          position={[comp.latitude, comp.longitude]}
                          icon={markerIcon}
                          eventHandlers={{
                            click: () => setSelectedMapComplaint(comp)
                          }}
                        >
                          <Popup>
                            <div className="p-1 space-y-2 text-xs font-sans max-w-xs">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                                <span className="font-mono font-bold text-emerald-800">{comp.complaint_number}</span>
                                <PriorityBadge priority={comp.priority} />
                              </div>

                              <div>
                                <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</h4>
                                <span className="text-[10px] text-gray-500 font-mono block">{comp.category}</span>
                              </div>

                              <div className="text-[11px] text-gray-600 space-y-1">
                                <div className="flex items-center space-x-1">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{comp.location_address || 'Nashik Service Area'}</span>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <span>Staff: <strong>{comp.assigned_staff_name || 'Unassigned'}</strong></span>
                                  <StatusBadge status={comp.status} />
                                </div>
                              </div>

                              <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
                                <button
                                  onClick={() => setDetailModalComplaint(comp)}
                                  className="w-full px-3 py-1.5 bg-emerald-600 text-white font-extrabold rounded-lg text-xs hover:bg-emerald-700"
                                >
                                  View Task Details
                                </button>

                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${comp.latitude},${comp.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200"
                                  title="Get Google Directions"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>

                  {/* FLOATING MAP MAP LEGEND */}
                  <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-gray-200 shadow-lg z-20 text-xs font-mono space-y-2 max-w-xs">
                    <span className="font-extrabold text-gray-900 block font-outfit uppercase text-[10px]">Map Marker Legend</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
                        <span className="font-bold text-gray-800">Critical Priority</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span>
                        <span className="font-bold text-gray-800">High Priority</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
                        <span className="font-bold text-gray-800">Medium Priority</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                        <span className="font-bold text-gray-800">Low Priority</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT SIDE: DEPARTMENT ACTIVITY PANEL & SELECTED TASK DETAILS (COL 4) */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* 6 ACTIVITY METRIC TILES (REAL DATABASE DATA) */}
                <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-gray-900 font-outfit text-sm uppercase tracking-wider">
                    Department Operations ({filteredComplaints.length})
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <button
                      onClick={() => setMapLayerTab('All')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mapLayerTab === 'All' ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Total Records</span>
                      <span className="text-lg font-extrabold text-gray-900 font-mono block">{complaintMetrics.total}</span>
                    </button>

                    <button
                      onClick={() => setMapLayerTab('Unassigned')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mapLayerTab === 'Unassigned' ? 'bg-amber-50 border-amber-500' : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Unassigned</span>
                      <span className="text-lg font-extrabold text-amber-700 font-mono block">{complaintMetrics.unassigned}</span>
                    </button>

                    <button
                      onClick={() => setMapLayerTab('Active Tasks')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mapLayerTab === 'Active Tasks' ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Active Tasks</span>
                      <span className="text-lg font-extrabold text-blue-700 font-mono block">{complaintMetrics.inProgress}</span>
                    </button>

                    <button
                      onClick={() => setMapLayerTab('Overdue')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mapLayerTab === 'Overdue' ? 'bg-rose-50 border-rose-500' : 'bg-slate-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Overdue Tasks</span>
                      <span className="text-lg font-extrabold text-rose-700 font-mono block">{complaintMetrics.overdue}</span>
                    </button>
                  </div>
                </div>

                {/* SELECTED MARKER CARD OR ACTIVE INSPECTION PANEL */}
                {selectedMapComplaint ? (
                  <div className="p-4 bg-white border-2 border-emerald-500 rounded-2xl space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <span className="font-mono font-bold text-emerald-800 text-xs">{selectedMapComplaint.complaint_number}</span>
                      <div className="flex items-center space-x-1.5">
                        <PriorityBadge priority={selectedMapComplaint.priority} />
                        <button onClick={() => setSelectedMapComplaint(null)} className="p-1 text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{selectedMapComplaint.title}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{selectedMapComplaint.description || 'No detailed description provided.'}</p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <StatusBadge status={selectedMapComplaint.status} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Staff:</span>
                        <span className="font-bold text-gray-900">{selectedMapComplaint.assigned_staff_name || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Location:</span>
                        <span className="font-bold text-gray-900 truncate max-w-[180px]">{selectedMapComplaint.location_address || 'Nashik'}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => setDetailModalComplaint(selectedMapComplaint)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors"
                      >
                        View Full Complaint Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                    <Compass className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h4 className="font-extrabold text-gray-900 text-xs font-outfit">Click any map marker</h4>
                    <p className="text-[11px] text-gray-500">Click a marker on the Nashik GIS map to inspect details, staff workload, and SLA status.</p>
                  </div>
                )}

                {/* LOCATIONS UNAVAILABLE DRAWER ACCORDION */}
                {mapNoLocationComplaints.length > 0 && (
                  <div className="p-4 bg-white border border-amber-200 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h4 className="font-extrabold text-gray-900 font-outfit text-xs">
                          Locations Unavailable ({mapNoLocationComplaints.length})
                        </h4>
                      </div>

                      <button
                        onClick={() => setShowNoLocationDrawer(!showNoLocationDrawer)}
                        className="text-[11px] font-bold text-amber-800 hover:underline"
                      >
                        {showNoLocationDrawer ? 'Hide List' : 'View List'}
                      </button>
                    </div>

                    {showNoLocationDrawer && (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
                        {mapNoLocationComplaints.map((comp) => (
                          <div key={comp.id} className="p-2.5 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-emerald-800 text-[11px] block">{comp.complaint_number}</span>
                              <span className="font-semibold text-gray-900 truncate max-w-[180px] block">{comp.title}</span>
                            </div>

                            <button
                              onClick={() => setDetailModalComplaint(comp)}
                              className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-[10px] rounded-lg"
                            >
                              Inspect
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

          </div>
        ) : isOverdue ? (
          /* B. DEPARTMENT HEAD → OVERDUE TASKS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1 bg-rose-50/50">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block font-outfit">Total Overdue</span>
                <span className="text-xl font-extrabold text-rose-900 font-mono block">{overdueMetrics.totalOverdue}</span>
              </div>
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
                <span className="text-xl font-extrabold text-rose-700 font-mono block">{overdueMetrics.critical}</span>
              </div>
            </div>
          </div>
        ) : isCompleted ? (
          /* C. DEPARTMENT HEAD → COMPLETED TASKS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Completed</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{completedMetrics.total}</span>
              </div>
            </div>
          </div>
        ) : isInProgress ? (
          /* D. DEPARTMENT HEAD → IN PROGRESS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
                <span className="text-2xl font-extrabold text-amber-700 font-mono block">{inProgressMetrics.total}</span>
              </div>
            </div>
          </div>
        ) : isStaffDetailView && selectedStaffProfile ? (
          /* E. STAFF PROFILE DETAIL VIEW */
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
          /* F. DEPARTMENT HEAD → STAFF ROSTER PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Staff</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{staffMetrics.totalStaff}</span>
              </div>
            </div>
          </div>
        ) : isAssignWorkspace ? (
          /* G. DEPARTMENT HEAD → TASK ASSIGNMENT WORKSPACE */
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">Task Assignment Workspace</h2>
            </div>
          </div>
        ) : (
          /* H. DEFAULT COMPLAINTS TABLE VIEW */
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
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Reassign Task to Service Staff</h3>
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
                    Task Details & GIS Audit (TASK-{detailModalComplaint.id.slice(0, 6).toUpperCase()})
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 font-medium p-3.5 bg-slate-50 rounded-xl border border-gray-200">
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
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Coordinates</span>
                  <span className="font-mono text-gray-900">
                    {detailModalComplaint.latitude && detailModalComplaint.longitude ? `${detailModalComplaint.latitude.toFixed(4)}, ${detailModalComplaint.longitude.toFixed(4)}` : 'Location Not Verified'}
                  </span>
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
