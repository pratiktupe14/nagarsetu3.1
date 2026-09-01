import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { getAllComplaints } from '../../services/complaintService';
import {
  calculateAdminKPIStats, formatSlaRemainingTime, getDepartmentStaffRoster
} from '../../services/adminService';
import { exportComplaintsToCSV } from '../../services/analyticsService';
import { Complaint } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { getValidImageUrl, DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import {
  Search, Download, ArrowUpDown, RefreshCw, AlertTriangle,
  Building2, Users, MapPin, Sparkles, Maximize2, ExternalLink, Clock, Wrench
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

export const AdminInProgressComplaintsPage: React.FC = () => {
  const { toast } = useNotification();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [staffFilter, setStaffFilter] = useState('All');
  const [wardFilter, setWardFilter] = useState('All');
  const [slaFilter, setSlaFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Sorting & Pagination State
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected Complaint for Detail View Modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

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

  // Filter in-progress complaints list
  const inProgressList = complaints.filter((c) => {
    return ['In Progress', 'Department Assigned', 'Resolution Submitted'].includes(c.status);
  });

  // Calculate summary metrics
  const totalInProgress = inProgressList.length;
  const staffAssignedCount = inProgressList.filter((c) => !!c.assigned_staff_id || !!c.assigned_staff_name).length;
  const dueSoonCount = inProgressList.filter((c) => {
    const info = formatSlaRemainingTime(c.sla_deadline);
    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
    return !info.isOverdue && hoursLeft > 0 && hoursLeft <= 6;
  }).length;
  const overdueCount = inProgressList.filter((c) => formatSlaRemainingTime(c.sla_deadline).isOverdue).length;
  const completedTodayCount = complaints.filter((c) => c.status === 'Resolved' && new Date(c.updated_at || c.created_at).toDateString() === new Date().toDateString()).length;

  // Filter Logic
  const filteredComplaints = inProgressList.filter((c) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      !q ||
      (c.complaint_number || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.location_address && c.location_address.toLowerCase().includes(q)) ||
      (c.assigned_staff_name && c.assigned_staff_name.toLowerCase().includes(q));
    const matchesDepartment = departmentFilter === 'All' || (c.department_name && c.department_name.includes(departmentFilter));
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
    const matchesStaff = staffFilter === 'All' || (c.assigned_staff_name && c.assigned_staff_name.includes(staffFilter));
    const matchesWard = wardFilter === 'All' || (c.location_address && c.location_address.toLowerCase().includes(wardFilter.toLowerCase()));
    const matchesDate = !dateFilter || c.created_at.startsWith(dateFilter);
    
    const slaInfo = formatSlaRemainingTime(c.sla_deadline);
    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
    let matchesSla = true;
    if (slaFilter === 'Near SLA') matchesSla = !slaInfo.isOverdue && hoursLeft <= 6;
    if (slaFilter === 'Overdue') matchesSla = slaInfo.isOverdue;

    return matchesSearch && matchesDepartment && matchesCategory && matchesPriority && matchesStaff && matchesWard && matchesDate && matchesSla;
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

  // Open Detail View Modal
  const openDetailModal = (c: Complaint) => {
    setSelectedComplaint(c);
  };

  return (
    <DashboardLayout title="In Progress Complaints — City Administration">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* PAGE HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              In Progress Complaints
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Monitor civic complaints currently under maintenance or field work.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-extrabold text-amber-900 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 shadow-xs">
              {totalInProgress} Active Complaints
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
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block font-outfit">In Progress</span>
            <div className="text-xl font-extrabold text-amber-800 font-mono">{totalInProgress}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block font-outfit">Staff Assigned</span>
            <div className="text-xl font-extrabold text-blue-700 font-mono">{staffAssignedCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block font-outfit">Due Soon</span>
            <div className="text-xl font-extrabold text-amber-800 font-mono">{dueSoonCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block font-outfit">Overdue</span>
            <div className="text-xl font-extrabold text-rose-700 font-mono">{overdueCount}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs text-center space-y-0.5">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block font-outfit">Completed Today</span>
            <div className="text-xl font-extrabold text-emerald-800 font-mono">{completedTodayCount}</div>
          </div>
        </div>

        {/* PRACTICAL ADMINISTRATIVE FILTER TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search complaints..."
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
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500 min-h-[44px]"
              >
                <option value="All">Category: All ▼</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
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
                  setDepartmentFilter('All');
                  setCategoryFilter('All');
                  setPriorityFilter('All');
                  setStaffFilter('All');
                  setWardFilter('All');
                  setSlaFilter('All');
                  setDateFilter('');
                  setCurrentPage(1);
                }}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Clear Filters
              </button>
            </div>

          </div>
        </div>

        {/* IN PROGRESS CLASSIC DATA TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-600 uppercase tracking-wider font-outfit">
                  <th className="p-3.5">COMPLAINT ID</th>
                  <th className="p-3.5">ISSUE</th>
                  <th className="p-3.5">LOCATION</th>
                  <th className="p-3.5">DEPARTMENT</th>
                  <th className="p-3.5">ASSIGNED STAFF</th>
                  <th className="p-3.5">PRIORITY</th>
                  <th className="p-3.5 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    <span className="flex items-center space-x-1">
                      <span>STARTED ON</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </span>
                  </th>
                  <th className="p-3.5">SLA</th>
                  <th className="p-3.5">PROGRESS</th>
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
                      <p className="font-bold text-gray-800 font-outfit text-sm">No In-Progress Complaints</p>
                      <p className="text-xs">There are no active field work orders currently in progress.</p>
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
                    const slaInfo = formatSlaRemainingTime(c.sla_deadline);
                    const hoursLeft = getSlaHoursLeft(c.sla_deadline);
                    const staffName = c.assigned_staff_name || 'Unassigned Staff';
                    const staffId = c.assigned_staff_id ? `STF-${c.assigned_staff_id.slice(0, 4).toUpperCase()}` : '';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-mono text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {c.complaint_number}
                        </td>
                        <td className="p-3.5 max-w-xs space-y-0.5">
                          <span className="font-bold text-gray-900 block truncate">{c.title}</span>
                          <span className="text-[10px] text-gray-500 font-mono block">{c.category}</span>
                        </td>
                        <td className="p-3.5 max-w-xs text-gray-600 truncate">
                          {c.location_address || 'Panchavati Main Road, Nashik City'}
                        </td>
                        <td className="p-3.5 text-gray-700 font-medium whitespace-nowrap">
                          {c.department_name || 'Public Works'}
                        </td>
                        <td className="p-3.5 whitespace-nowrap space-y-0.5">
                          <span className="font-bold text-gray-900 block">{staffName}</span>
                          <span className="font-mono text-[10px] text-gray-500 block">{staffId}</span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <PriorityBadge priority={c.priority} />
                        </td>
                        <td className="p-3.5 text-gray-500 font-mono whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className={`p-3.5 font-mono text-[11px] font-bold whitespace-nowrap ${slaInfo.isOverdue ? 'text-rose-700' : hoursLeft <= 6 ? 'text-amber-800' : 'text-gray-600'}`}>
                          {slaInfo.text}
                        </td>
                        <td className="p-3.5 whitespace-nowrap space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 font-mono text-[11px]">65%</span>
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600 rounded-full" style={{ width: '65%' }}></div>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 block">Work Underway</span>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openDetailModal(c)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs min-h-[44px]"
                          >
                            View
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
              {Math.min(currentPage * pageSize, sortedComplaints.length)} of {sortedComplaints.length} active complaints
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

      {/* COMPLAINT IN PROGRESS MONITORING MODAL */}
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
                  Field Maintenance Monitoring
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
              
              {/* LEFT COLUMN: CITIZEN & MAINTENANCE PHOTO EVIDENCE */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700 font-outfit block">
                    REPORTED ISSUE PHOTO EVIDENCE
                  </span>
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
                      <span>WORK SITE LOCATION</span>
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

              {/* RIGHT COLUMN: MAINTENANCE DETAILS, ASSIGNED STAFF, & TIMELINE */}
              <div className="lg:col-span-7 space-y-5 text-xs">
                
                {/* COMPLAINT DETAILS & STAFF ASSIGNMENT */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-800">Complaint ID: {selectedComplaint.complaint_number}</span>
                    <StatusBadge status={selectedComplaint.status} />
                  </div>

                  <div>
                    <strong className="block text-base text-gray-900 font-outfit font-extrabold">{selectedComplaint.title}</strong>
                    <p className="text-gray-700 text-xs mt-1 leading-relaxed bg-white p-3 rounded-lg border border-gray-200">{selectedComplaint.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-gray-200 text-gray-800">
                    <div>
                      <span className="text-gray-500 font-mono block text-[10px]">Department:</span>
                      <strong className="text-gray-900">{selectedComplaint.department_name || 'Roads & Public Works'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 font-mono block text-[10px]">Assigned Field Staff:</span>
                      <strong className="text-gray-900">{selectedComplaint.assigned_staff_name || 'Unassigned Staff'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 font-mono block text-[10px]">SLA Target Deadline:</span>
                      <strong className="text-amber-800 font-mono">{formatSlaRemainingTime(selectedComplaint.sla_deadline).text}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 font-mono block text-[10px]">Maintenance Status:</span>
                      <strong className="text-emerald-800">Field Repair Underway (65%)</strong>
                    </div>
                  </div>
                </div>

                {/* MAINTENANCE PROGRESS UPDATE CARD */}
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 text-blue-950">
                  <span className="font-extrabold font-outfit uppercase tracking-wider flex items-center space-x-1">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <span>LATEST MAINTENANCE FIELD UPDATE</span>
                  </span>

                  <p className="text-xs text-blue-900 bg-white p-3 rounded-lg border border-blue-200 font-medium">
                    "Excavation and asphalt patching initiated on site. Expected completion within 4 hours."
                  </p>
                </div>

                {/* ACTIVITY TIMELINE HISTORY */}
                <div className="pt-2">
                  <ActivityTimeline complaintId={selectedComplaint.id} />
                </div>

                {/* ACTION AREA BUTTONS */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={() => toast.info(`Department supervisor notified regarding ${selectedComplaint.complaint_number}.`)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
                  >
                    Ping Field Officer
                  </button>
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
