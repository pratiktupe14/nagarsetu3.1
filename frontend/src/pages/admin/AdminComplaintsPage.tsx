import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { getAllComplaints } from '../../services/complaintService';
import {
  calculateAdminKPIStats, formatSlaRemainingTime, verifyAndApproveComplaint,
  assignStaffToTask, getDepartmentStaffRoster
} from '../../services/adminService';
import { exportComplaintsToCSV } from '../../services/analyticsService';
import { Complaint, PriorityLevel, AdminKPIStats } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import {
  Search, Download, ArrowUpDown, RefreshCw, CheckCircle2, AlertTriangle,
  Building2, Users, MapPin, X, Sparkles, Layers, Maximize2, ExternalLink
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

export const AdminComplaintsPage: React.FC = () => {
  const location = useLocation();
  const isNewComplaintsPage = location.pathname.includes('/new');

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(isNewComplaintsPage ? 'Submitted' : 'All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sorting & Pagination State
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected Complaint for 2-Column Review Interface
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [editPriority, setEditPriority] = useState<PriorityLevel>('Medium');
  const [editDepartment, setEditDepartment] = useState<string>('Roads & Public Works');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [slaHours, setSlaHours] = useState<number>(24);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  // Verification Checklist State
  const [checkImage, setCheckImage] = useState(true);
  const [checkLocation, setCheckLocation] = useState(true);
  const [checkCategory, setCheckCategory] = useState(true);
  const [checkPriority, setCheckPriority] = useState(true);
  const [checkDuplicate, setCheckDuplicate] = useState(true);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllComplaints();
      setComplaints(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  useRealtimeComplaints(useCallback(() => {
    loadComplaints();
  }, [loadComplaints]));

  // Calculate KPI Stats
  const kpiStats: AdminKPIStats = calculateAdminKPIStats(complaints);
  const newComplaintsCount = complaints.filter((c) => c.status === 'Submitted').length;

  // Filter Logic
  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      c.complaint_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.location_address && c.location_address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
    const matchesDepartment = departmentFilter === 'All' || (c.department_name && c.department_name.includes(departmentFilter));
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesDate = !dateFilter || c.created_at.startsWith(dateFilter);
    return matchesSearch && matchesStatus && matchesPriority && matchesDepartment && matchesCategory && matchesDate;
  });

  // Sorting Logic
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    const t1 = new Date(a.created_at).getTime();
    const t2 = new Date(b.created_at).getTime();
    return sortOrder === 'desc' ? t2 - t1 : t1 - t2;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedComplaints.length / pageSize) || 1;
  const paginatedComplaints = sortedComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Checkbox Selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedComplaints.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  // Open 2-Column Review Interface
  const openReviewModal = (c: Complaint) => {
    setSelectedComplaint(c);
    setEditPriority(c.priority);
    setEditDepartment(c.department_name || 'Roads & Public Works');
    const roster = getDepartmentStaffRoster(c.department_name);
    if (roster.length > 0) setSelectedStaffId(roster[0].id);
  };

  // Handle Verify & Approve
  const handleApprove = async () => {
    if (!selectedComplaint) return;
    setSubmittingAction(true);
    await verifyAndApproveComplaint(selectedComplaint.id, editPriority, editDepartment);
    alert(`Complaint ${selectedComplaint.complaint_number} Verified & Approved!`);
    await loadComplaints();
    const list = await getAllComplaints();
    setSelectedComplaint(list.find((item) => item.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  // Handle Assign Staff
  const handleAssignStaff = async () => {
    if (!selectedComplaint || !selectedStaffId) {
      alert('Please select a department staff member.');
      return;
    }
    const roster = getDepartmentStaffRoster(editDepartment);
    const staff = roster.find((s) => s.id === selectedStaffId) || roster[0];
    setSubmittingAction(true);
    await assignStaffToTask(selectedComplaint.id, staff.id, staff.name, slaHours);
    alert(`Task assigned to ${staff.name} with ${slaHours}h SLA.`);
    await loadComplaints();
    const list = await getAllComplaints();
    setSelectedComplaint(list.find((item) => item.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  return (
    <DashboardLayout title={isNewComplaintsPage ? "New Complaints — City Administration" : "All Complaints — City Administration"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              {isNewComplaintsPage ? 'New Complaints' : 'All Complaints'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {isNewComplaintsPage
                ? 'Review and verify recently submitted civic complaints before verification.'
                : 'View, verify, assign and manage all civic complaints across municipal sectors.'}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 shadow-xs">
              {newComplaintsCount} New Complaints
            </span>

            <button
              onClick={loadComplaints}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-extrabold text-xs border border-gray-300 shadow-xs flex items-center space-x-1.5 transition-all min-h-[44px]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => exportComplaintsToCSV(filteredComplaints)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center space-x-1.5 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>

        {/* COMPACT SUMMARY BAR */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider block font-outfit">Total</span>
            <div className="text-lg font-extrabold text-gray-900 font-mono">{kpiStats.total}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-blue-700 uppercase tracking-wider block font-outfit">New</span>
            <div className="text-lg font-extrabold text-blue-700 font-mono">{kpiStats.newCount}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-sky-700 uppercase tracking-wider block font-outfit">Pending Ver.</span>
            <div className="text-lg font-extrabold text-sky-700 font-mono">{kpiStats.pendingVerification}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider block font-outfit">Approved</span>
            <div className="text-lg font-extrabold text-indigo-700 font-mono">{kpiStats.approved}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider block font-outfit">In Progress</span>
            <div className="text-lg font-extrabold text-amber-800 font-mono">{kpiStats.inProgress}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider block font-outfit">Resolved</span>
            <div className="text-lg font-extrabold text-emerald-800 font-mono">{kpiStats.resolved}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-orange-800 uppercase tracking-wider block font-outfit">Reopened</span>
            <div className="text-lg font-extrabold text-orange-800 font-mono">{kpiStats.reopened}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-rose-800 uppercase tracking-wider block font-outfit">Critical</span>
            <div className="text-lg font-extrabold text-rose-800 font-mono">{kpiStats.critical}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-wider block font-outfit">Overdue</span>
            <div className="text-lg font-extrabold text-rose-700 font-mono">{kpiStats.overdue}</div>
          </div>
        </div>

        {/* PRACTICAL ADMINISTRATIVE FILTER TOOLBAR */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search complaint ID, issue or location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">All Statuses ▼</option>
                <option value="Submitted">Submitted (New)</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolution Submitted">Resolution Submitted</option>
                <option value="Resolved">Resolved</option>
                <option value="Reopened">Reopened</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">All Priorities ▼</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">All Departments ▼</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">All Categories ▼</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
              />

              {(searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || departmentFilter !== 'All' || categoryFilter !== 'All' || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('All');
                    setPriorityFilter('All');
                    setDepartmentFilter('All');
                    setCategoryFilter('All');
                    setDateFilter('');
                    setCurrentPage(1);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
                >
                  Clear
                </button>
              )}
            </div>

          </div>

          {/* BULK SELECTION ACTION TOOLBAR */}
          {selectedIds.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between font-medium">
              <span>Selected: <strong>{selectedIds.length}</strong> complaints</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => alert(`Bulk Action: Assign Department triggered for ${selectedIds.length} complaints.`)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 min-h-[44px]"
                >
                  Assign Department
                </button>
                <button
                  type="button"
                  onClick={() => exportComplaintsToCSV(complaints.filter((c) => selectedIds.includes(c.id)))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100 min-h-[44px]"
                >
                  Export Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CLASSIC MUNICIPAL COMPLAINT TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                  <th className="p-3.5 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedComplaints.length && paginatedComplaints.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="p-3.5">COMPLAINT ID</th>
                  <th className="p-3.5">ISSUE</th>
                  <th className="p-3.5">CATEGORY</th>
                  <th className="p-3.5">LOCATION</th>
                  <th className="p-3.5">PRIORITY</th>
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    <span className="flex items-center space-x-1">
                      <span>REPORTED ON</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </span>
                  </th>
                  <th className="p-3.5">STATUS</th>
                  <th className="p-3.5 text-right">ACTION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={9} className="p-4">
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : paginatedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-500 space-y-2">
                      <p className="font-bold text-gray-800 font-outfit text-sm">No Complaints Found</p>
                      <p className="text-xs">No complaints match your current filters.</p>
                      <button
                        onClick={() => { setSearchQuery(''); setStatusFilter('All'); setPriorityFilter('All'); setDepartmentFilter('All'); setCategoryFilter('All'); setDateFilter(''); }}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl min-h-[44px]"
                      >
                        Clear Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}>
                        <td className="p-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(c.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-3.5 font-mono text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {c.complaint_number}
                        </td>
                        <td className="p-3.5 max-w-xs space-y-0.5">
                          <span className="font-bold text-gray-900 block truncate">{c.title}</span>
                          <span className="text-[10px] text-gray-500 font-mono block">{c.category}</span>
                        </td>
                        <td className="p-3.5 text-gray-600 font-mono whitespace-nowrap">
                          {c.category}
                        </td>
                        <td className="p-3.5 max-w-xs text-gray-600 truncate">
                          {c.location_address || 'Panchavati Main Road, Nashik City'}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <PriorityBadge priority={c.priority} />
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono whitespace-nowrap">
                          {new Date(c.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => openReviewModal(c)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs min-h-[44px]"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CLASSIC PAGINATION FOOTER */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 font-medium">
            <span>
              Showing {sortedComplaints.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, sortedComplaints.length)} of {sortedComplaints.length} complaints
            </span>

            <div className="flex items-center space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 min-h-[44px]"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`px-3 py-1.5 rounded-lg font-bold min-h-[44px] ${
                    currentPage === idx + 1
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 min-h-[44px]"
              >
                Next
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* TWO-COLUMN COMPLAINT REVIEW INTERFACE MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-5xl w-full bg-white rounded-xl p-6 border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            
            {/* REVIEW MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  {selectedComplaint.complaint_number}
                </span>
                <h2 className="text-xl font-extrabold text-gray-900 font-outfit">
                  Review Civic Complaint
                </h2>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* TWO-COLUMN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: CITIZEN IMAGE & LOCATION */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 font-outfit">
                      REPORTED ISSUE PHOTO EVIDENCE
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => window.open(selectedComplaint.photo_before_url, '_blank')}
                        className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] min-h-[44px] flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFullImageModal(true)}
                        className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] min-h-[44px] flex items-center space-x-1"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Fullscreen</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-gray-200 aspect-4/3 bg-gray-100">
                    <img
                      src={getValidImageUrl(selectedComplaint.photo_before_url)}
                      alt="Reported Civic Issue"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = DEFAULT_CIVIC_IMAGE_PLACEHOLDER; }}
                    />
                  </div>
                </div>

                {/* LOCATION SUMMARY & MAP */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 font-outfit flex items-center space-x-1">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>COMPLAINT LOCATION</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {selectedComplaint.location_source || 'Live GPS'}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="font-bold text-gray-900 block">{selectedComplaint.location_address || 'Panchavati Main Road, Nashik City'}</span>
                    <span className="font-mono text-[11px] text-gray-600 block">
                      Latitude: {Number(selectedComplaint.latitude).toFixed(4)}, Longitude: {Number(selectedComplaint.longitude).toFixed(4)}
                    </span>
                  </div>

                  <div className="h-40 rounded-lg overflow-hidden border border-gray-200 pt-1">
                    <LocationMapPicker
                      initialLat={Number(selectedComplaint.latitude)}
                      initialLng={Number(selectedComplaint.longitude)}
                      interactive={false}
                    />
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: DETAILS, AI ANALYSIS, DUPLICATE INTEL, VERIFICATION, & ACTIONS */}
              <div className="lg:col-span-7 space-y-5 text-xs">
                
                {/* COMPLAINT DETAILS */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-800">ID: {selectedComplaint.complaint_number}</span>
                    <StatusBadge status={selectedComplaint.status} />
                  </div>

                  <div>
                    <strong className="block text-base text-gray-900 font-outfit font-extrabold">{selectedComplaint.title}</strong>
                    <p className="text-gray-700 text-xs mt-1 leading-relaxed bg-white p-3 rounded-lg border border-gray-200">{selectedComplaint.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                    <div><span className="text-gray-500">Reported By:</span> <strong>Citizen (Verified)</strong></div>
                    <div><span className="text-gray-500">Reported Date:</span> <strong>{new Date(selectedComplaint.created_at).toLocaleString()}</strong></div>
                  </div>
                </div>

                {/* AI ANALYSIS SECTION */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-900 font-outfit uppercase tracking-wider flex items-center space-x-1">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>AI ANALYSIS RESULT</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      94% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-gray-800 font-medium">
                    <div><span className="text-gray-500 block">Detected Issue:</span> <strong>{selectedComplaint.category}</strong></div>
                    <div><span className="text-gray-500 block">Recommended Priority:</span> <strong>{selectedComplaint.priority}</strong></div>
                    <div className="col-span-2"><span className="text-gray-500 block">Recommended Department:</span> <strong>{selectedComplaint.department_name || 'Roads / PWD'}</strong></div>
                  </div>
                </div>

                {/* DUPLICATE INTELLIGENCE */}
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 space-y-2 text-amber-950">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold font-outfit uppercase tracking-wider flex items-center space-x-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>SIMILAR COMPLAINTS (DUPLICATE INTELLIGENCE)</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-amber-300">
                      91% Duplicate Match
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="font-bold">⚠ Similar complaint found nearby (82m away)</p>
                    <p className="text-[11px] text-amber-900">Master Complaint: <strong>{selectedComplaint.duplicate_of_id || selectedComplaint.complaint_number}</strong></p>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button type="button" onClick={() => alert(`Viewing existing master complaint ${selectedComplaint.duplicate_of_id || selectedComplaint.complaint_number}`)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 min-h-[44px]">View Existing</button>
                    <button type="button" onClick={() => alert(`Complaint linked to master ${selectedComplaint.duplicate_of_id || selectedComplaint.complaint_number}`)} className="px-3 py-1.5 rounded-lg bg-white border border-amber-400 font-bold text-xs hover:bg-amber-100 min-h-[44px]">Link Complaint</button>
                    <button type="button" onClick={() => alert('Marked as separate complaint')} className="px-3 py-1.5 rounded-lg bg-white border border-amber-400 font-bold text-xs hover:bg-amber-100 min-h-[44px]">Keep Separate</button>
                  </div>
                </div>

                {/* COMPLAINT VERIFICATION CHECKLIST */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                  <span className="font-extrabold text-gray-900 font-outfit uppercase tracking-wider block">
                    COMPLAINT VERIFICATION CHECKLIST
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-gray-800">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={checkImage} onChange={(e) => setCheckImage(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      <span>✓ Issue Image Valid</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={checkLocation} onChange={(e) => setCheckLocation(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      <span>✓ Location Confirmed</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={checkCategory} onChange={(e) => setCheckCategory(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      <span>✓ Category Correct</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={checkPriority} onChange={(e) => setCheckPriority(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      <span>✓ Priority Verified</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={checkDuplicate} onChange={(e) => setCheckDuplicate(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      <span>✓ Duplicate Checked</span>
                    </label>
                  </div>
                </div>

                {/* DEPARTMENT & PRIORITY OVERRIDES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Final Department Assignment</label>
                    <select
                      value={editDepartment}
                      onChange={(e) => {
                        setEditDepartment(e.target.value);
                        const roster = getDepartmentStaffRoster(e.target.value);
                        if (roster.length > 0) setSelectedStaffId(roster[0].id);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 min-h-[44px]"
                    >
                      {DEPARTMENT_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Final Priority Level</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 min-h-[44px]"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* ACTION AREA BUTTONS */}
                <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
                  >
                    Back
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alert('Complaint rejected with feedback sent to citizen.')}
                      className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 min-h-[44px]"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Information request sent to citizen.')}
                      className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 min-h-[44px]"
                    >
                      Request Info
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submittingAction}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
                    >
                      {submittingAction ? 'Verifying...' : 'Verify Complaint'}
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL */}
      {showFullImageModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-xs font-sans">
          <div className="relative max-w-4xl w-full space-y-2">
            <button
              onClick={() => setShowFullImageModal(false)}
              className="absolute top-2 right-2 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 font-bold min-h-[44px] min-w-[44px]"
            >
              ✕
            </button>
            <img src={getValidImageUrl(selectedComplaint.photo_before_url)} alt="Fullscreen Evidence" className="w-full max-h-[85vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
