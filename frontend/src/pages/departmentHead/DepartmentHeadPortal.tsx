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
import {
  getNotificationsForRole, pushNotification, markNotificationAsRead,
  markAllNotificationsAsRead
} from '../../services/notificationService';
import { Complaint, ComplaintStatus, UserProfile, NotificationItem } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
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
  Compass, KeyRound, LogOut, Edit3, Save
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
  if (activeTaskCount === 0) {
    return { label: 'LOW (Available)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (activeTaskCount <= 3) {
    return { label: 'NORMAL', color: 'bg-blue-50 text-blue-800 border-blue-200' };
  }
  if (activeTaskCount <= 6) {
    return { label: 'HIGH', color: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { label: 'OVERLOADED', color: 'bg-rose-50 text-rose-800 border-rose-200' };
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

// Relative Time Formatter
const formatRelativeTimestamp = (isoDateString: string) => {
  if (!isoDateString) return 'Just now';
  const past = new Date(isoDateString).getTime();
  const now = Date.now();
  const diffMs = now - past;

  if (diffMs < 60000) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(isoDateString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export const DepartmentHeadPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, lang, changeLanguage, translateCategory, translateStatus, translatePriority, translateDepartment } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Sub-routes & active view modes
  const currentPath = location.pathname;
  const isDashboard = currentPath === '/department/portal' || currentPath === '/department-head/portal';
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

  // Extract staff ID if viewing single staff member
  const staffIdFromPath = isStaffDetailView ? currentPath.split('/department-head/staff/')[1] : null;

  const [activeHeadRecord, setActiveHeadRecord] = useState<any>(null);
  const [isHeadActive, setIsHeadActive] = useState<boolean>(true);

  // Department Identity
  const headName = activeHeadRecord?.name || user?.full_name || 'Department Head';
  const headDepartmentFull = activeHeadRecord?.departments?.name || user?.department_name || '';
  const headDepartment = headDepartmentFull ? headDepartmentFull.split('(')[0].trim() : '';
  const headDeptId = activeHeadRecord?.department_id || user?.department_id || '';
  const headId = activeHeadRecord?.user_id || user?.id || '';

  const deptInfo = useMemo(() => getDepartmentInfo(headDepartmentFull), [headDepartmentFull]);
  const isSanitationDept = useMemo(() => {
    const normDeptId = String(headDeptId == null ? '' : headDeptId).trim().toLowerCase();
    const normDeptFull = String(headDepartmentFull == null ? '' : headDepartmentFull).trim().toLowerCase();
    const normShort = String(deptInfo.shortName == null ? '' : deptInfo.shortName).trim().toLowerCase();
    return normShort.includes('sanitation') || normDeptId.includes('san') || normDeptFull.includes('waste');
  }, [deptInfo, headDeptId, headDepartmentFull]);
  const isElectricalDept = useMemo(() => {
    const normDeptId = String(headDeptId == null ? '' : headDeptId).trim().toLowerCase();
    const normDeptFull = String(headDepartmentFull == null ? '' : headDepartmentFull).trim().toLowerCase();
    const normShort = String(deptInfo.shortName == null ? '' : deptInfo.shortName).trim().toLowerCase();
    return normShort.includes('electric') || normDeptId.includes('ele') || normDeptFull.includes('light');
  }, [deptInfo, headDeptId, headDepartmentFull]);

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

  // Notifications Page Specific States
  const [notifSearchQuery, setNotifSearchQuery] = useState('');
  const [notifFilterTab, setNotifFilterTab] = useState<'All' | 'Unread' | 'Read' | 'Tasks' | 'Complaints' | 'Staff' | 'Alerts'>('All');
  const [confirmMarkAllReadModal, setConfirmMarkAllReadModal] = useState(false);

  // Profile Page Specific States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(headName);
  const [editPhone, setEditPhone] = useState(user?.mobile || '+91 98220 00000');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Change Password Modal States
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Notification Preferences States
  const [notifPrefs, setNotifPrefs] = useState({
    taskAssigned: true,
    taskCompleted: true,
    taskOverdue: true,
    newComplaint: true,
    reworkRequested: true,
    systemAlerts: true
  });

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

  // Load Department Data (Complaints, Staff, Notifications strictly by department from Supabase)
  const loadData = useCallback(async (opts?: boolean | React.MouseEvent) => {
    const isInitial = typeof opts === 'boolean' ? opts : true;
    if (isInitial) setLoading(true);
    setError(null);
    try {
      let activeDeptId = headDeptId || user?.department_id || '';
      let activeDeptFull = headDepartmentFull || user?.department_name || '';
      let activeHeadId = headId || user?.id || '';

      if (isSupabaseConfigured() && user?.email) {
        const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
        const cleanEmail = (user.email || '').toLowerCase();

        let dhQuery = supabase.from('department_heads').select('*, departments(*)');
        if (isUuid(user.id)) {
          dhQuery = dhQuery.or(`user_id.eq.${user.id},email.eq.${cleanEmail}`);
        } else {
          dhQuery = dhQuery.eq('email', cleanEmail);
        }

        const { data: dhRow } = await dhQuery.eq('status', 'active').maybeSingle();

        if (dhRow) {
          setActiveHeadRecord(dhRow);
          setIsHeadActive(true);
          activeDeptId = dhRow.department_id;
          activeDeptFull = dhRow.departments?.name || activeDeptFull;
          activeHeadId = dhRow.user_id || activeHeadId;
        } else {
          let anyQuery = supabase.from('department_heads').select('*');
          if (isUuid(user.id)) {
            anyQuery = anyQuery.or(`user_id.eq.${user.id},email.eq.${cleanEmail}`);
          } else {
            anyQuery = anyQuery.eq('email', cleanEmail);
          }
          const { data: anyDhRow } = await anyQuery.maybeSingle();

          if (anyDhRow && anyDhRow.status === 'inactive') {
            setIsHeadActive(false);
          }
        }
      }

      // Validate that department assignment exists
      if (!activeDeptId && !activeDeptFull) {
        setError('Department assignment could not be verified. Please contact City Administration.');
        setDepartmentComplaints([]);
        setDepartmentStaff([]);
        setLoading(false);
        return;
      }

      const deptFilteredComplaints = await getDepartmentComplaints(activeDeptId, activeDeptFull);
      setDepartmentComplaints(deptFilteredComplaints);

      const deptFilteredStaff = await getDepartmentServiceStaff(activeDeptId, activeDeptFull);
      setDepartmentStaff(deptFilteredStaff);

      if (staffIdFromPath) {
        const staffObj = await getStaffMemberById(staffIdFromPath);
        setSelectedStaffProfile(staffObj);
      }

      const notifs = getNotificationsForRole(activeHeadId, 'department_head');
      setNotifications(notifs);

    } catch (err) {
      console.error('Error loading Department Head data:', err);
      setError('Unable to load department data. Please try again.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [headDeptId, headDepartmentFull, headId, staffIdFromPath, user]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData(false);
  }, [loadData]));

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('realtime_dh_portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_heads' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const now = new Date();

  // Notification Metrics & Filtering (Real Supabase Data)
  const notifMetrics = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.is_read).length;
    const tasks = notifications.filter((n) => n.type === 'staff_assigned' || n.type === 'work_started' || n.type === 'department_assigned').length;
    const reviews = notifications.filter((n) => n.type === 'resolution_submitted' || n.type === 'resolved' || n.type === 'reopened').length;
    const alerts = notifications.filter((n) => n.type === 'sla_breached' || n.type === 'sla_warning' || n.type === 'critical').length;
    return { total, unread, tasks, reviews, alerts };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab filter
      if (notifFilterTab === 'Unread' && n.is_read) return false;
      if (notifFilterTab === 'Read' && !n.is_read) return false;
      if (notifFilterTab === 'Tasks' && n.type !== 'staff_assigned' && n.type !== 'work_started' && n.type !== 'department_assigned') return false;
      if (notifFilterTab === 'Complaints' && n.type !== 'submitted' && n.type !== 'verified' && n.type !== 'approved') return false;
      if (notifFilterTab === 'Staff' && n.type !== 'staff_assigned') return false;
      if (notifFilterTab === 'Alerts' && n.type !== 'sla_breached' && n.type !== 'sla_warning' && n.type !== 'critical') return false;

      // Search Query
      if (notifSearchQuery.trim()) {
        const q = notifSearchQuery.toLowerCase();
        const titleMatch = n.title.toLowerCase().includes(q);
        const msgMatch = n.message.toLowerCase().includes(q);
        const numMatch = (n.complaint_number || '').toLowerCase().includes(q);
        if (!titleMatch && !msgMatch && !numMatch) return false;
      }

      return true;
    });
  }, [notifications, notifFilterTab, notifSearchQuery]);

  // Mark single notification read
  const handleMarkSingleRead = (notifId: string) => {
    markNotificationAsRead(notifId);
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n)));
  };

  // Mark all notifications read
  const handleExecuteMarkAllRead = () => {
    markAllNotificationsAsRead(headId, 'department_head');
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setConfirmMarkAllReadModal(false);
  };

  // Notification click handler -> Navigate to proper operational detail page
  const handleNotificationClick = (notif: NotificationItem) => {
    handleMarkSingleRead(notif.id);

    if (notif.complaint_id) {
      const matchedComp = departmentComplaints.find((c) => c.id === notif.complaint_id || c.complaint_number === notif.complaint_number);
      if (matchedComp) {
        setDetailModalComplaint(matchedComp);
        return;
      }
    }

    if (notif.type === 'resolution_submitted' || notif.type === 'resolved') {
      navigate('/department-head/tasks/completed');
    } else if (notif.type === 'sla_breached' || notif.type === 'sla_warning') {
      navigate('/department-head/tasks/overdue');
    } else if (notif.type === 'staff_assigned' || notif.type === 'work_started') {
      navigate('/department-head/tasks/in-progress');
    } else {
      navigate('/department-head/complaints');
    }
  };

  // Profile Update Handler (Real Supabase + Local Storage Update)
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('Full Name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    setProfileSuccessMsg(null);

    try {
      if (isSupabaseConfigured() && user?.id) {
        await supabase.from('profiles').update({
          full_name: editName.trim(),
          mobile: editPhone.trim()
        }).eq('id', user.id);
      }

      // Update cached local user
      const updatedUser = { ...user, full_name: editName.trim(), mobile: editPhone.trim() };
      localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));

      setIsEditingProfile(false);
      setProfileSuccessMsg('Profile updated successfully.');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert(err.message || 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password Handler (Supabase Auth)
  const handleExecuteChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      if (isSupabaseConfigured()) {
        const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
        if (authErr) throw authErr;
      }

      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setChangePasswordModal(false);
        setPasswordSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Calculate Real Complaint Summary Statistics
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

  // Sanitation Department Operational Metrics (Derived from real DB complaint categories & statuses)
  const sanitationMetrics = useMemo(() => {
    const garbageComplaints = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('garbage')
    ).length;

    const overflowingDustbins = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('dustbin') || (c.title || '').toLowerCase().includes('dustbin')
    ).length;

    const wasteAccumulation = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('waste') || (c.title || '').toLowerCase().includes('accumulation')
    ).length;

    const publicDumping = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('dumping') || (c.title || '').toLowerCase().includes('dump')
    ).length;

    const collectionRequests = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('collection') || (c.title || '').toLowerCase().includes('collection')
    ).length;

    const pendingCleanup = departmentComplaints.filter((c) =>
      c.status !== 'Resolved' && c.status !== 'Rejected'
    ).length;

    const completedCleanup = departmentComplaints.filter((c) =>
      c.status === 'Resolved'
    ).length;

    const overdueCleanup = departmentComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    return {
      garbageComplaints,
      overflowingDustbins,
      wasteAccumulation,
      publicDumping,
      collectionRequests,
      pendingCleanup,
      completedCleanup,
      overdueCleanup
    };
  }, [departmentComplaints, now]);

  // Electrical & Street Lighting Operational Metrics (Derived from real DB complaint records)
  const electricalMetrics = useMemo(() => {
    const brokenStreetlights = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('broken') || (c.title || '').toLowerCase().includes('broken streetlight')
    ).length;

    const streetlightOutages = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('outage') || (c.title || '').toLowerCase().includes('not working') || (c.title || '').toLowerCase().includes('flickering')
    ).length;

    const electricalPoleDamage = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('pole') || (c.title || '').toLowerCase().includes('pole')
    ).length;

    const exposedWiring = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('wiring') || (c.title || '').toLowerCase().includes('wire') || (c.description || '').toLowerCase().includes('exposed')
    ).length;

    const electricalHazards = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('hazard') || (c.title || '').toLowerCase().includes('spark') || c.priority === 'Critical'
    ).length;

    const lightingMaintenance = departmentComplaints.filter((c) =>
      (c.category || '').toLowerCase().includes('maintenance') || (c.category || '').toLowerCase().includes('installation')
    ).length;

    const pendingRepairs = departmentComplaints.filter((c) =>
      c.status !== 'Resolved' && c.status !== 'Rejected'
    ).length;

    const completedRepairs = departmentComplaints.filter((c) =>
      c.status === 'Resolved'
    ).length;

    return {
      brokenStreetlights,
      streetlightOutages,
      electricalPoleDamage,
      exposedWiring,
      electricalHazards,
      lightingMaintenance,
      pendingRepairs,
      completedRepairs
    };
  }, [departmentComplaints]);

  // Critical Electrical Safety Alerts (High-risk hazards: exposed live wire, fallen pole, sparks, critical priority)
  const criticalElectricalSafetyAlerts = useMemo(() => {
    return departmentComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected') return false;
      const text = `${c.title} ${c.category} ${c.description}`.toLowerCase();
      const isHighRiskHazard = text.includes('wire') || text.includes('pole') || text.includes('spark') || text.includes('hazard') || text.includes('exposed');
      return c.priority === 'Critical' || (c.priority === 'High' && isHighRiskHazard);
    });
  }, [departmentComplaints]);

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

  // Split Map Complaints
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
    setNotifSearchQuery('');
    setNotifFilterTab('All');
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

  // Confirm Task Assignment to Department Staff
  const handleExecuteAssignment = async (compObj: Complaint, staffObj: ServiceStaffMemberRecord) => {
    const cleanHeadDept = String(headDepartmentFull || '').split('(')[0].trim().toLowerCase();
    const cleanStaffDept = String(staffObj.department_name || '').split('(')[0].trim().toLowerCase();

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

  // Execute Reassignment
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

  // Execute Escalation
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

  if (!isHeadActive || user?.status === 'Inactive' || user?.status === 'inactive') {
    return (
      <DashboardLayout title="Leadership Account Inactive">
        <div className="p-8 max-w-md mx-auto my-16 bg-white border border-rose-200 rounded-2xl shadow-lg text-center space-y-4 font-sans">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 font-outfit">Department Leadership Inactive</h2>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            Your Department Head account status is currently <strong>Inactive</strong> or unassigned to an active municipal department. Department Head portal access has been revoked.
          </p>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors"
          >
            Log Out of Session
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isNotifView ? "Notifications" : isProfileView ? "Department Head Profile" : isMapView ? "Department Map" : isOverdue ? "Overdue Tasks" : isCompleted ? "Completed Tasks" : isInProgress ? t('inProgress') : isStaffView ? t('staff') : isAssignWorkspace ? t('taskAssignment') : "Department Operations"}>
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
                  {isNotifView ? 'DEPARTMENT NOTIFICATIONS' : isProfileView ? 'HEAD PROFILE' : isMapView ? 'INTERACTIVE GIS DEPARTMENT MAP' : isOverdue ? 'OVERDUE TASKS' : isCompleted ? 'COMPLETED TASKS' : isInProgress ? 'IN PROGRESS TASKS' : 'DEPARTMENT HEAD PORTAL'}
                </span>
                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ID: {headDeptId}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                {isNotifView ? 'Stay updated about complaints, staff assignments, tasks, reviews, and department activity.' : isProfileView ? 'View and manage your professional profile, security, and notification preferences.' : isMapView ? 'Monitor your department\'s complaints, active tasks, and field operations across Nashik.' : isOverdue ? 'Tasks requiring immediate departmental attention.' : isCompleted ? 'Work completed by your department\'s service staff.' : isInProgress ? 'Assigned work currently being executed by service staff.' : `Managed by ${headName} • Scope: ${deptInfo.description}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {isNotifView && (
              <button
                onClick={() => setConfirmMarkAllReadModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-xs transition-all min-h-[40px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark All as Read</span>
              </button>
            )}

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
        
        {/* A. DEPARTMENT HEAD → NOTIFICATIONS PAGE (/department-head/notifications) */}
        {isNotifView ? (
          <div className="space-y-6">

            {/* 5 NOTIFICATION SUMMARY CARDS (REAL SUPABASE DATA) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Notifications</span>
                <span className="text-2xl font-extrabold text-gray-900 font-mono block">{notifMetrics.total}</span>
              </div>

              <div className="p-4 text-center space-y-1 bg-emerald-50/50">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block font-outfit">Unread</span>
                <span className="text-2xl font-extrabold text-emerald-700 font-mono block">{notifMetrics.unread}</span>
              </div>

              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Tasks</span>
                <span className="text-2xl font-extrabold text-blue-700 font-mono block">{notifMetrics.tasks}</span>
              </div>

              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Reviews</span>
                <span className="text-2xl font-extrabold text-purple-700 font-mono block">{notifMetrics.reviews}</span>
              </div>

              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Alerts & Overdue</span>
                <span className="text-2xl font-extrabold text-rose-700 font-mono block">{notifMetrics.alerts}</span>
              </div>
            </div>

            {/* FILTER TOOLBAR FOR NOTIFICATIONS */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={notifSearchQuery}
                    onChange={(e) => setNotifSearchQuery(e.target.value)}
                    placeholder="Search notifications by keyword, title, complaint ID..."
                    className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold font-outfit">
                  {(['All', 'Unread', 'Read', 'Tasks', 'Complaints', 'Staff', 'Alerts'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setNotifFilterTab(tab)}
                      className={`px-3.5 py-2.5 rounded-xl transition-colors whitespace-nowrap min-h-[42px] ${
                        notifFilterTab === tab
                          ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-slate-100'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}

                  {(notifSearchQuery || notifFilterTab !== 'All') && (
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

            {/* NOTIFICATION LIST ITEM STACK */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                <Bell className="w-10 h-10 text-gray-400 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">No notifications</h3>
                <p className="text-xs text-gray-500">You're all caught up. New department operational activity will appear here.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notif) => {
                  const isUnread = !notif.is_read;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isUnread
                          ? 'bg-emerald-50/60 border-emerald-300 border-l-4 border-l-emerald-600 shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                          notif.type === 'sla_breached' || notif.type === 'critical'
                            ? 'bg-rose-100 text-rose-700'
                            : notif.type === 'resolution_submitted'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {notif.type === 'sla_breached' ? <Siren className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{notif.title}</h4>
                            {notif.complaint_number && (
                              <span className="font-mono text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {notif.complaint_number}
                              </span>
                            )}
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 font-medium leading-relaxed">{notif.message}</p>
                          
                          <span className="text-[10px] text-gray-400 font-mono block">
                            {formatRelativeTimestamp(notif.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        {isUnread && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkSingleRead(notif.id);
                            }}
                            className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                          >
                            Mark as Read
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notif);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors inline-flex items-center space-x-1"
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        ) : isProfileView ? (
          /* B. DEPARTMENT HEAD → PROFILE PAGE (/department-head/profile) */
          <div className="space-y-6 max-w-5xl mx-auto">
            
            {profileSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 font-bold text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {/* PROFILE BANNER & IDENTITY CARD */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-3xl flex items-center justify-center font-outfit border-4 border-emerald-500 shrink-0 shadow-md">
                    {headName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h2 className="text-2xl font-extrabold text-gray-900 font-outfit">{headName}</h2>
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        DEPT-HEAD-001
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 font-medium block mt-1">
                      Department Head • {deptInfo.fullName}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono block mt-0.5">
                      {user?.email || 'rahul.kumar@nagarsetu.gov.in'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-800 font-extrabold text-xs rounded-xl transition-colors inline-flex items-center space-x-1.5"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}</span>
                  </button>

                  <button
                    onClick={() => setChangePasswordModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-colors inline-flex items-center space-x-1.5 shadow-xs"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Change Password</span>
                  </button>
                </div>
              </div>

              {/* EDIT PROFILE FORM OR VIEW DETAILS */}
              {isEditingProfile ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-4 text-xs">
                  <h3 className="font-extrabold text-gray-900 font-outfit text-sm uppercase tracking-wider">
                    Edit Personal Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Contact Phone *</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-xs"
                    >
                      {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* PERSONAL INFORMATION GRID */
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Official Role</span>
                    <span className="font-extrabold text-gray-900 block">Department Head</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Department Jurisdiction</span>
                    <span className="font-extrabold text-gray-900 block">{deptInfo.shortName}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Official Email</span>
                    <span className="font-semibold text-gray-900 block truncate">{user?.email || 'rahul.kumar@nagarsetu.gov.in'}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Account Security Status</span>
                    <span className="font-extrabold text-emerald-700 block">Active & Verified</span>
                  </div>
                </div>
              )}
            </div>

            {/* MY DEPARTMENT OVERVIEW CARD */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">My Department ({deptInfo.fullName})</h3>
                </div>

                <Link
                  to="/department-head/map"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-colors text-xs inline-flex items-center space-x-1"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>View Department Map</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Active Field Staff</span>
                  <span className="text-xl font-extrabold text-gray-900 font-mono block">{complaintMetrics.staffCount}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Active In-Progress Tasks</span>
                  <span className="text-xl font-extrabold text-amber-700 font-mono block">{complaintMetrics.inProgress}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Completed Tasks</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono block">{complaintMetrics.resolved}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Overdue Tasks</span>
                  <span className="text-xl font-extrabold text-rose-700 font-mono block">{complaintMetrics.overdue}</span>
                </div>
              </div>
            </div>

            {/* NOTIFICATION PREFERENCES CARD */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4 text-xs">
              <div className="flex items-center space-x-2 border-b border-gray-200 pb-3">
                <Bell className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Notification Preferences</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-800">Task Assignment Alerts</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.taskAssigned}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, taskAssigned: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-800">Task Completion Alerts</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.taskCompleted}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, taskCompleted: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-800">SLA Overdue Warning Alerts</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.taskOverdue}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, taskOverdue: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-800">New Complaint Alerts</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.newComplaint}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, newComplaint: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* DANGER ZONE / ACCOUNT ACTIONS */}
            <div className="p-6 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-3 text-xs">
              <h3 className="font-extrabold text-rose-900 font-outfit text-sm uppercase tracking-wider">Account Actions</h3>
              <p className="text-gray-600 font-medium">Log out of your NAGARSETU 3.0 Department Head session.</p>

              <div className="pt-2">
                <button
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center space-x-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>

          </div>
        ) : isMapView ? (
          /* C. DEPARTMENT HEAD → DEPARTMENT MAP PAGE */
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">Department Map Workspace</h2>
            </div>
          </div>
        ) : isOverdue ? (
          /* D. DEPARTMENT HEAD → OVERDUE TASKS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1 bg-rose-50/50">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block font-outfit">Total Overdue</span>
                <span className="text-xl font-extrabold text-rose-900 font-mono block">{overdueMetrics.totalOverdue}</span>
              </div>
            </div>
          </div>
        ) : isCompleted ? (
          /* E. DEPARTMENT HEAD → COMPLETED TASKS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Completed</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{completedMetrics.total}</span>
              </div>
            </div>
          </div>
        ) : isInProgress ? (
          /* F. DEPARTMENT HEAD → IN PROGRESS PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">In Progress</span>
                <span className="text-2xl font-extrabold text-amber-700 font-mono block">{inProgressMetrics.total}</span>
              </div>
            </div>
          </div>
        ) : isStaffDetailView && selectedStaffProfile ? (
          /* G. STAFF PROFILE DETAIL VIEW */
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
          /* H. DEPARTMENT HEAD → STAFF ROSTER PAGE */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Staff</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{staffMetrics.totalStaff}</span>
              </div>
            </div>
          </div>
        ) : isAssignWorkspace ? (
          /* I. DEPARTMENT HEAD → TASK ASSIGNMENT WORKSPACE */
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">Task Assignment Workspace</h2>
            </div>
          </div>
        ) : (
          /* J. MAIN DEPARTMENT DASHBOARD & COMPLAINTS DIRECTORY */
          <div className="space-y-6">

            {/* 1. PRIMARY STATISTICS CARDS (DERIVED FROM SUPABASE DB) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">{t('totalComplaints')}</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{complaintMetrics.total}</span>
              </div>

              <div className="p-3.5 text-center space-y-1 bg-amber-50/40">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block font-outfit">{t('unassigned')}</span>
                <span className="text-xl font-extrabold text-amber-900 font-mono block">{complaintMetrics.unassigned}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">{t('assigned')}</span>
                <span className="text-xl font-extrabold text-blue-700 font-mono block">{complaintMetrics.assigned}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">{t('inProgress')}</span>
                <span className="text-xl font-extrabold text-amber-600 font-mono block">{complaintMetrics.inProgress}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">{t('pendingReview')}</span>
                <span className="text-xl font-extrabold text-purple-700 font-mono block">{complaintMetrics.completedReviews}</span>
              </div>

              <div className="p-3.5 text-center space-y-1 bg-rose-50/50">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block font-outfit">{t('overdue')}</span>
                <span className="text-xl font-extrabold text-rose-900 font-mono block">{complaintMetrics.overdue}</span>
              </div>

              <div className="p-3.5 text-center space-y-1 bg-red-50/30">
                <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block font-outfit">{t('criticalPriority')}</span>
                <span className="text-xl font-extrabold text-red-700 font-mono block">{complaintMetrics.critical}</span>
              </div>

              <div className="p-3.5 text-center space-y-1 bg-emerald-50/40">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block font-outfit">{t('resolved')}</span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono block">{complaintMetrics.resolved}</span>
              </div>
            </div>

            {/* 2A. CRITICAL ELECTRICAL SAFETY ALERTS SECTION (WHEN ELECTRICAL DEPT & CRITICAL ALERTS EXIST) */}
            {isElectricalDept && criticalElectricalSafetyAlerts.length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-400/80 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-red-900">
                    <Zap className="w-5 h-5 text-red-600 animate-bounce" />
                    <h3 className="text-xs font-extrabold font-outfit uppercase tracking-wider text-red-900">
                      ⚠️ CRITICAL ELECTRICAL SAFETY ALERTS ({criticalElectricalSafetyAlerts.length})
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-extrabold bg-red-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Immediate Action Required
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {criticalElectricalSafetyAlerts.slice(0, 6).map((alertComp) => (
                    <div key={alertComp.id} className="p-3 bg-white border border-red-200 rounded-xl space-y-2 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-red-700">{alertComp.complaint_number}</span>
                        <PriorityBadge priority={alertComp.priority} />
                      </div>
                      <h4 className="font-extrabold text-gray-900 line-clamp-1">{alertComp.title}</h4>
                      <p className="text-[11px] text-gray-600 line-clamp-2">{alertComp.description}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px] text-gray-500">
                        <span className="truncate max-w-[150px]">{alertComp.location_address || 'Nashik City'}</span>
                        <button
                          onClick={() => setDetailModalComplaint(alertComp)}
                          className="px-2 py-0.5 bg-red-600 text-white font-extrabold rounded hover:bg-red-700 transition-colors"
                        >
                          View Hazard
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2B. ELECTRICAL-SPECIFIC OPERATIONAL METRICS ROW */}
            {isElectricalDept && (
              <div className="p-4 bg-amber-50/60 border border-amber-300/70 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <Zap className="w-4 h-4 text-yellow-600 fill-yellow-500" />
                    <h3 className="text-xs font-extrabold font-outfit uppercase tracking-wider">
                      Electrical & Street Lighting Operational Breakdown
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-800 font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                    Code: ELE
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Broken Streetlights</span>
                    <span className="text-lg font-extrabold text-amber-900 font-mono block">{electricalMetrics.brokenStreetlights}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Lighting Outages</span>
                    <span className="text-lg font-extrabold text-amber-900 font-mono block">{electricalMetrics.streetlightOutages}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Pole Damage</span>
                    <span className="text-lg font-extrabold text-rose-800 font-mono block">{electricalMetrics.electricalPoleDamage}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Exposed Wiring</span>
                    <span className="text-lg font-extrabold text-red-700 font-mono block">{electricalMetrics.exposedWiring}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Electrical Hazards</span>
                    <span className="text-lg font-extrabold text-rose-900 font-mono block">{electricalMetrics.electricalHazards}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Lighting Maint.</span>
                    <span className="text-lg font-extrabold text-blue-800 font-mono block">{electricalMetrics.lightingMaintenance}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Pending Repairs</span>
                    <span className="text-lg font-extrabold text-amber-800 font-mono block">{electricalMetrics.pendingRepairs}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Completed Repairs</span>
                    <span className="text-lg font-extrabold text-emerald-800 font-mono block">{electricalMetrics.completedRepairs}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2C. SANITATION-SPECIFIC OPERATIONAL METRICS ROW */}
            {isSanitationDept && (
              <div className="p-4 bg-amber-50/50 border border-amber-200/70 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <Trash2 className="w-4 h-4 text-amber-700" />
                    <h3 className="text-xs font-extrabold font-outfit uppercase tracking-wider">
                      Sanitation & Waste Operational Breakdown
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-800 font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                    Code: SAN
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Garbage</span>
                    <span className="text-lg font-extrabold text-amber-900 font-mono block">{sanitationMetrics.garbageComplaints}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Overflow Dustbins</span>
                    <span className="text-lg font-extrabold text-amber-900 font-mono block">{sanitationMetrics.overflowingDustbins}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Waste Accum.</span>
                    <span className="text-lg font-extrabold text-amber-900 font-mono block">{sanitationMetrics.wasteAccumulation}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Public Dumping</span>
                    <span className="text-lg font-extrabold text-rose-800 font-mono block">{sanitationMetrics.publicDumping}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Collection Req.</span>
                    <span className="text-lg font-extrabold text-blue-800 font-mono block">{sanitationMetrics.collectionRequests}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Pending Cleanup</span>
                    <span className="text-lg font-extrabold text-amber-800 font-mono block">{sanitationMetrics.pendingCleanup}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Completed Cleanup</span>
                    <span className="text-lg font-extrabold text-emerald-800 font-mono block">{sanitationMetrics.completedCleanup}</span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Overdue Cleanup</span>
                    <span className="text-lg font-extrabold text-rose-900 font-mono block">{sanitationMetrics.overdueCleanup}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TOOLBAR FOR SEARCH & CATEGORY FILTERS */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isElectricalDept ? "Search electrical complaints by title, ID, location, or staff..." : "Search department complaints..."}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-600 min-h-[42px]"
                >
                  <option value="All">{isElectricalDept ? 'All Electrical Categories' : isSanitationDept ? 'All Sanitation Categories' : 'All Categories'}</option>
                  {isElectricalDept ? (
                    <>
                      <option value="Broken Streetlight">Broken Streetlight</option>
                      <option value="Streetlight Not Working">Streetlight Not Working</option>
                      <option value="Flickering Streetlight">Flickering Streetlight</option>
                      <option value="Streetlight Damage">Streetlight Damage</option>
                      <option value="Electrical Pole Damage">Electrical Pole Damage</option>
                      <option value="Exposed Wiring">Exposed Wiring</option>
                      <option value="Electrical Box Damage">Electrical Box Damage</option>
                      <option value="Public Electrical Hazard">Public Electrical Hazard</option>
                      <option value="Lighting Outage">Lighting Outage</option>
                      <option value="Streetlight Installation">Streetlight Installation</option>
                      <option value="Other Electrical Issue">Other Electrical Issue</option>
                    </>
                  ) : isSanitationDept ? (
                    <>
                      <option value="Garbage Overflow">Garbage Overflow</option>
                      <option value="Overflowing Dustbin">Overflowing Dustbin</option>
                      <option value="Waste Accumulation">Waste Accumulation</option>
                      <option value="Illegal/Public Dumping">Illegal/Public Dumping</option>
                      <option value="Garbage Collection">Garbage Collection</option>
                      <option value="Waste Segregation">Waste Segregation</option>
                      <option value="Public Sanitation">Public Sanitation</option>
                      <option value="Other Waste Issue">Other Waste Issue</option>
                    </>
                  ) : (
                    <>
                      <option value="Pothole Repair">Pothole Repair</option>
                      <option value="Road Maintenance">Road Maintenance</option>
                      <option value="Water Leakage">Water Leakage</option>
                      <option value="Drain Cleaning">Drain Cleaning</option>
                    </>
                  )}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-600 min-h-[42px]"
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
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-600 min-h-[42px]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Unassigned">Unassigned</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolution Submitted">Pending Review</option>
                  <option value="Resolved">Resolved</option>
                </select>

                {(searchQuery || categoryFilter !== 'All' || priorityFilter !== 'All' || statusFilter !== 'All') && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3.5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition-colors min-h-[42px]"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* 4. COMPLAINTS TABLE OR EMPTY STATE */}
            {filteredComplaints.length === 0 ? (
              <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl space-y-3">
                {isElectricalDept ? (
                  <Zap className="w-12 h-12 text-amber-500 mx-auto fill-amber-400" />
                ) : isSanitationDept ? (
                  <Trash2 className="w-12 h-12 text-amber-500 mx-auto" />
                ) : (
                  <Wrench className="w-12 h-12 text-emerald-600 mx-auto" />
                )}
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">
                  {isElectricalDept ? "No electrical complaints found." : isSanitationDept ? "No sanitation complaints found." : "No complaints found."}
                </h3>
                <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto">
                  {isElectricalDept ? "There are currently no active streetlight or electrical maintenance complaints matching your selected criteria." : isSanitationDept ? "There are currently no active waste or sanitation complaints matching your selected criteria." : "There are currently no complaints matching your selected criteria."}
                </p>
                <button
                  onClick={loadData}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  Refresh Database State
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                      <th className="p-3.5">Complaint ID</th>
                      <th className="p-3.5">Issue & Category</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5">Assigned SAN Staff</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredComplaints.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono text-emerald-800 font-bold">
                          {comp.complaint_number}
                        </td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-gray-900 block">{comp.title}</span>
                          <span className="text-[11px] text-gray-500 font-medium">{comp.category}</span>
                        </td>
                        <td className="p-3.5 text-gray-600 font-medium max-w-xs truncate">
                          {comp.location_address || 'Nashik City'}
                        </td>
                        <td className="p-3.5">
                          <PriorityBadge priority={comp.priority} />
                        </td>
                        <td className="p-3.5">
                          {comp.assigned_staff_name ? (
                            <span className="font-bold text-gray-800">{comp.assigned_staff_name}</span>
                          ) : (
                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <StatusBadge status={comp.status} />
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => setDetailModalComplaint(comp)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[11px]"
                          >
                            View
                          </button>
                          {!comp.assigned_staff_id && comp.status !== 'Resolved' && (
                            <button
                              onClick={() => {
                                setAssignModalComplaint(comp);
                                setSelectedStaffForAssign('');
                                setAssignError(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-2xs"
                            >
                              Assign Staff
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* CONFIRM MARK ALL READ MODAL */}
        {/* ================================================== */}
        {confirmMarkAllReadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-emerald-700 border-b border-gray-200 pb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Mark All as Read</h3>
              </div>

              <p className="text-gray-700 font-medium">Are you sure you want to mark all department notifications as read?</p>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setConfirmMarkAllReadModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteMarkAllRead}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* CHANGE PASSWORD MODAL */}
        {/* ================================================== */}
        {changePasswordModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Change Account Password</h3>
                </div>
                <button onClick={() => setChangePasswordModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">New Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters..."
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password..."
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setChangePasswordModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleExecuteChangePassword}
                  disabled={changingPassword}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px]"
                >
                  {changingPassword ? 'Updating...' : 'Update Password'}
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
                    Task Details & Inspection (TASK-{detailModalComplaint.id.slice(0, 6).toUpperCase()})
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
                      <img
                        src={getValidImageUrl(detailModalComplaint.photo_after_url)}
                        alt="After"
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                        onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                      />
                    ) : (
                      <div className="text-center p-4 space-y-1">
                        <Camera className="w-6 h-6 text-gray-400 mx-auto" />
                        <span className="text-xs font-bold text-gray-600 block">No progress evidence uploaded yet</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
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
