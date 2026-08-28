import React, { useState, useEffect, useCallback } from 'react';
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
import { Complaint, PriorityLevel } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Search, Download, ArrowUpDown, RefreshCw, AlertTriangle,
  Building2, Users, MapPin, Sparkles, Maximize2, ExternalLink, ShieldCheck, Clock
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

export const AdminPendingComplaintsPage: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [wardFilter, setWardFilter] = useState('All');
  const [slaFilter, setSlaFilter] = useState('All');

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

  // Helper for SLA calculation
  const getSlaHoursLeft = (slaDeadline?: string): number => {
    if (!slaDeadline) return 24;
    const diff = new Date(slaDeadline).getTime() - Date.now();
    return diff / (1000 * 60 * 60);
  };

  // Helper to determine pending stage
  const getPendingStage = (c: Complaint): string => {
    if (c.status === 'Submitted') return 'Pending Verification';
    if (c.status === 'Verified') return 'Pending Approval';
    if (c.status === 'Approved' && (!c.department_name || c.department_name === 'Unassigned')) return 'Pending Department Assignment';
    if ((c.status === 'Approved' || c.status === 'Department Assigned') && !c.assigned_staff_id) return 'Pending Staff Assignment';
    return 'Action Pending';
  };

  // Filter pending complaints list
  const pendingComplaintsList = complaints.filter((c) => {
    const isPendingStatus = ['Submitted', 'Verified', 'Approved', 'Department Assigned', 'Reopened'].includes(c.status);
    const slaInfo = formatSlaRemainingTime(c.sla_deadline);
    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
    const isPendingAction = isPendingStatus || slaInfo.isOverdue || hoursLeft <= 6;
    return isPendingAction;
  });

  // Calculate summary metrics
  const pendingVerificationCount = complaints.filter((c) => c.status === 'Submitted').length;
  const pendingApprovalCount = complaints.filter((c) => c.status === 'Verified').length;
  const pendingAssignmentCount = complaints.filter((c) => (c.status === 'Approved' || c.status === 'Department Assigned') && !c.assigned_staff_id).length;
  const nearSlaCount = pendingComplaintsList.filter((c) => {
    const info = formatSlaRemainingTime(c.sla_deadline);
    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
    return !info.isOverdue && hoursLeft > 0 && hoursLeft <= 6;
  }).length;
  const overdueCount = pendingComplaintsList.filter((c) => formatSlaRemainingTime(c.sla_deadline).isOverdue).length;

  // Filter Logic
  const filteredComplaints = pendingComplaintsList.filter((c) => {
    const stage = getPendingStage(c);
    const matchesSearch =
      c.complaint_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.location_address && c.location_address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = stageFilter === 'All' || stage === stageFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
    const matchesDepartment = departmentFilter === 'All' || (c.department_name && c.department_name.includes(departmentFilter));
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesDate = !dateFilter || c.created_at.startsWith(dateFilter);
    const matchesWard = wardFilter === 'All' || (c.location_address && c.location_address.toLowerCase().includes(wardFilter.toLowerCase()));
    
    const slaInfo = formatSlaRemainingTime(c.sla_deadline);
    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
    let matchesSla = true;
    if (slaFilter === 'Near SLA') matchesSla = !slaInfo.isOverdue && hoursLeft <= 6;
    if (slaFilter === 'Overdue') matchesSla = slaInfo.isOverdue;

    return matchesSearch && matchesStage && matchesPriority && matchesDepartment && matchesCategory && matchesDate && matchesWard && matchesSla;
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

  // Open Review Interface
  const openReviewModal = (c: Complaint) => {
    setSelectedComplaint(c);
    setEditPriority(c.priority);
    setEditDepartment(c.department_name || 'Roads & Public Works');
    const roster = getDepartmentStaffRoster(c.department_name);
    if (roster.length > 0) setSelectedStaffId(roster[0].id);
  };

  // Handle Verify Complaint
  const handleVerifyComplaint = async () => {
    if (!selectedComplaint) return;
    setSubmittingAction(true);
    await verifyAndApproveComplaint(selectedComplaint.id, editPriority, editDepartment);
    alert(`Complaint ${selectedComplaint.complaint_number} Verified & Approved!`);
    await loadComplaints();
    const list = await getAllComplaints();
    setSelectedComplaint(list.find((item) => item.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  // Handle Approve & Assign Staff
  const handleApproveAndAssignStaff = async () => {
    if (!selectedComplaint) return;
    setSubmittingAction(true);
    await verifyAndApproveComplaint(selectedComplaint.id, editPriority, editDepartment);
    if (selectedStaffId) {
      const roster = getDepartmentStaffRoster(editDepartment);
      const staff = roster.find((s) => s.id === selectedStaffId) || roster[0];
      await assignStaffToTask(selectedComplaint.id, staff.id, staff.name, slaHours);
    }
    alert(`Complaint ${selectedComplaint.complaint_number} Approved & Assigned.`);
    await loadComplaints();
    setSelectedComplaint(null);
    setSubmittingAction(false);
  };

  return (
    <DashboardLayout title="Pending Complaints — City Administration">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              Pending Complaints
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Monitor complaints awaiting verification, approval, assignment or further action.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 shadow-xs">
              {pendingComplaintsList.length} Pending Complaints
            </span>

            <button
              onClick={loadComplaints}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-extrabold text-xs border border-gray-300 shadow-xs flex items-center space-x-1.5 transition-all min-h-[44px]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* COMPACT SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block font-outfit">Verification</span>
            <div className="text-xl font-extrabold text-blue-700 font-mono">{pendingVerificationCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block font-outfit">Approval</span>
            <div className="text-xl font-extrabold text-indigo-700 font-mono">{pendingApprovalCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider block font-outfit">Assignment</span>
            <div className="text-xl font-extrabold text-sky-700 font-mono">{pendingAssignmentCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block font-outfit">Near SLA</span>
            <div className="text-xl font-extrabold text-amber-800 font-mono">{nearSlaCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block font-outfit">Overdue</span>
            <div className="text-xl font-extrabold text-rose-700 font-mono">{overdueCount}</div>
          </div>
        </div>

        {/* PRACTICAL ADMINISTRATIVE FILTER TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search complaint ID, issue or location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-emerald-500 font-medium min-h-[44px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={stageFilter}
                onChange={(e) => { setStageFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Pending Stage: All ▼</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Pending Department Assignment">Pending Dept Assignment</option>
                <option value="Pending Staff Assignment">Pending Staff Assignment</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Priority: All ▼</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Department: All ▼</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={slaFilter}
                onChange={(e) => { setSlaFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">SLA Status: All ▼</option>
                <option value="Near SLA">Near SLA Deadline</option>
                <option value="Overdue">Overdue</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              />

              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStageFilter('All');
                  setPriorityFilter('All');
                  setDepartmentFilter('All');
                  setCategoryFilter('All');
                  setDateFilter('');
                  setWardFilter('All');
                  setSlaFilter('All');
                  setCurrentPage(1);
                }}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Clear Filters
              </button>
            </div>

          </div>
        </div>

        {/* PENDING COMPLAINT CLASSIC DATA TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                  <th className="p-3.5">COMPLAINT ID</th>
                  <th className="p-3.5">ISSUE</th>
                  <th className="p-3.5">CATEGORY</th>
                  <th className="p-3.5">LOCATION</th>
                  <th className="p-3.5">PRIORITY</th>
                  <th className="p-3.5">CURRENT STAGE</th>
                  <th className="p-3.5">DEPARTMENT</th>
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    <span className="flex items-center space-x-1">
                      <span>REPORTED ON</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </span>
                  </th>
                  <th className="p-3.5">SLA</th>
                  <th className="p-3.5 text-right">ACTION</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={10} className="p-4">
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : paginatedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500 space-y-2">
                      <p className="font-bold text-gray-800 font-outfit text-sm">No Pending Complaints</p>
                      <p className="text-xs">All complaints are currently up to date.</p>
                      <button
                        onClick={loadComplaints}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl min-h-[44px]"
                      >
                        Refresh
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((c) => {
                    const stage = getPendingStage(c);
                    const slaInfo = formatSlaRemainingTime(c.sla_deadline);
                    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-mono text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {c.complaint_number}
                        </td>
                        <td className="p-3.5 max-w-xs space-y-0.5">
                          <span className="font-bold text-gray-900 block truncate">{c.title}</span>
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
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            {stage}
                          </span>
                        </td>
                        <td className="p-3.5 text-gray-700 font-medium whitespace-nowrap">
                          {c.department_name || 'Public Works'}
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className={`p-3.5 font-mono text-[11px] font-bold whitespace-nowrap ${slaInfo.isOverdue ? 'text-rose-700' : hoursLeft <= 6 ? 'text-amber-800' : 'text-gray-600'}`}>
                          {slaInfo.text}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReviewModal(c)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs min-h-[44px]"
                          >
                            {stage === 'Pending Department Assignment' ? 'Assign Dept' : stage === 'Pending Staff Assignment' ? 'Assign Staff' : 'Review'}
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
              {Math.min(currentPage * pageSize, sortedComplaints.length)} of {sortedComplaints.length} pending complaints
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
          <div className="max-w-5xl w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            
            {/* REVIEW MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  {selectedComplaint.complaint_number}
                </span>
                <h2 className="text-xl font-extrabold text-gray-900 font-outfit">
                  Pending Complaint Review & Action
                </h2>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* SLA WARNING BANNER */}
            {(() => {
              const slaInfo = formatSlaRemainingTime(selectedComplaint.sla_deadline);
              const hoursLeft = getSlaHoursLeft(selectedComplaint.sla_deadline);
              if (slaInfo.isOverdue) {
                return (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between font-medium">
                    <span className="flex items-center space-x-2 font-bold">
                      <Clock className="w-4 h-4 text-rose-600" />
                      <span>🔴 SLA Overdue ({slaInfo.text})</span>
                    </span>
                    <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-rose-300">
                      Escalated to: Senior Municipal Officer
                    </span>
                  </div>
                );
              }
              if (hoursLeft <= 6) {
                return (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between font-medium">
                    <span className="flex items-center space-x-2 font-bold">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>⚠ SLA Due Soon ({slaInfo.text})</span>
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* TWO-COLUMN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: CITIZEN IMAGE & LOCATION */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 font-outfit">
                      REPORTED ISSUE PHOTO
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
                      src={selectedComplaint.photo_before_url}
                      alt="Reported Civic Issue"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* LOCATION SUMMARY & MAP */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 font-outfit flex items-center space-x-1">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>LOCATION</span>
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

              {/* RIGHT COLUMN: DETAILS, STAGES & ACTIONS */}
              <div className="lg:col-span-7 space-y-5 text-xs">
                
                {/* COMPLAINT DETAILS */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-800">Complaint ID: {selectedComplaint.complaint_number}</span>
                    <span className="font-extrabold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full text-[11px]">
                      {getPendingStage(selectedComplaint)}
                    </span>
                  </div>

                  <div>
                    <strong className="block text-base text-gray-900 font-outfit font-extrabold">{selectedComplaint.title}</strong>
                    <p className="text-gray-700 text-xs mt-1 leading-relaxed bg-white p-3 rounded-lg border border-gray-200">{selectedComplaint.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-medium text-gray-800">
                    <div><span className="text-gray-500 block">Category:</span> <strong>{selectedComplaint.category}</strong></div>
                    <div><span className="text-gray-500 block">Priority:</span> <strong>{selectedComplaint.priority}</strong></div>
                    <div><span className="text-gray-500 block">Department:</span> <strong>{selectedComplaint.department_name || 'Public Works'}</strong></div>
                    <div><span className="text-gray-500 block">Reported Date:</span> <strong>{new Date(selectedComplaint.created_at).toLocaleString()}</strong></div>
                  </div>
                </div>

                {/* AI ANALYSIS SECTION */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-900 font-outfit uppercase tracking-wider flex items-center space-x-1">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>AI DETECTION</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Confidence: 94%
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
                      <span>DUPLICATE INTELLIGENCE</span>
                    </span>
                    <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-amber-300">
                      91% Confidence
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="font-bold">⚠ Similar Complaint Found</p>
                    <p className="text-[11px] text-amber-900">Master Complaint: <strong>NS-2026-100234</strong> | Distance: <strong>82m</strong> | Related Reports: <strong>4</strong></p>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button type="button" onClick={() => alert('Viewing existing master complaint NS-2026-100234')} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 min-h-[44px]">View Existing</button>
                    <button type="button" onClick={() => alert('Complaint linked to master NS-2026-100234')} className="px-3 py-1.5 rounded-lg bg-white border border-amber-400 font-bold text-xs hover:bg-amber-100 min-h-[44px]">Link Complaint</button>
                    <button type="button" onClick={() => alert('Marked as separate complaint')} className="px-3 py-1.5 rounded-lg bg-white border border-amber-400 font-bold text-xs hover:bg-amber-100 min-h-[44px]">Keep Separate</button>
                  </div>
                </div>

                {/* STAGE SPECIFIC ACTION CONTROLS */}
                {selectedComplaint.status === 'Submitted' && (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                    <span className="font-extrabold text-gray-900 font-outfit uppercase tracking-wider block">
                      COMPLAINT VERIFICATION
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-gray-800">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={checkImage} onChange={(e) => setCheckImage(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>✓ Issue Image</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={checkLocation} onChange={(e) => setCheckLocation(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>✓ Location</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={checkCategory} onChange={(e) => setCheckCategory(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>✓ Category</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={checkPriority} onChange={(e) => setCheckPriority(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>✓ Priority</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={checkDuplicate} onChange={(e) => setCheckDuplicate(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span>✓ Duplicate Status</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* DEPARTMENT & PRIORITY OVERRIDES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Assign Department</label>
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
                    <label className="block font-bold text-gray-700 mb-1">Priority</label>
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

                {/* SERVICE STAFF SELECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Field Staff Officer</label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 min-h-[44px]"
                    >
                      <option value="">-- Select Staff Officer --</option>
                      {getDepartmentStaffRoster(editDepartment).map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.employee_id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">SLA Target Limit (Hours)</label>
                    <input
                      type="number"
                      value={slaHours}
                      onChange={(e) => setSlaHours(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 min-h-[44px]"
                    />
                  </div>
                </div>

                {/* ACTIVITY TIMELINE HISTORY */}
                <div className="pt-2">
                  <ActivityTimeline complaintId={selectedComplaint.id} />
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
                      Request More Information
                    </button>
                    {selectedComplaint.status === 'Submitted' ? (
                      <button
                        type="button"
                        onClick={handleVerifyComplaint}
                        disabled={submittingAction}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
                      >
                        {submittingAction ? 'Verifying...' : 'Verify Complaint'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApproveAndAssignStaff}
                        disabled={submittingAction}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
                      >
                        {submittingAction ? 'Processing...' : 'Approve & Assign Staff'}
                      </button>
                    )}
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
            <img src={selectedComplaint.photo_before_url} alt="Fullscreen Evidence" className="w-full max-h-[85vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
