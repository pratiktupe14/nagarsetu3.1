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
  Square, ChevronLeft, ExternalLink, FileSpreadsheet, Info, Phone, Mail,
  UserPlus, ArrowLeft, CheckSquare2, AlertCircle, PlayCircle, UserX
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

  // In-Progress Specific Metric Cards (Real Supabase Data)
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
      // Status Filter
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;

      // Task Load Filter
      const activeCount = staffTaskCountsMap[s.id]?.active || 0;
      if (taskLoadFilter === 'Low' && activeCount > 1) return false;
      if (taskLoadFilter === 'Normal' && (activeCount < 2 || activeCount > 3)) return false;
      if (taskLoadFilter === 'High' && activeCount < 4) return false;

      // Search Query (Name, ID, Email, Phone)
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
      // Route specific filters
      if (isInProgress) {
        if (c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way') return false;
      } else if (isCompleted) {
        if (c.status !== 'Resolution Submitted' && c.status !== 'Resolved') return false;
      } else if (isOverdue) {
        if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline || new Date(c.sla_deadline) >= now) return false;
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

      // Priority Filter
      if (priorityFilter !== 'All' && c.priority !== priorityFilter) return false;

      // Category Filter
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;

      // Staff Filter
      if (staffFilter !== 'All') {
        if (staffFilter === 'Unassigned' && c.assigned_staff_id) return false;
        if (staffFilter !== 'Unassigned' && c.assigned_staff_id !== staffFilter && c.assigned_staff_name !== staffFilter) return false;
      }

      // SLA Status Filter
      if (slaFilter !== 'All') {
        if (!c.sla_deadline) return false;
        const isOver = new Date(c.sla_deadline) < now;
        const isToday = new Date(c.sla_deadline).toDateString() === now.toDateString();
        if (slaFilter === 'Overdue' && !isOver) return false;
        if (slaFilter === 'Due Today' && !isToday) return false;
        if (slaFilter === 'Within SLA' && isOver) return false;
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

      // Search Query (ID, Task ID, Title, Category, Location Address, Staff Name)
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
  }, [departmentComplaints, isInProgress, isCompleted, isOverdue, isAssignWorkspace, assignmentTab, isComplaints, statusFilter, priorityFilter, categoryFilter, staffFilter, slaFilter, dateFilter, searchQuery, now]);

  // Tasks belonging to the selected single staff member profile
  const staffProfileTasks = useMemo(() => {
    if (!staffIdFromPath) return [];
    return departmentComplaints.filter((c) => c.assigned_staff_id === staffIdFromPath);
  }, [departmentComplaints, staffIdFromPath]);

  // Reset page index when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, staffFilter, dateFilter, slaFilter, taskLoadFilter, assignmentTab]);

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
    setSlaFilter('All');
    setTaskLoadFilter('All');
  };

  // Export Real Department Complaints to CSV
  const handleExportCSV = (selectedOnly: boolean = false) => {
    const targetList = selectedOnly && selectedComplaints.length > 0
      ? departmentComplaints.filter((c) => selectedComplaints.includes(c.id))
      : filteredComplaints;

    if (targetList.length === 0) return;

    const headers = ['Task ID', 'Complaint Number', 'Title', 'Category', 'Location Address', 'Latitude', 'Longitude', 'Priority', 'Status', 'Assigned Staff', 'Started Date', 'SLA Due Date'];
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
      `"${new Date(c.updated_at || c.created_at).toLocaleDateString()}"`,
      `"${c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString() : 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${deptInfo.shortName.replace(/[^a-z0-9]/gi, '_')}_In_Progress_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm Task Assignment to Department Staff with Department Security Validation
  const handleExecuteAssignment = async (compObj: Complaint, staffObj: ServiceStaffMemberRecord) => {
    // SECURITY CHECK: Department Head department MUST match complaint department AND staff department
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
    <DashboardLayout title={isInProgress ? t('inProgress') : isStaffView ? t('staff') : isAssignWorkspace ? t('taskAssignment') : "Department Operations"}>
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
                  {isInProgress ? 'IN PROGRESS TASKS' : 'DEPARTMENT HEAD PORTAL'}
                </span>
                <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  ID: {headDeptId}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                {isInProgress ? 'Assigned work currently being executed by service staff.' : `Managed by ${headName} • Scope: ${deptInfo.description}`}
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
        
        {/* A. DEPARTMENT HEAD → IN PROGRESS PAGE (/department-head/tasks/in-progress) */}
        {isInProgress ? (
          <div className="space-y-6">

            {/* 5 IN-PROGRESS SUMMARY METRIC CARDS (REAL SUPABASE DATA) */}
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

            {/* PROFESSIONAL FILTER BAR */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Complaint ID, Task ID, Issue, Location, Staff Name..."
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
                    {departmentStaff.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>

                  {/* SLA Status Filter */}
                  <select
                    value={slaFilter}
                    onChange={(e) => setSlaFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                  >
                    <option value="All">All SLA Statuses</option>
                    <option value="Within SLA">Within SLA</option>
                    <option value="Due Today">Due Today</option>
                    <option value="Overdue">Overdue</option>
                  </select>

                  {/* Clear Filters Button */}
                  {(searchQuery || priorityFilter !== 'All' || categoryFilter !== 'All' || staffFilter !== 'All' || slaFilter !== 'All') && (
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

            {/* IN-PROGRESS TASKS TABLE (DESKTOP) & CARDS (MOBILE) */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-12 bg-white border border-rose-200 rounded-2xl text-center space-y-3 max-w-md mx-auto">
                <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">Unable to load in-progress tasks</h3>
                <p className="text-xs text-gray-600">Please check your connection and try again.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Try Again
                </button>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                <PlayCircle className="w-10 h-10 text-gray-400 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">No tasks are currently in progress</h3>
                <p className="text-xs text-gray-500">Your department has no active service tasks being executed at the moment.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Refresh Tasks
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
                        <th className="p-3.5">Started At</th>
                        <th className="p-3.5">Due Date</th>
                        <th className="p-3.5">SLA Status</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedComplaints.map((comp) => {
                        const slaInfo = formatSlaRemainingTime(comp.sla_deadline);
                        const taskIdStr = `TASK-${comp.id.slice(0, 6).toUpperCase()}`;

                        return (
                          <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
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
                                    <span className="text-[9px] text-gray-500 font-mono block">
                                      Active Tasks: {staffTaskCountsMap[comp.assigned_staff_id]?.active || 1}
                                    </span>
                                  </div>
                                </Link>
                              ) : (
                                <span className="text-amber-700 font-mono text-[11px] font-bold">Unassigned</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <PriorityBadge priority={comp.priority} />
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                              {new Date(comp.updated_at || comp.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                              {comp.sla_deadline ? new Date(comp.sla_deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </td>
                            <td className="p-3.5 font-mono text-[11px]">
                              {slaInfo.isOverdue ? (
                                <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 block w-fit">
                                  OVERDUE ({slaInfo.text})
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">{slaInfo.text}</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <StatusBadge status={comp.status} />
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
                    const slaInfo = formatSlaRemainingTime(comp.sla_deadline);
                    const taskIdStr = `TASK-${comp.id.slice(0, 6).toUpperCase()}`;

                    return (
                      <div key={comp.id} className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-gray-900">{taskIdStr} • <span className="text-emerald-700">{comp.complaint_number}</span></span>
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
                            <span>Staff: <strong>{comp.assigned_staff_name || 'Unassigned'}</strong></span>
                            <PriorityBadge priority={comp.priority} />
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs font-mono">
                          <span className="text-gray-600">SLA Remaining:</span>
                          <span className={slaInfo.isOverdue ? "text-rose-700 font-extrabold" : "text-emerald-700 font-bold"}>
                            {slaInfo.text}
                          </span>
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => setDetailModalComplaint(comp)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 font-bold rounded-lg text-xs"
                          >
                            View Task
                          </button>

                          <button
                            onClick={() => {
                              setReassignModalComplaint(comp);
                              setTargetReassignStaffId(departmentStaff[0]?.id || '');
                            }}
                            className="px-3.5 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 font-extrabold rounded-lg text-xs"
                          >
                            Reassign
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
                      <span className="font-extrabold text-gray-900">{filteredComplaints.length}</span> tasks
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
        ) : isStaffDetailView && selectedStaffProfile ? (
          /* B. STAFF PROFILE DETAIL VIEW (/department-head/staff/:staffId) */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link
                to="/department-head/staff"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold text-xs inline-flex items-center space-x-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Department Staff Roster</span>
              </Link>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-medium">Department Staff Detail Audit</span>
              </div>
            </div>

            {/* STAFF PROFILE CARD */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                    {selectedStaffProfile.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-extrabold text-gray-900 font-outfit">{selectedStaffProfile.name}</h2>
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {selectedStaffProfile.employee_id || `STF-${selectedStaffProfile.id.slice(0, 4).toUpperCase()}`}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium block mt-0.5">{selectedStaffProfile.role} • {selectedStaffProfile.department_name}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getWorkloadInfo(staffTaskCountsMap[selectedStaffProfile.id]?.active || 0).color}`}>
                    {getWorkloadInfo(staffTaskCountsMap[selectedStaffProfile.id]?.active || 0).label}
                  </span>

                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Status: {selectedStaffProfile.status || 'Available'}
                  </span>
                </div>
              </div>

              {/* CONTACT & WARD INFORMATION */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Email Address</span>
                  <div className="flex items-center space-x-1.5 text-gray-900 font-semibold truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedStaffProfile.email}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Contact Phone</span>
                  <div className="flex items-center space-x-1.5 text-gray-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{selectedStaffProfile.contact_number || '+91 98220 00000'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Assigned Ward Zone</span>
                  <span className="font-extrabold text-gray-900 block">{selectedStaffProfile.ward_area || 'Nashik Central'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1">
                  <span className="font-mono text-gray-500 text-[10px] block uppercase font-bold">Member Since</span>
                  <span className="font-extrabold text-gray-900 block">
                    {new Date(selectedStaffProfile.joined_date || selectedStaffProfile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* STAFF TASK STATS */}
              <div className="grid grid-cols-3 gap-4 border border-gray-200 rounded-xl divide-x divide-gray-200 bg-slate-50 p-4 text-center">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Active Tasks</span>
                  <span className="text-xl font-extrabold text-amber-700 font-mono block">
                    {staffTaskCountsMap[selectedStaffProfile.id]?.active || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Completed Tasks</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono block">
                    {staffTaskCountsMap[selectedStaffProfile.id]?.completed || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Overdue SLA Tasks</span>
                  <span className="text-xl font-extrabold text-rose-700 font-mono block">
                    {staffTaskCountsMap[selectedStaffProfile.id]?.overdue || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* STAFF ASSIGNED TASKS HISTORY TABLE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                  Assigned Task History ({staffProfileTasks.length})
                </h3>

                <button
                  onClick={() => navigate('/department-head/tasks/assign')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition-colors text-xs inline-flex items-center space-x-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Assign New Task to Staff</span>
                </button>
              </div>

              {staffProfileTasks.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                  <span className="font-bold text-gray-900 text-sm font-outfit block">No tasks assigned yet</span>
                  <span className="text-xs text-gray-500 block">No civic complaints have been assigned to {selectedStaffProfile.name}.</span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                        <th className="p-3.5">Complaint ID</th>
                        <th className="p-3.5">Title & Category</th>
                        <th className="p-3.5">Location</th>
                        <th className="p-3.5">Priority</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Assigned Date</th>
                        <th className="p-3.5">Due Date / SLA</th>
                        <th className="p-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {staffProfileTasks.map((comp) => {
                        const slaInfo = formatSlaRemainingTime(comp.sla_deadline);
                        return (
                          <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {comp.complaint_number}
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-gray-900 block">{comp.title}</span>
                              <span className="text-[10px] text-gray-500 font-mono">{comp.category}</span>
                            </td>
                            <td className="p-3.5 text-gray-700 max-w-xs truncate">
                              {comp.location_address || 'Nashik Service Area'}
                            </td>
                            <td className="p-3.5">
                              <PriorityBadge priority={comp.priority} />
                            </td>
                            <td className="p-3.5">
                              <StatusBadge status={comp.status} />
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-gray-600">
                              {new Date(comp.created_at).toLocaleDateString()}
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
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => setDetailModalComplaint(comp)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : isStaffView ? (
          /* C. DEPARTMENT HEAD → STAFF ROSTER PAGE (/department-head/staff) */
          <div className="space-y-6">

            {/* 8 STAFF SUMMARY CARDS (CALCULATED FROM REAL SUPABASE DATA) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Total Staff</span>
                <span className="text-xl font-extrabold text-gray-900 font-mono block">{staffMetrics.totalStaff}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Active Staff</span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono block">{staffMetrics.activeStaff}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Available</span>
                <span className="text-xl font-extrabold text-blue-700 font-mono block">{staffMetrics.availableStaff}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Busy / On Task</span>
                <span className="text-xl font-extrabold text-amber-700 font-mono block">{staffMetrics.busyStaff}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Offline / Leave</span>
                <span className="text-xl font-extrabold text-gray-600 font-mono block">{staffMetrics.offlineStaff}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Active Tasks</span>
                <span className="text-xl font-extrabold text-cyan-700 font-mono block">{staffMetrics.activeTasks}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Overdue Tasks</span>
                <span className="text-xl font-extrabold text-rose-700 font-mono block">{staffMetrics.overdueTasks}</span>
              </div>

              <div className="p-3.5 text-center space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Completed</span>
                <span className="text-xl font-extrabold text-emerald-800 font-mono block">{staffMetrics.completedTasks}</span>
              </div>
            </div>

            {/* SEARCH AND FILTERS BAR FOR STAFF */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff by Name, Staff ID, Email, Phone..."
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[40px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold min-h-[40px]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Busy">Busy / On Task</option>
                  <option value="Offline">Offline</option>
                  <option value="On Leave">On Leave</option>
                </select>

                {/* Task Load Filter */}
                <select
                  value={taskLoadFilter}
                  onChange={(e) => setTaskLoadFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold min-h-[40px]"
                >
                  <option value="All">All Task Loads</option>
                  <option value="Low">Low Workload (0-1 Tasks)</option>
                  <option value="Normal">Normal Workload (2-3 Tasks)</option>
                  <option value="High">High Workload (4+ Tasks)</option>
                </select>

                {(searchQuery || statusFilter !== 'All' || taskLoadFilter !== 'All') && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3.5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition-colors min-h-[40px]"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* STAFF ROSTER TABLE (DESKTOP) & CARDS (MOBILE) */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredStaffList.length === 0 ? (
              <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                <Users className="w-10 h-10 text-gray-400 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">No service staff found for your department</h3>
                <p className="text-xs text-gray-500">There are no active service staff members registered under {deptInfo.fullName} matching your query.</p>
                <button
                  onClick={loadData}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-xs"
                >
                  Refresh Staff
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* DESKTOP TABLE */}
                <div className="hidden md:block border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                        <th className="p-3.5">Staff ID</th>
                        <th className="p-3.5">Staff Member</th>
                        <th className="p-3.5">Email & Phone</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Active Tasks</th>
                        <th className="p-3.5">Workload Indicator</th>
                        <th className="p-3.5">Completed</th>
                        <th className="p-3.5">Overdue</th>
                        <th className="p-3.5">Current Assignment</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStaffList.map((staff) => {
                        const counts = staffTaskCountsMap[staff.id] || { active: 0, overdue: 0, completed: 0, currentTask: null };
                        const workload = getWorkloadInfo(counts.active);

                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                              <Link to={`/department-head/staff/${staff.id}`} className="hover:underline">
                                {staff.employee_id || `STF-${staff.id.slice(0, 4).toUpperCase()}`}
                              </Link>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center font-outfit text-xs border border-emerald-300 shrink-0">
                                  {staff.name.charAt(0)}
                                </div>
                                <div>
                                  <Link to={`/department-head/staff/${staff.id}`} className="font-bold text-gray-900 hover:underline block">
                                    {staff.name}
                                  </Link>
                                  <span className="text-[10px] text-gray-500 font-mono block">{staff.role || 'Service Staff'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 text-gray-600 font-mono">
                              <span className="block text-gray-900 font-semibold">{staff.email}</span>
                              <span className="text-[10px] text-gray-500">{staff.contact_number || '+91 98220 00000'}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                <span>{staff.status || 'Available'}</span>
                              </span>
                            </td>
                            <td className="p-3.5 font-mono font-extrabold text-amber-700">
                              {counts.active} Active
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${workload.color}`}>
                                {workload.label}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-emerald-700 font-bold">
                              {counts.completed} Done
                            </td>
                            <td className="p-3.5 font-mono text-rose-700 font-bold">
                              {counts.overdue}
                            </td>
                            <td className="p-3.5 text-gray-700 max-w-xs truncate font-medium">
                              {counts.currentTask || 'None (Ready)'}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <Link
                                  to={`/department-head/staff/${staff.id}`}
                                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
                                >
                                  View Profile
                                </Link>

                                <button
                                  onClick={() => {
                                    navigate('/department-head/tasks/assign');
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] transition-colors inline-flex items-center space-x-1"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>Assign Task</span>
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
                  {filteredStaffList.map((staff) => {
                    const counts = staffTaskCountsMap[staff.id] || { active: 0, overdue: 0, completed: 0, currentTask: null };
                    const workload = getWorkloadInfo(counts.active);

                    return (
                      <div key={staff.id} className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center font-outfit text-sm border border-emerald-300 shrink-0">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{staff.name}</h4>
                              <span className="font-mono text-xs text-emerald-700 font-bold">{staff.employee_id || 'STF-001'}</span>
                            </div>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${workload.color}`}>
                            {workload.label}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-mono">Department:</span>
                            <span className="font-bold text-gray-900">{deptInfo.shortName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-mono">Current Task:</span>
                            <span className="font-semibold text-gray-800 truncate max-w-[180px]">{counts.currentTask || 'None'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs p-2 bg-slate-100 rounded-xl font-mono">
                          <div>
                            <span className="text-[9px] text-gray-500 block">ACTIVE</span>
                            <span className="font-bold text-amber-700">{counts.active}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 block">DONE</span>
                            <span className="font-bold text-emerald-700">{counts.completed}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 block">OVERDUE</span>
                            <span className="font-bold text-rose-700">{counts.overdue}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                          <Link
                            to={`/department-head/staff/${staff.id}`}
                            className="px-3 py-1.5 bg-gray-100 text-gray-800 font-bold rounded-lg text-xs"
                          >
                            View Profile
                          </Link>

                          <button
                            onClick={() => navigate('/department-head/tasks/assign')}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white font-extrabold rounded-lg text-xs"
                          >
                            Assign Task
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </div>
        ) : isAssignWorkspace ? (
          /* D. DEPARTMENT HEAD → TASK ASSIGNMENT WORKSPACE (/department-head/tasks/assign) */
          <div className="space-y-6">

            {/* TASK ASSIGNMENT HEADER BANNER */}
            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                  Task Assignment Workspace
                </h2>
                <p className="text-gray-600 font-medium mt-0.5">
                  Select an unassigned complaint from the left panel and pair it with an available service staff member on the right.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0 font-mono">
                <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase font-bold">Unassigned</span>
                  <span className="font-extrabold text-amber-700 text-sm block">{complaintMetrics.unassigned} Complaints</span>
                </div>

                <div className="bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                  <span className="text-gray-500 block text-[9px] uppercase font-bold">Available Staff</span>
                  <span className="font-extrabold text-emerald-700 text-sm block">{staffMetrics.availableStaff} Members</span>
                </div>
              </div>
            </div>

            {/* TASK QUEUE TABS */}
            <div className="flex items-center space-x-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs font-bold font-outfit">
              {(['Unassigned', 'Assigned', 'In Progress', 'Pending Review', 'Completed', 'Overdue'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAssignmentTab(tab)}
                  className={`px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
                    assignmentTab === tab
                      ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                      : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TWO-PANEL WORKSPACE LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* LEFT PANEL: UNASSIGNED COMPLAINTS LIST (COL 7) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-extrabold text-gray-900 font-outfit text-sm uppercase tracking-wider">
                      {assignmentTab} Complaints ({filteredComplaints.length})
                    </h3>
                  </div>

                  <span className="text-[11px] text-gray-500 font-medium">Scope: {deptInfo.shortName}</span>
                </div>

                {/* SEARCH & FILTERS FOR COMPLAINTS */}
                <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
                  <div className="relative flex-1 w-full">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ID, Title, Location..."
                      className="w-full bg-slate-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-slate-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 font-semibold w-full sm:w-auto"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* UNASSIGNED COMPLAINT CARDS */}
                {filteredComplaints.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <span className="font-bold text-gray-900 text-sm font-outfit block">No {assignmentTab.toLowerCase()} complaints</span>
                    <span className="text-xs text-gray-500 block">No civic issues currently found under {assignmentTab} tab for {deptInfo.shortName}.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {filteredComplaints.map((comp) => {
                      const isSelected = selectedAssignComplaint?.id === comp.id;
                      const slaInfo = formatSlaRemainingTime(comp.sla_deadline);

                      return (
                        <div
                          key={comp.id}
                          onClick={() => setSelectedAssignComplaint(comp)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                            isSelected
                              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-emerald-700 text-xs">{comp.complaint_number}</span>
                            <div className="flex items-center space-x-2">
                              <PriorityBadge priority={comp.priority} />
                              <StatusBadge status={comp.status} />
                            </div>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</h4>
                            <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{comp.description || 'No detailed description provided.'}</p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                            <div className="flex items-center space-x-1 text-gray-700 truncate max-w-[240px]">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{comp.location_address || 'Nashik Service Area'}</span>
                            </div>

                            <span className="font-mono font-semibold text-gray-700">{slaInfo.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT PANEL: AVAILABLE SERVICE STAFF ROSTER (COL 5) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-extrabold text-gray-900 font-outfit text-sm uppercase tracking-wider">
                      Available Service Staff ({departmentStaff.length})
                    </h3>
                  </div>

                  <span className="text-[11px] text-gray-500 font-medium">Department Verified</span>
                </div>

                {/* STAFF SEARCH */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search staff member name..."
                    className="w-full bg-slate-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* STAFF SELECTION CARDS */}
                {departmentStaff.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-2">
                    <Users className="w-8 h-8 text-gray-400 mx-auto" />
                    <span className="font-bold text-gray-900 text-sm font-outfit block">No staff members found</span>
                    <span className="text-xs text-gray-500 block">No service staff registered under {deptInfo.fullName}.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {departmentStaff.map((staff) => {
                      const counts = staffTaskCountsMap[staff.id] || { active: 0, overdue: 0, completed: 0, currentTask: null };
                      const workload = getWorkloadInfo(counts.active);
                      const isSelectedStaff = selectedAssignStaff?.id === staff.id;

                      return (
                        <div
                          key={staff.id}
                          onClick={() => setSelectedAssignStaff(staff)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                            isSelectedStaff
                              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center font-outfit text-xs border border-emerald-300 shrink-0">
                                {staff.name.charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-extrabold text-gray-900 text-xs font-outfit">{staff.name}</h4>
                                <span className="font-mono text-[10px] text-emerald-700 font-bold block">{staff.employee_id || 'STF-001'}</span>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${workload.color}`}>
                              {workload.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-gray-600 pt-1 border-t border-gray-100">
                            <span className="font-mono text-gray-500">Active Tasks: <strong className="text-amber-700">{counts.active}</strong></span>
                            <span className="font-mono text-gray-500">Completed: <strong className="text-emerald-700">{counts.completed}</strong></span>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAssignStaff(staff);
                                if (selectedAssignComplaint) {
                                  handleExecuteAssignment(selectedAssignComplaint, staff);
                                } else {
                                  alert('Please select an unassigned complaint from the left panel first.');
                                }
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg transition-colors"
                            >
                              Assign Work
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* CONFIRMATION WORKSPACE BOTTOM PANEL */}
            {selectedAssignComplaint && selectedAssignStaff && (
              <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <CheckSquare2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-extrabold font-outfit text-base">Ready for Task Assignment Confirmation</h3>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAssignComplaint(null);
                      setSelectedAssignStaff(null);
                    }}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-800/80 rounded-xl space-y-1 border border-slate-700">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Selected Civic Complaint</span>
                    <span className="font-mono font-bold text-white block">{selectedAssignComplaint.complaint_number}</span>
                    <h4 className="font-bold text-gray-100">{selectedAssignComplaint.title}</h4>
                    <p className="text-gray-400 text-[11px]">{selectedAssignComplaint.location_address}</p>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-xl space-y-1 border border-slate-700">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Assigned Service Staff Member</span>
                    <h4 className="font-bold text-white text-sm">{selectedAssignStaff.name}</h4>
                    <span className="text-gray-300 font-mono block">{selectedAssignStaff.employee_id || 'STF-001'} — {selectedAssignStaff.department_name}</span>
                    <span className="text-gray-400 text-[11px] block">Current Workload: {getWorkloadInfo(staffTaskCountsMap[selectedAssignStaff.id]?.active || 0).label}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setSelectedAssignComplaint(null);
                      setSelectedAssignStaff(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold text-xs"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleExecuteAssignment(selectedAssignComplaint, selectedAssignStaff)}
                    disabled={assigning}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 inline-flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{assigning ? 'Executing Assignment...' : 'Confirm Real Supabase Task Assignment'}</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* E. DEFAULT COMPLAINTS / GENERAL OPERATIONS TABLE VIEW */
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
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Unassigned">Unassigned</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Staff Assigned">Staff Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolution Submitted">Pending Review</option>
                    <option value="Resolved">Resolved</option>
                  </select>

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

                  {(searchQuery || statusFilter !== 'All' || priorityFilter !== 'All') && (
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

            {/* COMPLAINTS TABLE */}
            {filteredComplaints.length === 0 ? (
              <div className="p-12 bg-slate-50 border border-gray-200 rounded-2xl text-center space-y-3">
                <FileText className="w-10 h-10 text-gray-400 mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">No complaints found</h3>
                <p className="text-xs text-gray-500">There are currently no complaints assigned to your department matching your criteria.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                      <th className="p-3.5">Complaint ID</th>
                      <th className="p-3.5">Title & Category</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Assigned Staff</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredComplaints.map((comp) => {
                      const isUnassigned = !comp.assigned_staff_id;
                      const isPendingReview = comp.status === 'Resolution Submitted';

                      return (
                        <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
                            <button onClick={() => setDetailModalComplaint(comp)} className="hover:underline text-left">
                              {comp.complaint_number}
                            </button>
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
                              <span className="inline-flex items-center space-x-1 text-emerald-900 font-bold">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{comp.assigned_staff_name}</span>
                              </span>
                            ) : (
                              <span className="text-amber-700 font-mono text-[11px] font-bold">Unassigned</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => setDetailModalComplaint(comp)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] transition-colors"
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
            )}
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
                        {s.name} ({s.employee_id || 'STF-001'}) — Status: {s.status || 'Available'}
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
                  onClick={handleConfirmModalAssignment}
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
        {/* COMPLAINT / TASK DETAIL MODAL */}
        {/* ================================================== */}
        {detailModalComplaint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 border border-gray-200 shadow-xl my-8 font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">
                    Task Details & Field Audit (TASK-{detailModalComplaint.id.slice(0, 6).toUpperCase()})
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

              {/* CITIZEN PHOTO VS REPAIR PROOF / EVIDENCE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-gray-500 block">Citizen Issue Photo</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={detailModalComplaint.photo_before_url} alt="Before" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold font-mono uppercase text-emerald-700 block">Staff Repair Proof Evidence</span>
                  <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-emerald-300 bg-emerald-50 flex items-center justify-center">
                    {detailModalComplaint.photo_after_url ? (
                      <img src={detailModalComplaint.photo_after_url} alt="After" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4 space-y-1">
                        <Camera className="w-6 h-6 text-gray-400 mx-auto" />
                        <span className="text-xs font-bold text-gray-600 block">Not submitted yet</span>
                        <span className="text-[10px] text-gray-400 block font-mono">Field staff is currently executing work</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TASK PROGRESS TIMELINE STEPS */}
              <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-mono text-gray-500 uppercase font-extrabold block">Task Workflow Progression</span>
                <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-mono font-extrabold">
                  <div className="p-2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">ASSIGNED</div>
                  <div className="p-2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">ACCEPTED</div>
                  <div className="p-2 rounded bg-amber-500 text-white shadow-xs">IN PROGRESS</div>
                  <div className="p-2 rounded bg-gray-200 text-gray-500">COMPLETED</div>
                  <div className="p-2 rounded bg-gray-200 text-gray-500">REVIEW</div>
                  <div className="p-2 rounded bg-gray-200 text-gray-500">RESOLVED</div>
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
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">Work Started At</span>
                  <span className="font-mono text-gray-900">{new Date(detailModalComplaint.updated_at || detailModalComplaint.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-500 uppercase block font-bold">SLA Due Deadline</span>
                  <span className="font-mono text-rose-700 font-bold">{detailModalComplaint.sla_deadline ? new Date(detailModalComplaint.sla_deadline).toLocaleString() : 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
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
