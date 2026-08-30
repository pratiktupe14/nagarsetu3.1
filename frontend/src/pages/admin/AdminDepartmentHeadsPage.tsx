import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  getDepartmentHeads,
  createDepartmentHead,
  updateDepartmentHead,
  deactivateDepartmentHead,
  reactivateDepartmentHead,
  deleteDepartmentHead,
  matchComplaintToDepartment,
  DepartmentLeadershipSummary
} from '../../services/departmentService';
import { getDepartmentServiceStaff } from '../../services/adminService';
import { getStoredComplaints } from '../../services/complaintService';
import { pushNotification } from '../../services/notificationService';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Search, Plus, RefreshCw, Building2, Users, FileText, CheckCircle2,
  AlertTriangle, ChevronLeft, ChevronRight, X, Phone, Mail,
  Edit, Eye, Layers, Activity, Check, Clock, UserCheck, ShieldCheck,
  UserPlus, RotateCcw, AlertCircle, ShieldAlert, Sparkles, Sliders,
  UserX, ArrowRight, Info, Shield, CheckCircle, Trash2, Filter
} from 'lucide-react';


const SEVEN_DEPARTMENTS_META = [
  { id: 'dept-pwd', code: 'PWD', name: 'Public Works Department', scope: 'Potholes, road damage, public infrastructure' },
  { id: 'dept-san', code: 'SAN', name: 'Sanitation & Waste Management', scope: 'Garbage, overflowing dustbins, waste' },
  { id: 'dept-wtr', code: 'WTR', name: 'Water Supply & Sewerage Board', scope: 'Water leakage, pipelines, water supply' },
  { id: 'dept-drn', code: 'DRN', name: 'Drainage & Sewage Department', scope: 'Drainage blockage, sewage overflow, open drains' },
  { id: 'dept-ele', code: 'ELE', name: 'Electrical & Street Lighting', scope: 'Streetlights, electrical civic issues' },
  { id: 'dept-trf', code: 'TRF', name: 'Traffic Management Department', scope: 'Traffic signals, traffic infrastructure, road safety' },
  { id: 'dept-mnt', code: 'MNT', name: 'Maintenance Department', scope: 'Building maintenance, civic asset upkeep, general maintenance' }
];



export const AdminDepartmentHeadsPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [headSummaries, setHeadSummaries] = useState<DepartmentLeadershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showAddHeadModal, setShowAddHeadModal] = useState(false);
  const [showChangeHeadModal, setShowChangeHeadModal] = useState<DepartmentLeadershipSummary | null>(null);
  const [viewHeadProfileModal, setViewHeadProfileModal] = useState<DepartmentLeadershipSummary | null>(null);
  const [deactivateModalHead, setDeactivateModalHead] = useState<DepartmentLeadershipSummary | null>(null);
  const [editHeadModal, setEditHeadModal] = useState<DepartmentLeadershipSummary | null>(null);
  const [deleteModalHead, setDeleteModalHead] = useState<DepartmentLeadershipSummary | null>(null);
  const [deletingHead, setDeletingHead] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sub-modals for Profile Summary -> Details Click-To-View Experience
  const [viewDeptStaffModal, setViewDeptStaffModal] = useState<{
    deptName: string;
    deptCode: string;
    headName: string;
    deptId?: string;
    staffFilter: 'All' | 'Active' | 'Inactive';
    staffList: any[];
    loading?: boolean;
    error?: string | null;
  } | null>(null);

  const [viewStaffDetailsModal, setViewStaffDetailsModal] = useState<any | null>(null);

  const [viewDeptComplaintsModal, setViewDeptComplaintsModal] = useState<{
    title: string;
    deptId?: string;
    deptName: string;
    deptCode?: string;
    headName?: string;
    complaints: any[];
    loading?: boolean;
    error?: string | null;
  } | null>(null);

  const [viewComplaintDetailModal, setViewComplaintDetailModal] = useState<any | null>(null);

  const [complaintFilters, setComplaintFilters] = useState<{
    search: string;
    status: string;
    priority: string;
    category: string;
    staff: string;
    datePreset: 'All' | 'Today' | '7Days' | '30Days' | 'Custom';
    fromDate: string;
    toDate: string;
  }>({
    search: '',
    status: 'All',
    priority: 'All',
    category: 'All',
    staff: 'All',
    datePreset: 'All',
    fromDate: '',
    toDate: ''
  });

  const handleClearComplaintFilters = () => {
    setComplaintFilters({
      search: '',
      status: 'All',
      priority: 'All',
      category: 'All',
      staff: 'All',
      datePreset: 'All',
      fromDate: '',
      toDate: ''
    });
  };

  const availableCategories = useMemo(() => {
    if (!viewDeptComplaintsModal?.complaints) return [];
    const set = new Set<string>();
    viewDeptComplaintsModal.complaints.forEach((c: any) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [viewDeptComplaintsModal?.complaints]);

  const availableStaffOptions = useMemo(() => {
    const staffNames = new Set<string>();
    if (viewHeadProfileModal?.assignedStaff) {
      viewHeadProfileModal.assignedStaff.forEach((s: any) => {
        const name = s.name || s.full_name;
        if (name) staffNames.add(name);
      });
    }
    if (viewDeptComplaintsModal?.complaints) {
      viewDeptComplaintsModal.complaints.forEach((c: any) => {
        if (c.assigned_staff_name) staffNames.add(c.assigned_staff_name);
      });
    }
    return Array.from(staffNames).sort();
  }, [viewHeadProfileModal?.assignedStaff, viewDeptComplaintsModal?.complaints]);

  const filteredDeptComplaints = useMemo(() => {
    if (!viewDeptComplaintsModal?.complaints) return [];

    return viewDeptComplaintsModal.complaints.filter((c: any) => {
      // 1. Search Query (ID, title, category, location, assigned staff)
      if (complaintFilters.search.trim()) {
        const q = complaintFilters.search.trim().toLowerCase();
        const matchId = String(c.id || '').toLowerCase().includes(q) || String(c.complaint_number || '').toLowerCase().includes(q);
        const matchTitle = String(c.title || '').toLowerCase().includes(q);
        const matchCat = String(c.category || '').toLowerCase().includes(q);
        const matchLoc = String(c.location_address || c.location_text || c.ward_name || '').toLowerCase().includes(q);
        const matchStaff = String(c.assigned_staff_name || c.assigned_staff_id || '').toLowerCase().includes(q);

        if (!matchId && !matchTitle && !matchCat && !matchLoc && !matchStaff) {
          return false;
        }
      }

      // 2. Status Filter
      if (complaintFilters.status !== 'All') {
        const cStatus = String(c.status || '').toLowerCase();
        const fStatus = complaintFilters.status.toLowerCase();
        if (cStatus !== fStatus) return false;
      }

      // 3. Priority Filter
      if (complaintFilters.priority !== 'All') {
        const cPriority = String(c.priority || '').toLowerCase();
        const fPriority = complaintFilters.priority.toLowerCase();
        if (cPriority !== fPriority) return false;
      }

      // 4. Category Filter
      if (complaintFilters.category !== 'All') {
        if (String(c.category || '') !== complaintFilters.category) return false;
      }

      // 5. Staff Filter
      if (complaintFilters.staff !== 'All') {
        const cStaff = String(c.assigned_staff_name || c.assigned_staff_id || '');
        if (cStaff !== complaintFilters.staff && !cStaff.includes(complaintFilters.staff)) return false;
      }

      // 6. Date Range Filter
      if (c.created_at) {
        const compDate = new Date(c.created_at);

        if (complaintFilters.datePreset === 'Today') {
          const today = new Date();
          if (compDate.toDateString() !== today.toDateString()) return false;
        } else if (complaintFilters.datePreset === '7Days') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          if (compDate < cutoff) return false;
        } else if (complaintFilters.datePreset === '30Days') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          if (compDate < cutoff) return false;
        } else if (complaintFilters.datePreset === 'Custom') {
          if (complaintFilters.fromDate) {
            const from = new Date(complaintFilters.fromDate);
            if (compDate < from) return false;
          }
          if (complaintFilters.toDate) {
            const to = new Date(complaintFilters.toDate);
            to.setHours(23, 59, 59, 999);
            if (compDate > to) return false;
          }
        }
      }

      return true;
    });
  }, [viewDeptComplaintsModal?.complaints, complaintFilters]);

  // Execute Delete Department Head
  const handleExecuteDeleteHead = async () => {
    if (!deleteModalHead) return;
    setDeletingHead(true);
    setDeleteError(null);
    try {
      const targetId = deleteModalHead.headId || deleteModalHead.deptId;
      await deleteDepartmentHead(targetId, user?.id);

      setToastMessage(`Department Head '${deleteModalHead.headName}' removed successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      setDeleteModalHead(null);
      await loadData();
    } catch (e: any) {
      console.error('Error removing department head:', e);
      setDeleteError(e.message || 'Unable to remove Department Head. Please try again.');
    } finally {
      setDeletingHead(false);
    }
  };


  // Form State for Add / Edit Department Head
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDesignation, setFormDesignation] = useState('Department Head');
  const [formDeptId, setFormDeptId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Real Data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await getDepartmentHeads();
      setHeadSummaries(summaries);
    } catch (e: any) {
      console.error('Error fetching department head summaries:', e);
      setError(e.message || 'Unable to load real department head data from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetryFetchStaff = async (deptId?: string, deptName?: string) => {
    if (!viewDeptStaffModal) return;
    setViewDeptStaffModal((prev) => (prev ? { ...prev, loading: true, error: null } : null));
    try {
      const freshStaff = await getDepartmentServiceStaff(deptId, deptName);
      setViewDeptStaffModal((prev) => (prev ? { ...prev, staffList: freshStaff, loading: false, error: null } : null));
    } catch (err: any) {
      setViewDeptStaffModal((prev) => (prev ? { ...prev, loading: false, error: err.message || 'Unable to load department staff.' } : null));
    }
  };

  const handleRetryFetchComplaints = async (deptId?: string, deptCode?: string, deptName?: string) => {
    if (!viewDeptComplaintsModal) return;
    setViewDeptComplaintsModal((prev) => (prev ? { ...prev, loading: true, error: null } : null));
    try {
      const allComplaints = await getStoredComplaints();
      const targetQuery = deptId || deptCode || deptName || '';
      const filtered = allComplaints.filter((c) => matchComplaintToDepartment(c, targetQuery, undefined, deptName));
      setViewDeptComplaintsModal((prev) => (prev ? { ...prev, complaints: filtered, loading: false, error: null } : null));
    } catch (err: any) {
      console.error('Failed to fetch department complaints:', err);
      setViewDeptComplaintsModal((prev) => (prev ? { ...prev, loading: false, error: err.message || 'Unable to load department complaints.' } : null));
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to Realtime Updates
  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('realtime_department_heads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_heads' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Filtered rows for Search & Toolbar
  const filteredHeadRows = useMemo(() => {
    return headSummaries.filter((r) => {
      if (deptFilter !== 'All' && r.deptCode !== deptFilter && r.deptId !== deptFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const deptMatch = r.deptName.toLowerCase().includes(q) || r.deptCode.toLowerCase().includes(q);
        const headMatch = r.headName.toLowerCase().includes(q) || r.headEmail.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q);
        if (!deptMatch && !headMatch) return false;
      }

      return true;
    });
  }, [headSummaries, deptFilter, statusFilter, searchQuery]);

  // Check department head conflict when selecting department in Add Modal
  const handleDepartmentSelectionChange = (dCodeOrId: string) => {
    setFormDeptId(dCodeOrId);
    const existingRow = headSummaries.find((r) => r.deptCode === dCodeOrId || r.deptId === dCodeOrId);
    if (existingRow && existingRow.headName && existingRow.status === 'Active') {
      setConflictWarning(`Department '${existingRow.deptName}' currently has active Head: '${existingRow.headName}'. Adding a new head will deactivate the previous head and transfer operational leadership.`);
    } else {
      setConflictWarning(null);
    }
  };

  // Execute Add / Replace Department Head
  const handleSaveDepartmentHead = async () => {
    setValidationError(null);

    if (!formFullName.trim()) {
      setValidationError('Please enter Full Name.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setValidationError('Please enter a valid Official Email address.');
      return;
    }
    if (!formEmployeeId.trim()) {
      setValidationError('Please enter Employee ID.');
      return;
    }
    if (!formDeptId) {
      setValidationError('Please select a Municipal Department.');
      return;
    }
    if (!formPassword || formPassword.length < 8) {
      setValidationError('Password does not meet requirements. Password must be at least 8 characters long.');
      return;
    }
    if (formPassword !== formConfirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedTarget = headSummaries.find((h) => 
        h.deptCode === formDeptId || 
        h.deptId === formDeptId ||
        (h.deptCode && h.deptCode.toLowerCase() === formDeptId.toLowerCase()) ||
        (h.deptId && h.deptId.toLowerCase() === formDeptId.toLowerCase()) ||
        (h.deptName && h.deptName.toLowerCase().includes(formDeptId.toLowerCase()))
      ) || SEVEN_DEPARTMENTS_META.find((d) => d.code === formDeptId || d.id === formDeptId);

      const deptIdToUse = selectedTarget ? ('deptId' in selectedTarget ? selectedTarget.deptId : selectedTarget.id) : formDeptId;
      const deptName = selectedTarget ? ('deptName' in selectedTarget ? selectedTarget.deptName : selectedTarget.name) : 'Department';

      await createDepartmentHead({
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim() || '+91 98220 00000',
        employeeId: formEmployeeId.trim(),
        departmentId: deptIdToUse,
        designation: formDesignation.trim() || 'Department Head',
        password: formPassword,
        performedByUserId: user?.id
      });

      pushNotification({
        user_id: 'admin-group',
        role: 'city_admin',
        type: 'approved',
        title: `DEPARTMENT HEAD APPOINTED: ${deptName}`,
        message: `City Administration appointed ${formFullName.trim()} as active Department Head.`
      });

      setShowAddHeadModal(false);
      setShowChangeHeadModal(null);
      setFormFullName('');
      setFormEmail('');
      setFormPhone('');
      setFormEmployeeId('');
      setFormDeptId('');
      setFormPassword('');
      setFormConfirmPassword('');
      setValidationError(null);
      setConflictWarning(null);

      setToastMessage(`Department Head for ${deptName} updated successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || 'Error saving Department Head to Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Deactivate Department Head
  const handleExecuteDeactivate = async () => {
    if (!deactivateModalHead || !deactivateModalHead.headId) return;

    setSubmitting(true);
    try {
      await deactivateDepartmentHead(deactivateModalHead.headId, user?.id);

      setToastMessage(`Department Head '${deactivateModalHead.headName}' deactivated successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      setDeactivateModalHead(null);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to deactivate Department Head.');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Reactivate Department Head
  const handleExecuteReactivate = async (head: DepartmentLeadershipSummary) => {
    if (!head || !head.headId) return;

    setSubmitting(true);
    try {
      await reactivateDepartmentHead(head.headId, user?.id);

      setToastMessage(`Department Head '${head.headName}' reactivated successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to reactivate Department Head.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Profile Modal
  const openEditModal = (row: DepartmentLeadershipSummary) => {
    setEditHeadModal(row);
    setFormFullName(row.headName || '');
    setFormEmail(row.headEmail || '');
    setFormPhone(row.headPhone || '');
    setFormEmployeeId(row.employeeId || '');
    setFormDesignation(row.designation || 'Department Head');
    setFormDeptId(row.deptId || row.deptCode);
    setFormPassword('');
    setFormConfirmPassword('');
    setValidationError(null);
  };

  // Execute Update Department Head
  const handleUpdateDepartmentHead = async () => {
    if (!editHeadModal || !editHeadModal.headId) return;
    setValidationError(null);

    if (!formFullName.trim()) {
      setValidationError('Please enter Full Name.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setValidationError('Please enter a valid Official Email address.');
      return;
    }

    setSubmitting(true);
    try {
      await updateDepartmentHead(editHeadModal.headId, {
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        employeeId: formEmployeeId.trim(),
        departmentId: formDeptId,
        designation: formDesignation.trim(),
        password: formPassword.trim() || undefined,
        performedByUserId: user?.id
      });

      setToastMessage(`Department Head profile updated successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      setEditHeadModal(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || 'Error updating Department Head.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title={t('departmentHeads') || "Department Heads Management"}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* HEADER BAR */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                Department Heads Management
              </h1>
              <span className="font-mono text-[10px] font-extrabold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase">
                SUPABASE CONNECTED
              </span>
            </div>
            <p className="text-xs text-gray-600 font-medium mt-1">
              City Administration oversight for Nashik's 6 municipal departments. Assign leadership, monitor staff workloads, and review operational tasks.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => {
                setShowAddHeadModal(true);
                handleDepartmentSelectionChange(SEVEN_DEPARTMENTS_META[0].code);
                setFormFullName('');
                setFormEmail('');
                setFormPhone('');
                setFormEmployeeId(`EMP-${SEVEN_DEPARTMENTS_META[0].code}-001`);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 min-h-[42px]"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Department Head</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[42px]"
              title="Refresh Data from Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 font-bold text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 font-bold text-xs flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SEARCH & FILTERS TOOLBAR */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search department name, head name, official email, employee ID..."
              className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
            >
              <option value="All">All 7 Departments</option>

              {SEVEN_DEPARTMENTS_META.map((d) => (
                <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* DEPARTMENT HEADS TABLE (REAL SUPABASE DATA) */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Department Head</th>
                  <th className="p-3.5">Contact Email</th>
                  <th className="p-3.5 text-center">Staff Count</th>
                  <th className="p-3.5 text-center">Active Tasks</th>
                  <th className="p-3.5 text-center">Open Complaints</th>
                  <th className="p-3.5 text-center">Overdue Tasks</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-500 font-bold">
                      <div className="flex items-center justify-center space-x-2 font-mono text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Loading live department leadership data from Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHeadRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-500 font-bold">
                      No department heads found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHeadRows.map((row) => (
                    <tr key={row.deptCode} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* DEPARTMENT NAME */}
                      <td className="p-3.5 font-bold text-gray-900 font-outfit">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="block text-sm">{row.deptName}</span>
                            <span className="font-mono text-[10px] text-gray-500 font-semibold">{row.deptCode}</span>
                          </div>
                        </div>
                      </td>

                      {/* HEAD NAME */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center font-outfit shrink-0 border border-emerald-300">
                            {row.headName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-gray-900 text-xs block font-outfit">{row.headName}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{row.employeeId}</span>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL */}
                      <td className="p-3.5 font-mono text-gray-700 text-[11px]">
                        <div>
                          <span className="block font-semibold">{row.headEmail}</span>
                          <span className="text-gray-500 text-[10px]">{row.headPhone}</span>
                        </div>
                      </td>

                      {/* STAFF COUNT */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-gray-900">
                        {row.staffCount}
                      </td>

                      {/* ACTIVE TASKS */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-amber-700">
                        {row.activeTasks}
                      </td>

                      {/* OPEN COMPLAINTS */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-blue-700">
                        {row.openComplaints}
                      </td>

                      {/* OVERDUE TASKS */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-rose-700">
                        {row.overdueTasks}
                      </td>

                      {/* STATUS */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          row.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}>
                          {row.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setViewHeadProfileModal(row)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-800 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {row.headId && (
                          <button
                            onClick={() => openEditModal(row)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setShowChangeHeadModal(row);
                            handleDepartmentSelectionChange(row.deptCode);
                            setFormFullName('');
                            setFormEmail('');
                            setFormPhone('');
                            setFormEmployeeId(`EMP-${row.deptCode}-002`);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Change Head</span>
                        </button>

                        {row.status === 'Active' && row.hasActiveHead && (
                          <button
                            onClick={() => {
                              setDeleteModalHead(row);
                              setDeleteError(null);
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                            title="Delete Department Head"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete Head</span>
                          </button>
                        )}

                        {row.status === 'Active' && row.headId && (
                          <button
                            onClick={() => setDeactivateModalHead(row)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                            title="Deactivate Head"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Deactivate</span>
                          </button>
                        )}


                        {row.status !== 'Active' && row.headId && (
                          <button
                            onClick={() => handleExecuteReactivate(row)}
                            disabled={submitting}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                            title="Reactivate Head"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Reactivate</span>
                          </button>
                        )}
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================================== */}
        {/* ADD / REPLACE DEPARTMENT HEAD MODAL */}
        {/* ================================================== */}
        {(showAddHeadModal || showChangeHeadModal) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-5 border border-gray-200 shadow-xl font-sans animate-fade-in max-h-[90vh] my-auto overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">
                    {showChangeHeadModal ? `Change Head for ${showChangeHeadModal.deptName}` : 'Add Department Head'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddHeadModal(false);
                    setShowChangeHeadModal(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* CURRENT HEAD INFO IF CHANGING */}
              {showChangeHeadModal && (
                <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-gray-500 uppercase block font-outfit text-[10px]">Current Active Head</span>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 text-sm">{showChangeHeadModal.headName}</span>
                    <span className="font-mono text-[11px] text-gray-600">{showChangeHeadModal.headEmail}</span>
                  </div>
                </div>
              )}

              {/* VALIDATION ERROR BANNER */}
              {validationError && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-semibold space-y-1">
                  <div className="flex items-center space-x-1.5 text-rose-800 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Account Creation Error</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{validationError}</p>
                </div>
              )}

              {/* SAFETY WARNING */}
              {conflictWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-800 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Leadership Transfer Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{conflictWarning}</p>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Target Municipal Department *</label>
                  <select
                    value={formDeptId}
                    onChange={(e) => handleDepartmentSelectionChange(e.target.value)}
                    disabled={Boolean(showChangeHeadModal)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-bold min-h-[44px]"
                  >
                    <option value="">Select Municipal Department...</option>
                    {SEVEN_DEPARTMENTS_META.map((d) => (
                      <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="e.g. Er. Anil Kulkarni"
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Official Municipal Email * (Supabase Identity)</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. rahul.kumar@nagarsetu.gov.in"

                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Employee ID *</label>
                    <input
                      type="text"
                      required
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      placeholder="EMP-PWD-001"
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98220 00000"
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Password * (Min 8 Chars)</label>
                    <input
                      type="password"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Enter secure password"
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAddHeadModal(false);
                    setShowChangeHeadModal(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveDepartmentHead}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px] flex items-center space-x-1.5"
                >
                  <span>{submitting ? 'Saving to Supabase...' : showChangeHeadModal ? 'Confirm Leadership Change' : 'Save Department Head'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* VIEW DEPARTMENT HEAD PROFILE MODAL */}
        {/* ================================================== */}
        {viewHeadProfileModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 space-y-5 border border-gray-200 shadow-xl font-sans max-h-[90vh] my-auto overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Department Leadership & Operational Profile</h3>
                </div>
                <button onClick={() => setViewHeadProfileModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* HEAD & DEPT HEADER BANNER */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                    {viewHeadProfileModal.headName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900 font-outfit">{viewHeadProfileModal.headName}</h2>
                    <span className="text-xs text-emerald-700 font-bold block">{viewHeadProfileModal.deptName} ({viewHeadProfileModal.deptCode})</span>
                    <span className="font-mono text-[11px] text-gray-500 block mt-0.5">{viewHeadProfileModal.headEmail} • {viewHeadProfileModal.headPhone}</span>
                  </div>
                </div>

                <div className="text-right font-mono text-xs space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                    {viewHeadProfileModal.status}
                  </span>
                  <span className="text-gray-500 text-[10px] block">Head ID: {viewHeadProfileModal.employeeId}</span>
                  <span className="text-gray-400 text-[9px] block">Dept ID: {viewHeadProfileModal.deptId}</span>
                </div>
              </div>

              {/* DEPARTMENT SCOPE BANNER */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">Department Operational Scope</span>
                <p className="text-gray-700 text-xs font-medium">{viewHeadProfileModal.deptDescription || `${viewHeadProfileModal.deptName} municipal services and civic infrastructure`}</p>
              </div>

              {/* ACTION BAR — VIEW STAFF BUTTON */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-gray-900 text-xs font-outfit">Department Staff & Field Execution</h4>
                  <p className="text-xs text-gray-500 font-medium">
                    {viewHeadProfileModal.assignedStaff.length} Service Staff active in {viewHeadProfileModal.deptName}
                  </p>
                </div>

                <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setViewDeptStaffModal({ deptId: viewHeadProfileModal.deptId, deptName: viewHeadProfileModal.deptName, deptCode: viewHeadProfileModal.deptCode, headName: viewHeadProfileModal.headName, staffFilter: 'All', staffList: viewHeadProfileModal.assignedStaff, loading: false, error: null })}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>View Department Staff ({viewHeadProfileModal.assignedStaff.length}) →</span>
                  </button>

                  <button
                    onClick={() => setViewDeptComplaintsModal({ title: 'Department Complaints', deptId: viewHeadProfileModal.deptId, deptName: viewHeadProfileModal.deptName, deptCode: viewHeadProfileModal.deptCode, headName: viewHeadProfileModal.headName, complaints: viewHeadProfileModal.deptComplaints || [], loading: false, error: null })}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Complaints →</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setViewHeadProfileModal(null)}
                  className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs shadow-xs"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* SUB-MODAL 1: VIEW DEPARTMENT STAFF MODAL */}
        {/* ================================================== */}
        {viewDeptStaffModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] overflow-y-auto font-sans">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl max-h-[90vh] my-auto overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setViewDeptStaffModal(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-extrabold rounded-xl text-xs flex items-center space-x-1.5 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Department Profile</span>
                  </button>
                </div>
                <button onClick={() => setViewDeptStaffModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STAFF HEADER BANNER */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">Department Field Staff</h3>
                    <p className="text-xs font-extrabold text-emerald-700 font-outfit">{viewDeptStaffModal.deptName} ({viewDeptStaffModal.deptCode})</p>
                    <p className="text-[11px] text-gray-500 font-mono">Department Head: {viewDeptStaffModal.headName}</p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold rounded-full inline-block">
                    {viewDeptStaffModal.staffList.length} Active Service Staff
                  </span>
                </div>
              </div>

              {/* FILTER TABS */}
              <div className="flex items-center space-x-2 text-xs font-bold border-b border-gray-100 pb-3">
                {(['All', 'Active', 'Inactive'] as const).map((filter) => {
                  const count = filter === 'All' 
                    ? viewDeptStaffModal.staffList.length 
                    : viewDeptStaffModal.staffList.filter(s => {
                        const st = String(s.status || '').toLowerCase();
                        return filter === 'Active' ? (st === 'active' || st === 'available' || st === 'on task') : (st === 'inactive' || st === 'offline');
                      }).length;
                  return (
                    <button
                      key={filter}
                      onClick={() => setViewDeptStaffModal({ ...viewDeptStaffModal, staffFilter: filter })}
                      className={`px-4 py-2 rounded-xl transition-all ${
                        viewDeptStaffModal.staffFilter === filter 
                          ? 'bg-emerald-600 text-white font-extrabold shadow-xs' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter} ({count})
                    </button>
                  );
                })}
              </div>

              {/* STAFF LIST / LOADING / ERROR */}
              {viewDeptStaffModal.loading ? (
                <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-2xl space-y-2">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-gray-600 font-bold">Loading department staff records...</p>
                </div>
              ) : viewDeptStaffModal.error ? (
                <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-800 font-extrabold">{viewDeptStaffModal.error}</p>
                  <button
                    onClick={() => handleRetryFetchStaff(viewDeptStaffModal.deptId, viewDeptStaffModal.deptName)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : viewDeptStaffModal.staffList.filter(s => {
                if (viewDeptStaffModal.staffFilter === 'All') return true;
                const st = String(s.status || '').toLowerCase();
                return viewDeptStaffModal.staffFilter === 'Active' 
                  ? (st === 'active' || st === 'available' || st === 'on task') 
                  : (st === 'inactive' || st === 'offline');
              }).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-2xl space-y-2">
                  <UserX className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-600 font-bold">No {viewDeptStaffModal.staffFilter.toLowerCase()} staff found for this department.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {viewDeptStaffModal.staffList.filter(s => {
                    if (viewDeptStaffModal.staffFilter === 'All') return true;
                    const st = String(s.status || '').toLowerCase();
                    return viewDeptStaffModal.staffFilter === 'Active' 
                      ? (st === 'active' || st === 'available' || st === 'on task') 
                      : (st === 'inactive' || st === 'offline');
                  }).map((staff) => (
                    <div key={staff.id} className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-emerald-300 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-gray-900 text-sm font-outfit">{staff.name}</span>
                          <span className="font-mono text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">{staff.employee_id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            (staff.status || 'Available').toLowerCase() === 'active' || (staff.status || '').toLowerCase() === 'available'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {staff.status || 'Available'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 font-mono">{staff.email} • {staff.contact_number || staff.mobile || '+91 98220 00000'}</p>
                        <p className="text-[11px] text-gray-500 font-medium">{staff.role || staff.designation || 'Field Service Staff'}</p>
                      </div>

                      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-gray-200 pt-2 sm:pt-0">
                        <div className="text-right font-mono text-[10px] text-gray-500">
                          <span className="block">Active Tasks: <strong className="text-blue-700">{staff.active_tasks || 0}</strong></span>
                          <span className="block">Completed: <strong className="text-emerald-700">{staff.completed_tasks || 0}</strong></span>
                        </div>

                        <button
                          onClick={() => setViewStaffDetailsModal(staff)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center space-x-1 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button onClick={() => setViewDeptStaffModal(null)} className="px-5 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl">
                  Close Staff List
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* SUB-MODAL 2: VIEW STAFF DETAILS MODAL */}
        {/* ================================================== */}
        {viewStaffDetailsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] overflow-y-auto font-sans">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl max-h-[90vh] my-auto overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                    {viewStaffDetailsModal.name ? viewStaffDetailsModal.name.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">{viewStaffDetailsModal.name || 'Not available'}</h3>
                    <p className="text-xs text-gray-500 font-mono">Employee ID: {viewStaffDetailsModal.employee_id || 'Not available'}</p>
                  </div>
                </div>
                <button onClick={() => setViewStaffDetailsModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Department</span>
                  <span className="font-extrabold text-gray-900 block">{viewStaffDetailsModal.department_name || 'Not available'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Designation</span>
                  <span className="font-extrabold text-gray-900 block">{viewStaffDetailsModal.role || viewStaffDetailsModal.designation || 'Field Service Staff'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Email Address</span>
                  <span className="font-mono text-gray-900 block">{viewStaffDetailsModal.email || 'Not available'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Phone / Mobile</span>
                  <span className="font-mono text-gray-900 block">{viewStaffDetailsModal.contact_number || viewStaffDetailsModal.mobile || 'Not available'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Account Status</span>
                  <span className="font-bold text-emerald-800 block">{viewStaffDetailsModal.status || 'Active'}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Joined Date</span>
                  <span className="font-mono text-gray-900 block">{viewStaffDetailsModal.joined_date ? new Date(viewStaffDetailsModal.joined_date).toLocaleDateString() : 'Not available'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[9px] text-blue-700 font-bold block">Active Tasks</span>
                  <span className="text-base font-extrabold text-blue-900 font-mono">{viewStaffDetailsModal.active_tasks ?? 0}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[9px] text-emerald-700 font-bold block">Completed Tasks</span>
                  <span className="text-base font-extrabold text-emerald-900 font-mono">{viewStaffDetailsModal.completed_tasks ?? 0}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[9px] text-rose-700 font-bold block">Overdue Tasks</span>
                  <span className="text-base font-extrabold text-rose-900 font-mono">{viewStaffDetailsModal.overdue_tasks ?? 0}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-gray-500 font-mono block">Current Assignment / Last Activity</span>
                <p className="text-gray-800 font-medium">
                  {viewStaffDetailsModal.active_tasks && viewStaffDetailsModal.active_tasks > 0 
                    ? 'Currently assigned to active municipal field service tasks.' 
                    : 'No active field assignment currently.'}
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button onClick={() => setViewStaffDetailsModal(null)} className="px-5 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl">
                  Close Staff Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* SUB-MODAL 3: VIEW DEPARTMENT COMPLAINTS MODAL */}
        {/* ================================================== */}
        {viewDeptComplaintsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] overflow-y-auto font-sans">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl max-h-[90vh] my-auto overflow-y-auto">
              
              {/* TOP NAVIGATION & BACK BUTTON */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setViewDeptComplaintsModal(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-extrabold rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Department Profile</span>
                  </button>
                </div>

                <button onClick={() => setViewDeptComplaintsModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* COMPLAINTS HEADER BANNER */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">Department Complaints</h3>
                    <p className="text-xs font-extrabold text-emerald-700 font-outfit">{viewDeptComplaintsModal.deptName} ({viewDeptComplaintsModal.deptCode || 'DEPT'})</p>
                    {viewDeptComplaintsModal.headName && (
                      <p className="text-[11px] text-gray-500 font-mono">Department Head: {viewDeptComplaintsModal.headName}</p>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 font-extrabold rounded-full inline-block">
                    Showing {filteredDeptComplaints.length} of {viewDeptComplaintsModal.complaints.length} complaints
                  </span>
                </div>
              </div>

              {/* FILTER & SEARCH PANEL */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl space-y-3 font-sans">
                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search complaints by ID, title, category, location, or assigned staff..."
                    value={complaintFilters.search}
                    onChange={(e) => setComplaintFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-blue-500 shadow-2xs"
                  />
                  {complaintFilters.search && (
                    <button
                      onClick={() => setComplaintFilters((prev) => ({ ...prev, search: '' }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* DROPDOWNS ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  {/* STATUS FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-mono">Status</label>
                    <select
                      value={complaintFilters.status}
                      onChange={(e) => setComplaintFilters((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Verified">Verified</option>
                      <option value="Pending Assignment">Pending Assignment</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                      <option value="Reopened">Reopened</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>

                  {/* PRIORITY FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-mono">Priority</label>
                    <select
                      value={complaintFilters.priority}
                      onChange={(e) => setComplaintFilters((prev) => ({ ...prev, priority: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Priorities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  {/* CATEGORY FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-mono">Category</label>
                    <select
                      value={complaintFilters.category}
                      onChange={(e) => setComplaintFilters((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Categories</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* ASSIGNED STAFF FILTER */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-mono">Assigned Staff</label>
                    <select
                      value={complaintFilters.staff}
                      onChange={(e) => setComplaintFilters((prev) => ({ ...prev, staff: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="All">All Staff ({availableStaffOptions.length})</option>
                      {availableStaffOptions.map((stf) => (
                        <option key={stf} value={stf}>{stf}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* DATE RANGE PRESETS & CLEAR FILTERS */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-gray-200/60 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase font-mono mr-1">Date:</span>
                    {(['All', 'Today', '7Days', '30Days', 'Custom'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setComplaintFilters((prev) => ({ ...prev, datePreset: preset }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          complaintFilters.datePreset === preset
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {preset === 'All' ? 'All Time' : preset === '7Days' ? 'Last 7 Days' : preset === '30Days' ? 'Last 30 Days' : preset}
                      </button>
                    ))}
                  </div>

                  {/* CUSTOM DATE INPUTS IF CUSTOM SELECTED */}
                  {complaintFilters.datePreset === 'Custom' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={complaintFilters.fromDate}
                        onChange={(e) => setComplaintFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono"
                      />
                      <span className="text-gray-400 text-xs font-bold">to</span>
                      <input
                        type="date"
                        value={complaintFilters.toDate}
                        onChange={(e) => setComplaintFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                        className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleClearComplaintFilters}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-gray-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* COMPLAINTS LIST / LOADING / ERROR / FILTERED EMPTY */}
              {viewDeptComplaintsModal.loading ? (
                <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-2xl space-y-2">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-gray-600 font-bold">Loading department complaints...</p>
                </div>
              ) : viewDeptComplaintsModal.error ? (
                <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-800 font-extrabold">{viewDeptComplaintsModal.error}</p>
                  <button
                    onClick={() => handleRetryFetchComplaints(viewDeptComplaintsModal.deptId, viewDeptComplaintsModal.deptCode, viewDeptComplaintsModal.deptName)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : viewDeptComplaintsModal.complaints.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-xs text-gray-600 font-bold">No complaints found for this department.</p>
                </div>
              ) : filteredDeptComplaints.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-gray-200 rounded-2xl space-y-3">
                  <Filter className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-600 font-bold">No complaints match your filters.</p>
                  <button
                    onClick={handleClearComplaintFilters}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Filters</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {filteredDeptComplaints.map((comp) => (
                    <div key={comp.id} className="p-4 bg-slate-50 border border-gray-200 rounded-2xl hover:border-blue-300 transition-all space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-200/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</span>
                          <span className="font-mono text-[10px] text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">{comp.complaint_number || `NS-${comp.id}`}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            comp.priority === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            comp.priority === 'High' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {comp.priority || 'Normal'} Priority
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            comp.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            comp.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            'bg-slate-200 text-slate-800'
                          }`}>
                            {comp.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 font-mono">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Category & Location</span>
                          <span>{comp.category} • {comp.location_address || comp.location_text || comp.ward_name || 'Nashik City'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Assigned Staff</span>
                          <span className="font-bold text-gray-800">{comp.assigned_staff_name || comp.assigned_staff_id || 'Unassigned'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Reported & SLA Due</span>
                          <span>
                            {comp.created_at ? new Date(comp.created_at).toLocaleDateString() : 'Recent'} | Due: {comp.sla_deadline ? new Date(comp.sla_deadline).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end border-t border-gray-200/60 pt-2">
                        <button
                          onClick={() => setViewComplaintDetailModal(comp)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  onClick={() => setViewDeptComplaintsModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Department Profile</span>
                </button>

                <button onClick={() => setViewDeptComplaintsModal(null)} className="px-5 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl">
                  Close Records
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* SUB-MODAL 4: VIEW COMPLAINT DETAIL MODAL */}
        {/* ================================================== */}
        {viewComplaintDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] overflow-y-auto font-sans">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-gray-200 shadow-2xl max-h-[90vh] my-auto overflow-y-auto">
              
              {/* TOP HEADER */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">{viewComplaintDetailModal.title}</h3>
                    <p className="text-xs text-gray-500 font-mono">Complaint ID: {viewComplaintDetailModal.complaint_number || `NS-${viewComplaintDetailModal.id}`}</p>
                  </div>
                </div>
                <button onClick={() => setViewComplaintDetailModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BADGES & PRIORITY */}
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  viewComplaintDetailModal.priority === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                  viewComplaintDetailModal.priority === 'High' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                  'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {viewComplaintDetailModal.priority || 'Normal'} Priority
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  viewComplaintDetailModal.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                  viewComplaintDetailModal.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  'bg-slate-200 text-slate-800'
                }`}>
                  Status: {viewComplaintDetailModal.status}
                </span>
              </div>

              {/* DESCRIPTION & CATEGORY */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Issue Description</span>
                  <p className="text-gray-900 font-medium mt-0.5">{viewComplaintDetailModal.description || viewComplaintDetailModal.title || 'Civic infrastructure complaint'}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Category</span>
                    <span className="font-extrabold text-gray-900 block">{viewComplaintDetailModal.category}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Assigned Staff</span>
                    <span className="font-bold text-gray-900 block">{viewComplaintDetailModal.assigned_staff_name || viewComplaintDetailModal.assigned_staff_id || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Location Address & Coordinates</span>
                  <p className="font-medium text-gray-900 block">{viewComplaintDetailModal.location_address || viewComplaintDetailModal.location_text || viewComplaintDetailModal.ward_name || 'Nashik Municipal Corporation Ward Area'}</p>
                  {viewComplaintDetailModal.latitude && viewComplaintDetailModal.longitude && (
                    <span className="text-[10px] text-gray-500 font-mono block mt-1">
                      GPS: {viewComplaintDetailModal.latitude.toFixed(4)}, {viewComplaintDetailModal.longitude.toFixed(4)} ({viewComplaintDetailModal.location_source || 'live_gps'})
                    </span>
                  )}
                </div>
              </div>

              {/* PHOTOS / EVIDENCE */}
              {viewComplaintDetailModal.photo_before_url && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-gray-500 font-mono block">Evidence Photo</span>
                  <img
                    src={viewComplaintDetailModal.photo_before_url}
                    alt="Complaint photo"
                    className="w-full max-h-48 object-cover rounded-xl border border-gray-200"
                  />
                </div>
              )}

              {/* FOOTER */}
              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button onClick={() => setViewComplaintDetailModal(null)} className="px-5 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl">
                  Close Complaint Details
                </button>
              </div>

            </div>
          </div>
        )}

        {/* EDIT DEPARTMENT HEAD PROFILE MODAL */}
        {editHeadModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <Edit className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900 font-outfit">Edit Department Head Profile</h3>
                    <p className="text-xs text-gray-500 font-mono">{editHeadModal.deptName}</p>
                  </div>
                </div>
                <button onClick={() => setEditHeadModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {validationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Official Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Employee ID</label>
                    <input
                      type="text"
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Department</label>
                    <select
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:bg-white focus:border-amber-500"
                    >
                      {SEVEN_DEPARTMENTS_META.map((d) => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <label className="block text-amber-900 font-bold">New Password (Optional)</label>
                  <p className="text-[11px] text-amber-700">Leave blank to keep current login password unchanged.</p>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter new password to reset"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditHeadModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDepartmentHead}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider"
                >
                  {submitting ? 'Saving Updates...' : 'Save Profile Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* DEACTIVATE CONFIRMATION MODAL */}
        {/* ================================================== */}
        {deactivateModalHead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-rose-200 shadow-xl font-sans">
              <div className="flex items-center space-x-2 text-rose-700 font-extrabold font-outfit text-base">
                <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
                <span>Deactivate Department Head</span>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                Are you sure you want to deactivate Department Head <strong>{deactivateModalHead.headName}</strong> ({deactivateModalHead.deptName})?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1 font-medium">
                <p>• Department Head portal access will be removed immediately.</p>
                <p>• Historical complaints, tasks, and audit logs will remain intact.</p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setDeactivateModalHead(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleExecuteDeactivate}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* DELETE DEPARTMENT HEAD CONFIRMATION MODAL */}
        {/* ================================================== */}
        {deleteModalHead && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-4 sm:p-6 space-y-4 text-gray-900 animate-in zoom-in-95 font-sans max-h-[90vh] my-auto overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">
                      Delete Department Head?
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Explicit confirmation required
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deletingHead}
                  onClick={() => {
                    setDeleteModalHead(null);
                    setDeleteError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Alert if any */}
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Details Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-1.5">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Department</span>
                  <span className="font-extrabold text-gray-900 font-outfit">{deleteModalHead.deptName} ({deleteModalHead.deptCode})</span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-200/60 pb-1.5">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Department Head</span>
                  <span className="font-extrabold text-rose-700 font-mono">{deleteModalHead.headName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-200/60 pb-1.5">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Employee ID</span>
                  <span className="font-bold text-gray-800 font-mono">{deleteModalHead.employeeId || 'EMP-HEAD-001'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Official Email</span>
                  <span className="font-bold text-gray-800 font-mono">{deleteModalHead.headEmail}</span>
                </div>
              </div>

              {/* Warning Box */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-medium space-y-1">
                  <p className="font-extrabold text-amber-950 font-outfit font-bold">Role Revocation & Detachment Warning</p>
                  <p className="leading-relaxed">
                    This will remove the user from the Department Head role and detach them from this department.
                  </p>
                  <p className="text-[11px] text-amber-800 font-normal">
                    Historical complaints, staff assignments, and audit logs will remain preserved.
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={deletingHead}
                  onClick={() => {
                    setDeleteModalHead(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deletingHead}
                  onClick={handleExecuteDeleteHead}
                  className="inline-flex items-center space-x-1.5 px-4.5 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {deletingHead ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Head...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Head</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

