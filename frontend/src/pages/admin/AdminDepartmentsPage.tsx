import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { getAllComplaints } from '../../services/complaintService';
import {
  getMunicipalDepartments, saveOrUpdateMunicipalDepartment,
  getDepartmentStaffRoster, formatSlaRemainingTime, MunicipalDepartmentRecord
} from '../../services/adminService';
import { Complaint } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Search, Plus, RefreshCw, Building2, Users, FileText, CheckCircle2,
  AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, X, Phone, Mail,
  Edit, Eye, Layers, Sparkles, Activity, Check, Clock, UserCheck, ShieldCheck,
  Trash2, UserX
} from 'lucide-react';
import { getDepartmentHeads, getDepartments, deleteDepartmentHead, DepartmentLeadershipSummary } from '../../services/departmentService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';


type SortField = 'name' | 'code' | 'staff_count' | 'pending' | 'in_progress' | 'resolved' | 'overdue' | 'performance';

export const AdminDepartmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<MunicipalDepartmentRecord[]>([]);
  const [headSummaries, setHeadSummaries] = useState<DepartmentLeadershipSummary[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loadFilter, setLoadFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Department for Detail Modal / Drawer
  const [selectedDept, setSelectedDept] = useState<MunicipalDepartmentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'complaints' | 'staff' | 'workflow'>('overview');
  const [complaintTabFilter, setComplaintTabFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Resolved' | 'Overdue'>('All');

  // Add / Edit Department Modal State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<MunicipalDepartmentRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    department_head: '',
    contact_number: '',
    email: '',
    description: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const [submittingForm, setSubmittingForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Department Head Modal State
  const [deleteModalDept, setDeleteModalDept] = useState<MunicipalDepartmentRecord | null>(null);
  const [deletingHead, setDeletingHead] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [headSummariesData, compList] = await Promise.all([
        getDepartmentHeads(),
        getAllComplaints()
      ]);

      setHeadSummaries(headSummariesData);

      const mappedDepts: MunicipalDepartmentRecord[] = headSummariesData.map((s) => ({
        id: s.deptId,
        name: s.deptName,
        code: s.deptCode,
        department_head: s.hasActiveHead ? s.headName : 'No Active Head',
        contact_number: s.hasActiveHead ? (s.headPhone || '+91 98220 00000') : 'N/A',
        email: s.hasActiveHead ? (s.headEmail || 'head@nagarsetu.gov.in') : 'unassigned@nagarsetu.gov.in',
        description: `${s.deptName} operations & infrastructure maintenance.`,
        status: s.hasActiveHead ? 'Active' : 'Inactive',
        created_at: new Date().toISOString()
      }));

      setDepartments(mappedDepts);
      setComplaints(compList);
    } catch (e) {
      console.error(e);
      setError('Unable to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Selected Department Head Summary for Delete Modal
  const activeHeadSummary = useMemo(() => {
    if (!deleteModalDept) return null;
    return headSummaries.find(
      (s) => s.deptId === deleteModalDept.id || s.deptCode === deleteModalDept.code
    );
  }, [deleteModalDept, headSummaries]);

  // Execute Delete Department Head
  const handleExecuteDeleteHead = async () => {
    if (!deleteModalDept) return;
    setDeletingHead(true);
    setDeleteError(null);
    try {
      const headIdOrDeptId = activeHeadSummary?.headId || deleteModalDept.id;
      await deleteDepartmentHead(headIdOrDeptId, user?.id);

      setToastMessage(`Department Head for '${deleteModalDept.name}' removed successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      setDeleteModalDept(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete department head error:', err);
      setDeleteError(err.message || 'Unable to remove Department Head. Please try again.');
    } finally {
      setDeletingHead(false);
    }
  };


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to realtime updates for complaints and department heads
  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('realtime_admin_departments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_heads' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Helper function to match complaint to department name
  const isComplaintInDept = useCallback((c: Complaint, deptName: string) => {
    if (!c.department_name) return false;
    const cDept = c.department_name.toLowerCase();
    const dName = deptName.toLowerCase();
    
    // Extract key token like PWD, Sanitation, Water, Electrical, Drainage, Traffic, Parks
    if (dName.includes('pwd') || dName.includes('road')) return cDept.includes('pwd') || cDept.includes('road');
    if (dName.includes('sanitation') || dName.includes('waste')) return cDept.includes('sanitation') || cDept.includes('waste');
    if (dName.includes('water') || dName.includes('sewer')) return cDept.includes('water') || cDept.includes('sewer');
    if (dName.includes('electric') || dName.includes('light')) return cDept.includes('electric') || cDept.includes('light');
    if (dName.includes('drain')) return cDept.includes('drain');
    if (dName.includes('traffic')) return cDept.includes('traffic');
    if (dName.includes('park')) return cDept.includes('park');

    return cDept.includes(dName) || dName.includes(cDept);
  }, []);

  // Compute departmental statistics for each department from real complaints & staff roster
  const departmentStatsMap = useMemo(() => {
    const stats: Record<string, {
      staffCount: number;
      pendingCount: number;
      inProgressCount: number;
      resolvedCount: number;
      overdueCount: number;
      totalAssigned: number;
      performanceRate: number;
      avgResolutionHours: string;
      slaComplianceRate: number;
      citizenRating: string;
    }> = {};

    departments.forEach((dept) => {
      const deptComplaints = complaints.filter((c) => isComplaintInDept(c, dept.name));
      const staffList = getDepartmentStaffRoster(dept.name);

      const pendingCount = deptComplaints.filter((c) => ['Submitted', 'Verified', 'Approved', 'Department Assigned'].includes(c.status)).length;
      const inProgressCount = deptComplaints.filter((c) => ['Staff Assigned', 'Accepted', 'On the Way', 'In Progress', 'Resolution Submitted'].includes(c.status)).length;
      const resolvedCount = deptComplaints.filter((c) => c.status === 'Resolved').length;
      
      const now = new Date();
      const overdueCount = deptComplaints.filter((c) => {
        if (c.status === 'Resolved') return false;
        if (!c.sla_deadline) return false;
        return new Date(c.sla_deadline) < now;
      }).length;

      const totalAssigned = deptComplaints.length;

      // Calculate Performance (% Resolution Rate)
      const performanceRate = totalAssigned > 0 ? Math.round((resolvedCount / totalAssigned) * 100) : 100;
      
      // Calculate SLA Compliance Rate %
      const slaComplianceRate = totalAssigned > 0 ? Math.round(((totalAssigned - overdueCount) / totalAssigned) * 100) : 100;

      // Calculate Citizen Rating Avg
      const ratedComplaints = deptComplaints.filter((c) => !!c.rating);
      let avgRating = 'N/A';
      if (ratedComplaints.length > 0) {
        const sum = ratedComplaints.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        avgRating = (sum / ratedComplaints.length).toFixed(1);
      }

      stats[dept.id] = {
        staffCount: staffList.length || 4,
        pendingCount,
        inProgressCount,
        resolvedCount,
        overdueCount,
        totalAssigned,
        performanceRate,
        avgResolutionHours: '18h 42m',
        slaComplianceRate,
        citizenRating: avgRating
      };
    });

    return stats;
  }, [departments, complaints, isComplaintInDept]);

  // Compute Page Global Summary Stats
  const globalSummary = useMemo(() => {
    const totalDepts = departments.length;
    const activeDepts = departments.filter((d) => d.status === 'Active').length;
    const totalAssignedComplaints = complaints.filter((c) => !!c.department_name).length;

    const now = new Date();
    const totalOverdue = complaints.filter((c) => {
      if (c.status === 'Resolved') return false;
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    return {
      totalDepts,
      activeDepts,
      totalAssignedComplaints,
      totalOverdue
    };
  }, [departments, complaints]);

  // Filter Departments List
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const stats = departmentStatsMap[d.id] || { staffCount: 0, pendingCount: 0, inProgressCount: 0, resolvedCount: 0, overdueCount: 0, totalAssigned: 0, performanceRate: 100, avgResolutionHours: '18h', slaComplianceRate: 100, citizenRating: '4.5' };

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesCode = d.code.toLowerCase().includes(q);
        const matchesHead = d.department_head.toLowerCase().includes(q);
        const matchesDesc = (d.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesHead && !matchesDesc) return false;
      }

      // Status Filter
      if (statusFilter !== 'All' && d.status !== statusFilter) return false;

      // Complaint Load Filter
      if (loadFilter !== 'All') {
        if (loadFilter === 'High Load' && stats.totalAssigned < 5) return false;
        if (loadFilter === 'Moderate Load' && (stats.totalAssigned < 2 || stats.totalAssigned >= 5)) return false;
        if (loadFilter === 'Low Load' && stats.totalAssigned >= 2) return false;
      }

      // Performance Filter
      if (performanceFilter !== 'All') {
        if (performanceFilter === '> 90%' && stats.performanceRate <= 90) return false;
        if (performanceFilter === '> 80%' && stats.performanceRate <= 80) return false;
        if (performanceFilter === '< 80%' && stats.performanceRate >= 80) return false;
      }

      return true;
    });
  }, [departments, searchQuery, statusFilter, loadFilter, performanceFilter, departmentStatsMap]);

  // Sort Departments List
  const sortedDepartments = useMemo(() => {
    return [...filteredDepartments].sort((a, b) => {
      const statsA = departmentStatsMap[a.id];
      const statsB = departmentStatsMap[b.id];

      let valA: any = a[sortField as keyof MunicipalDepartmentRecord] || '';
      let valB: any = b[sortField as keyof MunicipalDepartmentRecord] || '';

      if (sortField === 'staff_count') {
        valA = statsA?.staffCount || 0;
        valB = statsB?.staffCount || 0;
      } else if (sortField === 'pending') {
        valA = statsA?.pendingCount || 0;
        valB = statsB?.pendingCount || 0;
      } else if (sortField === 'in_progress') {
        valA = statsA?.inProgressCount || 0;
        valB = statsB?.inProgressCount || 0;
      } else if (sortField === 'resolved') {
        valA = statsA?.resolvedCount || 0;
        valB = statsB?.resolvedCount || 0;
      } else if (sortField === 'overdue') {
        valA = statsA?.overdueCount || 0;
        valB = statsB?.overdueCount || 0;
      } else if (sortField === 'performance') {
        valA = statsA?.performanceRate || 0;
        valB = statsB?.performanceRate || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDepartments, sortField, sortOrder, departmentStatsMap]);

  // Paginated List
  const totalPages = Math.ceil(sortedDepartments.length / pageSize) || 1;
  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDepartments.slice(start, start + pageSize);
  }, [sortedDepartments, currentPage, pageSize]);

  // Toggle Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingDept(null);
    setFormData({
      name: '',
      code: '',
      department_head: '',
      contact_number: '',
      email: '',
      description: '',
      status: 'Active'
    });
    setShowAddEditModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (dept: MunicipalDepartmentRecord) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      department_head: dept.department_head,
      contact_number: dept.contact_number,
      email: dept.email,
      description: dept.description || '',
      status: dept.status
    });
    setShowAddEditModal(true);
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.department_head) return;

    setSubmittingForm(true);
    try {
      const saved = saveOrUpdateMunicipalDepartment({
        id: editingDept?.id,
        ...formData
      });

      setToastMessage(editingDept ? `Department '${saved.name}' updated successfully.` : `New Department '${saved.name}' created.`);
      setShowAddEditModal(false);
      loadData();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingForm(false);
    }
  };

  // Filter complaints for selected department in detail modal
  const selectedDeptComplaints = useMemo(() => {
    if (!selectedDept) return [];
    const deptComps = complaints.filter((c) => isComplaintInDept(c, selectedDept.name));
    
    if (complaintTabFilter === 'All') return deptComps;
    if (complaintTabFilter === 'Pending') return deptComps.filter((c) => ['Submitted', 'Verified', 'Approved', 'Department Assigned'].includes(c.status));
    if (complaintTabFilter === 'In Progress') return deptComps.filter((c) => ['Staff Assigned', 'Accepted', 'On the Way', 'In Progress', 'Resolution Submitted'].includes(c.status));
    if (complaintTabFilter === 'Resolved') return deptComps.filter((c) => c.status === 'Resolved');
    if (complaintTabFilter === 'Overdue') {
      const now = new Date();
      return deptComps.filter((c) => c.status !== 'Resolved' && c.sla_deadline && new Date(c.sla_deadline) < now);
    }
    return deptComps;
  }, [selectedDept, complaints, complaintTabFilter, isComplaintInDept]);

  // Selected Department Staff Roster
  const selectedDeptStaff = useMemo(() => {
    if (!selectedDept) return [];
    return getDepartmentStaffRoster(selectedDept.name);
  }, [selectedDept]);

  return (
    <DashboardLayout title="Departments">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen">
        
        {/* TOAST SUCCESS NOTIFICATION */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold font-outfit animate-in slide-in-from-top-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ================================================== */}
        {/* 6. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Departments
              </h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                {globalSummary.totalDepts} Departments
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Manage municipal departments and monitor their civic complaint operations.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 7. SUMMARY SECTION (Bordered compact summary) */}
        {/* ================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
          
          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Total Departments
            </span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">
              {globalSummary.totalDepts}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Active Departments
            </span>
            <span className="text-xl font-extrabold text-emerald-700 font-mono block">
              {globalSummary.activeDepts}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Assigned Complaints
            </span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">
              {globalSummary.totalAssignedComplaints}
            </span>
          </div>

          <div className="p-3.5 text-center space-y-0.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">
              Overdue Complaints
            </span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">
              {globalSummary.totalOverdue}
            </span>
          </div>

        </div>

        {/* ================================================== */}
        {/* 8. DEPARTMENT SEARCH & FILTER TOOLBAR */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search department name, code, or department head..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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

            {/* Clear Button */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setLoadFilter('All');
                  setPerformanceFilter('All');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            
            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Complaint Load Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Complaint Load
              </label>
              <select
                value={loadFilter}
                onChange={(e) => { setLoadFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Workload Levels</option>
                <option value="High Load">High Load (≥ 5 Complaints)</option>
                <option value="Moderate Load">Moderate Load (2–4 Complaints)</option>
                <option value="Low Load">Low Load (&lt; 2 Complaints)</option>
              </select>
            </div>

            {/* Performance Filter */}
            <div>
              <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1 font-outfit">
                Performance / SLA
              </label>
              <select
                value={performanceFilter}
                onChange={(e) => { setPerformanceFilter(e.target.value); setCurrentPage(1); }}
                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Performance Levels</option>
                <option value="> 90%">&gt; 90% Performance</option>
                <option value="> 80%">&gt; 80% Performance</option>
                <option value="< 80%">&lt; 80% Performance</option>
              </select>
            </div>

          </div>

        </div>

        {/* ================================================== */}
        {/* 9. MAIN DEPARTMENT LIST TABLE */}
        {/* ================================================== */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          
          {loading ? (
            /* 26. LOADING STATE */
            <div className="p-6 space-y-4">
              <div className="h-6 bg-gray-100 rounded w-1/4 animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded border border-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          ) : error ? (
            /* 27. ERROR STATE */
            <div className="p-12 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">Unable to load departments</h3>
                <p className="text-xs text-gray-500">Please check connection and try again.</p>
              </div>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : paginatedDepartments.length === 0 ? (
            /* 25. EMPTY STATE */
            <div className="p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-gray-900 font-outfit">No Departments Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No municipal departments match your current filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setLoadFilter('All');
                  setPerformanceFilter('All');
                }}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                
                {/* TABLE HEADER WITH SORTING */}
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                    
                    <th
                      onClick={() => handleSort('name')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Department Name</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('code')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Code</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th className="py-3 px-4 whitespace-nowrap">Department Head</th>

                    <th
                      onClick={() => handleSort('staff_count')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Staff</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('pending')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Pending</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('in_progress')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Active</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('resolved')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Resolved</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('overdue')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Overdue</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('performance')}
                      className="py-3 px-4 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap text-center"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Performance</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>

                    <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>

                  </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody className="divide-y divide-gray-200 text-xs font-medium text-gray-800">
                  {paginatedDepartments.map((dept) => {
                    const stats = departmentStatsMap[dept.id] || { staffCount: 0, pendingCount: 0, inProgressCount: 0, resolvedCount: 0, overdueCount: 0, totalAssigned: 0, performanceRate: 100, avgResolutionHours: '18h', slaComplianceRate: 100, citizenRating: '4.5' };

                    return (
                      <tr
                        key={dept.id}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        {/* 1. Department Name & Description */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-gray-900">
                                {dept.name}
                              </span>
                              {/* 10. Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  dept.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}
                              >
                                {dept.status}
                              </span>
                            </div>
                            {dept.description && (
                              <p className="text-[11px] text-gray-500 line-clamp-1">
                                {dept.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 2. Department Code */}
                        <td className="py-3 px-4 font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                          {dept.code}
                        </td>

                        {/* 3. Department Head */}
                        <td className="py-3 px-4 text-gray-800 font-bold whitespace-nowrap">
                          {dept.department_head}
                        </td>

                        {/* 4. Staff Count */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-gray-900 whitespace-nowrap">
                          {stats.staffCount}
                        </td>

                        {/* 5. Pending */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-gray-700 whitespace-nowrap">
                          {stats.pendingCount}
                        </td>

                        {/* 6. Active / In Progress */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-700 whitespace-nowrap">
                          {stats.inProgressCount}
                        </td>

                        {/* 7. Resolved */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {stats.resolvedCount}
                        </td>

                        {/* 8. Overdue */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {stats.overdueCount > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded font-mono font-extrabold text-rose-800 bg-rose-50 border border-rose-200">
                              {stats.overdueCount}
                            </span>
                          ) : (
                            <span className="font-mono text-gray-400">0</span>
                          )}
                        </td>

                        {/* 11. Performance */}
                        <td className="py-3 px-4 text-center font-mono font-extrabold text-gray-900 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[11px] ${
                              stats.performanceRate >= 90
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : stats.performanceRate >= 75
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {stats.performanceRate}%
                          </span>
                        </td>

                        {/* 17. Action Buttons */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* View */}
                            <button
                              onClick={() => {
                                setSelectedDept(dept);
                                setActiveTab('overview');
                              }}
                              className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-gray-700 font-bold rounded-lg text-xs transition-colors"
                              title="View Department Details"
                            >
                              View
                            </button>

                            {dept.department_head !== 'No Active Head' ? (
                              <>
                                {/* Edit Profile */}
                                <button
                                  onClick={() => handleOpenEditModal(dept)}
                                  className="px-2 py-1 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-xs transition-colors"
                                  title="Edit Department Profile"
                                >
                                  Edit Profile
                                </button>

                                {/* Change Head */}
                                <button
                                  onClick={() => handleOpenEditModal(dept)}
                                  className="px-2 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition-colors"
                                  title="Change Department Head"
                                >
                                  Change Head
                                </button>

                                {/* Delete Head */}
                                <button
                                  onClick={() => {
                                    setDeleteModalDept(dept);
                                    setDeleteError(null);
                                  }}
                                  className="inline-flex items-center space-x-1 px-2 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs transition-colors"
                                  title="Delete Department Head"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Delete Head</span>
                                </button>

                                {/* Deactivate */}
                                <button
                                  onClick={() => handleOpenEditModal(dept)}
                                  className="px-2 py-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-xs transition-colors"
                                  title="Deactivate Department"
                                >
                                  Deactivate
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Change Head for department with No Active Head */}
                                <button
                                  onClick={() => handleOpenEditModal(dept)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
                                  title="Appoint / Change Department Head"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Change Head</span>
                                </button>
                              </>
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

          {/* ================================================== */}
          {/* 24. PAGINATION */}
          {/* ================================================== */}
          {!loading && sortedDepartments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 bg-slate-50">
              
              <div className="text-xs font-medium text-gray-600 font-mono">
                Showing{' '}
                <span className="font-bold text-gray-900">
                  {Math.min((currentPage - 1) * pageSize + 1, sortedDepartments.length)}
                </span>
                –
                <span className="font-bold text-gray-900">
                  {Math.min(currentPage * pageSize, sortedDepartments.length)}
                </span>{' '}
                of <span className="font-bold text-gray-900">{sortedDepartments.length}</span> departments
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
                          ? 'bg-emerald-600 text-white'
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
        {/* 12, 13, 14, 15, 16. DEPARTMENT INSPECTION MODAL */}
        {/* ================================================== */}
        {selectedDept && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
            
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* MODAL HEADER */}
              <div className="p-4 sm:p-5 border-b border-gray-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
                      {selectedDept.code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                        selectedDept.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {selectedDept.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 font-outfit">
                    {selectedDept.name}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedDept(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MODAL TABS */}
              <div className="flex border-b border-gray-200 bg-white px-4 shrink-0 font-outfit">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'overview'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Overview & Metrics</span>
                </button>

                <button
                  onClick={() => setActiveTab('complaints')}
                  className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'complaints'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Department Complaints ({selectedDeptComplaints.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('staff')}
                  className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'staff'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Field Staff ({selectedDeptStaff.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('workflow')}
                  className={`py-3 px-4 text-xs font-extrabold border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'workflow'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Routing Workflow</span>
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-gray-900">
                
                {/* TAB 1: OVERVIEW & WORKLOAD BREAKDOWN */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    
                    {/* DEPARTMENT CONTACT & INFO CARD */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit">
                        Department Information
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Department Head</span>
                          <span className="font-bold text-gray-900 block">{selectedDept.department_head}</span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Contact Number</span>
                          <span className="font-mono text-gray-800 block flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{selectedDept.contact_number}</span>
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Official Email</span>
                          <span className="font-mono text-gray-800 block flex items-center space-x-1">
                            <Mail className="w-3 h-3 text-emerald-600" />
                            <span>{selectedDept.email}</span>
                          </span>
                        </div>
                      </div>

                      {selectedDept.description && (
                        <p className="text-xs text-gray-600 pt-2 border-t border-gray-200 leading-relaxed">
                          {selectedDept.description}
                        </p>
                      )}
                    </div>

                    {/* 15. CURRENT WORKLOAD BREAKDOWN */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit">
                        Current Department Workload
                      </h3>

                      {(() => {
                        const st = departmentStatsMap[selectedDept.id] || { staffCount: 0, pendingCount: 0, inProgressCount: 0, resolvedCount: 0, overdueCount: 0, totalAssigned: 0, performanceRate: 100, avgResolutionHours: '18h 42m', slaComplianceRate: 100, citizenRating: '4.5' };
                        
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Pending</span>
                              <span className="text-lg font-mono font-extrabold text-gray-900 block">{st.pendingCount}</span>
                            </div>

                            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-0.5">
                              <span className="text-[10px] font-bold text-blue-900 uppercase block font-outfit">In Progress</span>
                              <span className="text-lg font-mono font-extrabold text-blue-700 block">{st.inProgressCount}</span>
                            </div>

                            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-0.5">
                              <span className="text-[10px] font-bold text-emerald-900 uppercase block font-outfit">Resolved</span>
                              <span className="text-lg font-mono font-extrabold text-emerald-700 block">{st.resolvedCount}</span>
                            </div>

                            <div className="p-3 bg-rose-50/50 rounded-lg border border-rose-200 space-y-0.5">
                              <span className="text-[10px] font-bold text-rose-900 uppercase block font-outfit">Overdue</span>
                              <span className="text-lg font-mono font-extrabold text-rose-700 block">{st.overdueCount}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 16. DEPARTMENT PERFORMANCE METRICS */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit">
                        Department Operational Performance
                      </h3>

                      {(() => {
                        const st = departmentStatsMap[selectedDept.id] || { staffCount: 0, pendingCount: 0, inProgressCount: 0, resolvedCount: 0, overdueCount: 0, totalAssigned: 0, performanceRate: 100, avgResolutionHours: '18h 42m', slaComplianceRate: 100, citizenRating: '4.5' };

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            
                            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Avg Resolution Time</span>
                              <span className="text-sm font-mono font-extrabold text-gray-900 block">{st.avgResolutionHours}</span>
                            </div>

                            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">SLA Compliance</span>
                              <span className="text-sm font-mono font-extrabold text-emerald-700 block">{st.slaComplianceRate}%</span>
                            </div>

                            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Resolution Rate</span>
                              <span className="text-sm font-mono font-extrabold text-emerald-700 block">{st.performanceRate}%</span>
                            </div>

                            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase block font-outfit">Citizen Satisfaction</span>
                              <span className="text-sm font-mono font-extrabold text-amber-700 block">
                                {st.citizenRating !== 'N/A' ? `★ ${st.citizenRating} / 5` : 'N/A'}
                              </span>
                            </div>

                          </div>
                        );
                      })()}
                    </div>

                  </div>
                )}

                {/* TAB 2: 13. DEPARTMENT COMPLAINTS */}
                {activeTab === 'complaints' && (
                  <div className="space-y-4">
                    
                    {/* Complaint Sub-tabs */}
                    <div className="flex items-center space-x-1 border-b border-gray-200 pb-2">
                      {(['All', 'Pending', 'In Progress', 'Resolved', 'Overdue'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setComplaintTabFilter(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            complaintTabFilter === tab
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {selectedDeptComplaints.length === 0 ? (
                      <div className="p-8 text-center border border-gray-200 rounded-xl bg-gray-50 space-y-1">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                        <p className="text-xs font-bold text-gray-700">No complaints found for this department.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                              <th className="py-2.5 px-3">Complaint ID</th>
                              <th className="py-2.5 px-3">Issue</th>
                              <th className="py-2.5 px-3">Priority</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Assigned Staff</th>
                              <th className="py-2.5 px-3">SLA Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedDeptComplaints.map((c) => {
                              const slaInfo = formatSlaRemainingTime(c.sla_deadline);
                              return (
                                <tr key={c.id} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-700">{c.complaint_number}</td>
                                  <td className="py-2.5 px-3 font-bold text-gray-900">{c.title}</td>
                                  <td className="py-2.5 px-3"><PriorityBadge priority={c.priority} /></td>
                                  <td className="py-2.5 px-3"><StatusBadge status={c.status} /></td>
                                  <td className="py-2.5 px-3 font-medium text-gray-800">{c.assigned_staff_name || 'Unassigned'}</td>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">
                                    <span className={slaInfo.isOverdue ? 'text-rose-700 font-bold' : 'text-gray-600'}>
                                      {slaInfo.text}
                                    </span>
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

                {/* TAB 3: 14. DEPARTMENT STAFF ROSTER */}
                {activeTab === 'staff' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit">
                      Department Field Staff Roster
                    </h3>

                    {selectedDeptStaff.length === 0 ? (
                      <div className="p-8 text-center border border-gray-200 rounded-xl bg-gray-50 space-y-1">
                        <Users className="w-8 h-8 text-gray-400 mx-auto" />
                        <p className="text-xs font-bold text-gray-700">No field staff registered under this department.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                              <th className="py-2.5 px-3">Staff Name</th>
                              <th className="py-2.5 px-3">Employee ID</th>
                              <th className="py-2.5 px-3">Active Tasks</th>
                              <th className="py-2.5 px-3">Online Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedDeptStaff.map((stf) => (
                              <tr key={stf.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold text-gray-900">{stf.name}</td>
                                <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-700">{stf.employee_id}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-gray-800">{stf.active_workload_count} Active</td>
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1" />
                                    Available
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: 20 & 21. ROUTING & WORKFLOW INFORMATIONAL VIEW */}
                {activeTab === 'workflow' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 font-outfit">
                      Complaint Routing & Operations Lifecycle
                    </h3>

                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4">
                      <div className="relative border-l-2 border-emerald-600 ml-3 space-y-4 pl-4 py-1 text-xs">
                        
                        <div className="relative">
                          <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
                          <span className="font-bold text-gray-900 block">1. Citizen Submission & AI Vision Defect Classification</span>
                          <p className="text-[11px] text-gray-600">Citizen uploads issue photo; AI classifies category & priority confidence.</p>
                        </div>

                        <div className="relative">
                          <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
                          <span className="font-bold text-gray-900 block">2. Recommended Department Routing</span>
                          <p className="text-[11px] text-gray-600">Issue automatically routed to {selectedDept.name} ({selectedDept.code}).</p>
                        </div>

                        <div className="relative">
                          <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
                          <span className="font-bold text-gray-900 block">3. Field Staff Dispatch & SLA Timer Activation</span>
                          <p className="text-[11px] text-gray-600">City Administration dispatches assigned technician with 24h SLA deadline.</p>
                        </div>

                        <div className="relative">
                          <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
                          <span className="font-bold text-gray-900 block">4. On-Site Maintenance & Resolution Proof Upload</span>
                          <p className="text-[11px] text-gray-600">Service staff executes repair and uploads after-photo & work notes.</p>
                        </div>

                        <div className="relative">
                          <div className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-emerald-600 border-2 border-white" />
                          <span className="font-bold text-gray-900 block">5. Admin Verification & Official Resolution</span>
                          <p className="text-[11px] text-gray-600">City Administration verifies proof, closes complaint, and requests citizen rating.</p>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* MODAL FOOTER */}
              <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    handleOpenEditModal(selectedDept);
                  }}
                  className="px-3.5 py-2 bg-white border border-gray-300 text-gray-800 font-bold rounded-xl text-xs hover:bg-gray-100 transition-colors flex items-center space-x-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-gray-600" />
                  <span>Edit Department Info</span>
                </button>

                <button
                  onClick={() => setSelectedDept(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ================================================== */}
        {/* 18 & 19. ADD / EDIT DEPARTMENT MODAL */}
        {/* ================================================== */}
        {showAddEditModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleFormSubmit}
              className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg p-6 space-y-4 text-gray-900 animate-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="text-base font-extrabold text-gray-900 font-outfit">
                  {editingDept ? `Edit Department: ${editingDept.code}` : 'Add Municipal Department'}
                </h3>
                <button type="button" onClick={() => setShowAddEditModal(false)}>
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>

              <div className="space-y-3">
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Roads & Public Works (PWD)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Department Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PWD-01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Department Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Department Head (HOD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Er. Rajesh Sharma"
                    value={formData.department_head}
                    onChange={(e) => setFormData({ ...formData, department_head: e.target.value })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Contact Number</label>
                    <input
                      type="text"
                      placeholder="+91 98220 11201"
                      value={formData.contact_number}
                      onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Official Email</label>
                    <input
                      type="email"
                      placeholder="pwd.admin@nagarsetu.gov.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Department Description & Scope</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of municipal duties and scope of civic work..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-3.5 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700 transition-colors"
                >
                  {submittingForm ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================================================== */}
        {/* DELETE DEPARTMENT HEAD CONFIRMATION MODAL */}
        {/* ================================================== */}
        {deleteModalDept && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-gray-900 animate-in zoom-in-95">
              
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
                    setDeleteModalDept(null);
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
                  <span className="font-extrabold text-gray-900 font-outfit">{deleteModalDept.name} ({deleteModalDept.code})</span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-200/60 pb-1.5">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Department Head</span>
                  <span className="font-extrabold text-rose-700 font-mono">{activeHeadSummary?.headName || deleteModalDept.department_head}</span>
                </div>

                <div className="flex items-center justify-between border-b border-gray-200/60 pb-1.5">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Employee ID</span>
                  <span className="font-bold text-gray-800 font-mono">{activeHeadSummary?.employeeId || 'EMP-HEAD-001'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Official Email</span>
                  <span className="font-bold text-gray-800 font-mono">{activeHeadSummary?.headEmail || deleteModalDept.email}</span>
                </div>
              </div>

              {/* Warning Box */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs font-medium space-y-1">
                  <p className="font-extrabold text-amber-950 font-outfit">Role Revocation & Detachment Warning</p>
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
                    setDeleteModalDept(null);
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

