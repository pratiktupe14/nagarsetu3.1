import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { AdminMapCommandCenter } from '../../components/AdminMapCommandCenter';
import { HotspotDensityMap } from '../../components/HotspotDensityMap';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { getAllComplaints, reviewResolutionAdmin } from '../../services/complaintService';
import {
  calculateAdminKPIStats, formatSlaRemainingTime, verifyAndApproveComplaint,
  changeDepartmentRouting, assignStaffToTask, getDepartmentStaffRoster
} from '../../services/adminService';
import {
  calculateAnalyticsSummary, calculateDepartmentPerformance, calculateStaffPerformanceTable,
  exportComplaintsToCSV, AnalyticsSummary, DepartmentPerformance, StaffPerformanceRow
} from '../../services/analyticsService';
import { Complaint, PriorityLevel, AdminKPIStats } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Building2, Users, CheckCircle2, AlertTriangle, Clock, MapPin,
  TrendingUp, BarChart3, Filter, Search, ShieldCheck, CheckSquare, XSquare, Eye,
  Sparkles, ArrowRight, UserCheck, Check, RotateCcw, Activity, Map, ListFilter, X,
  Zap, Cpu, Download, PieChart, BarChart, Flame, FileSpreadsheet
} from 'lucide-react';

const DEPARTMENT_OPTIONS = [
  'Public Works Department (PWD)',
  'Sanitation & Waste Management',
  'Water Supply & Sewerage Board',
  'Electrical & Lighting Dept',
  'Traffic Management Dept',
  'Drainage & Sewage Dept'
];

export const AdminPortal: React.FC = () => {
  const { t, lang, changeLanguage, translateCategory, translateStatus, translatePriority, translateDepartment } = useLanguage();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-Tabs: 'Triage Queue' | 'Resolution Reviews' | 'Map Center' | 'Analytics & Insights'
  const [activeTab, setActiveTab] = useState<'Triage Queue' | 'Resolution Reviews' | 'Map Center' | 'Analytics & Insights'>('Triage Queue');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Admin Overrides
  const [editCategory, setEditCategory] = useState<string>('Pothole');
  const [editPriority, setEditPriority] = useState<PriorityLevel>('Medium');
  const [editDepartment, setEditDepartment] = useState<string>('Public Works Department (PWD)');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [slaHours, setSlaHours] = useState<number>(24);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

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

  const openVerificationDrawer = (c: Complaint) => {
    setSelectedComplaint(c);
    setEditCategory(c.category || 'Pothole');
    setEditPriority(c.priority);
    setEditDepartment(c.department_name || 'Public Works Department (PWD)');
    const roster = getDepartmentStaffRoster(c.department_name);
    if (roster.length > 0) {
      setSelectedStaffId(roster[0].id);
    }
  };

  const handleApproveComplaint = async () => {
    if (!selectedComplaint) return;
    setSubmittingAction(true);
    await verifyAndApproveComplaint(selectedComplaint.id, editPriority, editDepartment);
    alert(`Complaint ${selectedComplaint.complaint_number} Verified & Approved!`);
    await loadComplaints();
    const updated = await getAllComplaints();
    setSelectedComplaint(updated.find((c) => c.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  const handleChangeDepartment = async (newDept: string) => {
    if (!selectedComplaint) return;
    setEditDepartment(newDept);
    setSubmittingAction(true);
    await changeDepartmentRouting(selectedComplaint.id, newDept);
    await loadComplaints();
    const updated = await getAllComplaints();
    setSelectedComplaint(updated.find((c) => c.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  const handleAssignStaff = async () => {
    if (!selectedComplaint || !selectedStaffId) {
      alert('Please select a department staff member to assign.');
      return;
    }
    const roster = getDepartmentStaffRoster(editDepartment);
    const staff = roster.find((s) => s.id === selectedStaffId) || roster[0];

    setSubmittingAction(true);
    await assignStaffToTask(selectedComplaint.id, staff.id, staff.name, slaHours);
    alert(`Task assigned to ${staff.name} with ${slaHours}h SLA deadline.`);
    await loadComplaints();
    const updated = await getAllComplaints();
    setSelectedComplaint(updated.find((c) => c.id === selectedComplaint.id) || null);
    setSubmittingAction(false);
  };

  const handleApproveResolution = async (complaintId: string) => {
    setSubmittingAction(true);
    await reviewResolutionAdmin(complaintId, true);
    alert('Resolution Approved! Complaint officially marked as Resolved.');
    setSelectedComplaint(null);
    await loadComplaints();
    setSubmittingAction(false);
  };

  const handleRejectResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !rejectionReason) return;
    setSubmittingAction(true);
    await reviewResolutionAdmin(selectedComplaint.id, false, rejectionReason);
    alert('Resolution Rejected. Rejection feedback sent to field staff.');
    setShowRejectModal(false);
    setSelectedComplaint(null);
    setRejectionReason('');
    await loadComplaints();
    setSubmittingAction(false);
  };

  // Analytics Derived Data
  const kpiStats: AdminKPIStats = calculateAdminKPIStats(complaints);
  const analyticsSummary: AnalyticsSummary = calculateAnalyticsSummary(complaints);
  const deptPerformance: DepartmentPerformance[] = calculateDepartmentPerformance(complaints);
  const staffTable: StaffPerformanceRow[] = calculateStaffPerformanceTable(complaints);
  const resolutionReviewsList = complaints.filter((c) => c.status === 'Resolution Submitted');

  const filteredComplaints = complaints.filter((c) => {
    if (activeTab === 'Resolution Reviews') {
      return c.status === 'Resolution Submitted';
    }
    const matchesSearch = c.complaint_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.location_address && c.location_address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const currentDepartmentStaffRoster = getDepartmentStaffRoster(editDepartment);

  return (
    <DashboardLayout title="City Administration Command Center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Building2 className="w-3.5 h-3.5" />
                <span>Central Municipal Command Center</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <BarChart3 className="w-3 h-3 text-emerald-600" />
                <span>Realtime Analytics Engine</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              City Operations & Triage Headquarters
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              End-to-end municipal triage: Verification ➔ AI Routing ➔ Staff Dispatch ➔ Resolution Verification.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => exportComplaintsToCSV(complaints)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center space-x-1.5 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Export Municipal CSV Report</span>
            </button>
          </div>
        </div>

        {/* 9 TOP KPI METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 text-center">
          
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-gray-500 block">Total</span>
            <div className="text-xl font-extrabold text-gray-900 font-mono">{kpiStats.total}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-blue-700 block">New</span>
            <div className="text-xl font-extrabold text-blue-700 font-mono">{kpiStats.newCount}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-sky-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-sky-700 block">Pending Ver.</span>
            <div className="text-xl font-extrabold text-sky-700 font-mono">{kpiStats.pendingVerification}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-indigo-700 block">Approved</span>
            <div className="text-xl font-extrabold text-indigo-700 font-mono">{kpiStats.approved}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-amber-800 block">In Progress</span>
            <div className="text-xl font-extrabold text-amber-800 font-mono">{kpiStats.inProgress}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs space-y-0.5 relative">
            <span className="text-[9px] uppercase font-bold text-purple-800 block">Reviews</span>
            <div className="text-xl font-extrabold text-purple-800 font-mono">{resolutionReviewsList.length}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-emerald-800 block">Resolved</span>
            <div className="text-xl font-extrabold text-emerald-800 font-mono">{kpiStats.resolved}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-orange-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-orange-800 block">Reopened</span>
            <div className="text-xl font-extrabold text-orange-800 font-mono">{kpiStats.reopened}</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-xs space-y-0.5">
            <span className="text-[9px] uppercase font-bold text-rose-800 block">Critical</span>
            <div className="text-xl font-extrabold text-rose-800 font-mono">{kpiStats.critical}</div>
          </div>

        </div>

        {/* 4 COMMAND CENTER SUB-TABS */}
        <div className="flex items-center space-x-2 border-b border-gray-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('Triage Queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap min-h-[44px] ${
              activeTab === 'Triage Queue'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Incoming Triage Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('Resolution Reviews')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 relative whitespace-nowrap min-h-[44px] ${
              activeTab === 'Resolution Reviews'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Resolution Reviews</span>
            {resolutionReviewsList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold animate-pulse">
                {resolutionReviewsList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('Map Center')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap min-h-[44px] ${
              activeTab === 'Map Center'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Map className="w-4 h-4" />
            <span>Map Command Center</span>
          </button>

          <button
            onClick={() => setActiveTab('Analytics & Insights')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap min-h-[44px] ${
              activeTab === 'Analytics & Insights'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Smart Analytics & Insights</span>
          </button>
        </div>

        {/* SUB-TAB 1: INCOMING COMPLAINTS TRIAGE TABLE */}
        {activeTab === 'Triage Queue' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
            
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Incoming Complaint Management Log</h3>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search ID, Title, Location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-emerald-500 font-medium"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 font-semibold"
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Verified">Verified</option>
                  <option value="Approved">Approved</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:border-emerald-500 font-semibold"
                >
                  <option value="All">All Priorities</option>
                  <option value="Critical">Critical Only</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 font-extrabold border-b border-gray-200 uppercase tracking-wider font-outfit">
                    <th className="p-3.5">Complaint ID</th>
                    <th className="p-3.5">Issue & Category</th>
                    <th className="p-3.5">Location</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">SLA Time</th>
                    <th className="p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400">
                        No complaints match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredComplaints.map((c) => {
                      const slaInfo = formatSlaRemainingTime(c.sla_deadline);

                      return (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-700">{c.complaint_number}</td>
                          <td className="p-3.5">
                            <span className="font-bold text-gray-900 block">{c.title}</span>
                            <span className="text-[11px] text-gray-500">{c.category}</span>
                          </td>
                          <td className="p-3.5 text-gray-700 font-mono text-[11px]">{c.location_address || 'City Center'}</td>
                          <td className="p-3.5"><PriorityBadge priority={c.priority} /></td>
                          <td className="p-3.5 text-gray-700">{c.department_name || 'PWD'}</td>
                          <td className="p-3.5"><StatusBadge status={c.status} /></td>
                          <td className="p-3.5 font-mono">
                            <span className={slaInfo.isOverdue ? 'text-rose-700 font-bold' : 'text-gray-600'}>
                              {slaInfo.text}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => openVerificationDrawer(c)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] border border-emerald-300 flex items-center space-x-1 min-h-[44px]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Verify & Triage</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* SUB-TAB 2: RESOLUTION REVIEWS QUEUE */}
        {activeTab === 'Resolution Reviews' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Staff Resolution Proof Review Queue</h3>
              <p className="text-xs text-gray-500 mt-1">Review side-by-side Before/After photos and field notes before marking complaints officially resolved.</p>
            </div>

            {resolutionReviewsList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-gray-900 font-outfit">No Pending Resolution Reviews</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">All staff resolution submissions have been reviewed and verified.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resolutionReviewsList.map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-emerald-700 text-xs">{c.complaint_number}</span>
                      <PriorityBadge priority={c.priority} />
                    </div>

                    <h4 className="font-extrabold text-gray-900 font-outfit text-base">{c.title}</h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-bold text-gray-700 block mb-1">BEFORE (Citizen Report)</span>
                        <img src={c.photo_before_url} alt="Before" className="w-full h-36 rounded-xl object-cover border border-gray-200" />
                      </div>
                      <div>
                        <span className="font-bold text-emerald-800 block mb-1">AFTER (Staff Proof)</span>
                        <img src={c.photo_after_url} alt="After Proof" className="w-full h-36 rounded-xl object-cover border border-emerald-300" />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
                      <p className="text-gray-800 font-medium"><strong>Work Performed:</strong> {c.work_performed || 'Patched asphalt depression'}</p>
                      {c.materials_used && <p className="text-gray-600"><strong>Materials Used:</strong> {c.materials_used}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <button
                        onClick={() => { setSelectedComplaint(c); setShowRejectModal(true); }}
                        className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 font-bold text-xs min-h-[44px]"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => handleApproveResolution(c.id)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
                      >
                        Approve Resolution
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: MAP COMMAND CENTER */}
        {activeTab === 'Map Center' && (
          <AdminMapCommandCenter
            complaints={complaints}
            onSelectComplaint={(c) => openVerificationDrawer(c)}
          />
        )}

        {/* SUB-TAB 4: SMART ANALYTICS & MUNICIPAL INSIGHTS */}
        {activeTab === 'Analytics & Insights' && (
          <div className="space-y-6">
            
            {/* 6 TOP ANALYTICS KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Resolution Rate</span>
                <div className="text-2xl font-extrabold text-emerald-800 font-mono">{analyticsSummary.resolutionRatePercentage}%</div>
                <span className="text-[9px] text-gray-400 block">Official Proof Verified</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Avg Response Time</span>
                <div className="text-2xl font-extrabold text-blue-700 font-mono">{analyticsSummary.avgResponseHours}h</div>
                <span className="text-[9px] text-gray-400 block">Triage & Verification</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">Avg Resolution Time</span>
                <div className="text-2xl font-extrabold text-indigo-700 font-mono">{analyticsSummary.avgResolutionHours}h</div>
                <span className="text-[9px] text-gray-400 block">Site Work Duration</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-800 block">Overdue Rate</span>
                <div className="text-2xl font-extrabold text-rose-800 font-mono">{analyticsSummary.overdueRatePercentage}%</div>
                <span className="text-[9px] text-gray-400 block">Exceeded SLA Deadline</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-orange-800 block">Reopened Rate</span>
                <div className="text-2xl font-extrabold text-orange-800 font-mono">{analyticsSummary.reopenedRatePercentage}%</div>
                <span className="text-[9px] text-gray-400 block">Citizen Re-inspections</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-600 block">Report Export</span>
                <button
                  onClick={() => exportComplaintsToCSV(complaints)}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition-colors min-h-[44px]"
                >
                  Download CSV
                </button>
                <span className="text-[9px] text-gray-400 block">Municipal CSV Format</span>
              </div>
            </div>

            {/* HOTSPOT DENSITY MAP */}
            <HotspotDensityMap complaints={complaints} />

            {/* DEPARTMENT PERFORMANCE COMPARISON TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Municipal Department Performance Matrix</h3>
                  <p className="text-xs text-gray-500">Real-time performance comparison across municipal service boards.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 font-extrabold border-b border-gray-200 uppercase tracking-wider font-outfit">
                      <th className="p-3.5">Department Name</th>
                      <th className="p-3.5 text-center">Total Complaints</th>
                      <th className="p-3.5 text-center">Resolved</th>
                      <th className="p-3.5 text-center">Pending Active</th>
                      <th className="p-3.5 text-center">Avg Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {deptPerformance.map((dept) => (
                      <tr key={dept.departmentName} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900">{dept.departmentName}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-gray-800">{dept.totalComplaints}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-emerald-700">{dept.resolvedCount}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-amber-700">{dept.pendingCount}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-indigo-700">{dept.avgResolutionHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUTHORIZED STAFF PERFORMANCE TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-extrabold text-gray-900 font-outfit">Authorized Field Officer Performance Roster</h3>
                  <p className="text-xs text-gray-500">Track field officer task completion rates, SLA compliance, and workload.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 font-extrabold border-b border-gray-200 uppercase tracking-wider font-outfit">
                      <th className="p-3.5">Employee Name & ID</th>
                      <th className="p-3.5 text-center">Tasks Completed</th>
                      <th className="p-3.5 text-center">Pending Active Tasks</th>
                      <th className="p-3.5 text-center">Overdue Tasks</th>
                      <th className="p-3.5 text-center">Avg Completion Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {staffTable.map((staff) => (
                      <tr key={staff.staffId} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3.5">
                          <span className="font-bold text-gray-900 block">{staff.staffName}</span>
                          <span className="font-mono text-[10px] text-emerald-700">{staff.employeeId}</span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-emerald-700">{staff.tasksCompleted}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-amber-700">{staff.pendingTasks}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-rose-700">{staff.overdueTasks}</td>
                        <td className="p-3.5 text-center font-mono font-bold text-indigo-700">{staff.avgCompletionHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* COMPLAINT VERIFICATION & TRIAGE DRAWER / MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="max-w-3xl w-full bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-md my-8 space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm font-extrabold text-emerald-700">{selectedComplaint.complaint_number}</span>
                  <StatusBadge status={selectedComplaint.status} />
                  <PriorityBadge priority={selectedComplaint.priority} />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 font-outfit">{selectedComplaint.title}</h3>
                <p className="text-xs text-gray-500">Citizen ID: {selectedComplaint.citizen_id} • Date Reported: {new Date(selectedComplaint.created_at).toLocaleString()}</p>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="font-bold text-gray-700 block mb-1">Citizen Photo Evidence</span>
                <img
                  src={selectedComplaint.photo_before_url}
                  alt="Defect"
                  className="w-full h-48 rounded-xl object-cover border border-gray-200 shadow-xs"
                />
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>AI Vision Defect Classification</span>
                    </div>
                    <span className="font-mono font-bold text-[10px] bg-white px-2 py-0.5 rounded border border-amber-300">
                      [DEMO AI ENGINE]
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">Detected Category: {selectedComplaint.category} (94% Confidence)</p>
                  <p className="text-[11px] text-amber-800">Recommended Priority: {selectedComplaint.priority}</p>
                </div>

                <div>
                  <span className="font-bold text-gray-700 block mb-1">Description</span>
                  <p className="text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200 leading-relaxed">{selectedComplaint.description}</p>
                </div>

                <div>
                  <span className="font-bold text-gray-700 block">Location Coordinates</span>
                  <span className="font-mono text-gray-600">{Number(selectedComplaint.latitude).toFixed(4)}, {Number(selectedComplaint.longitude).toFixed(4)} ({selectedComplaint.location_source})</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-outfit">Site Map Pin</span>
              <LocationMapPicker
                initialLat={Number(selectedComplaint.latitude)}
                initialLng={Number(selectedComplaint.longitude)}
                interactive={false}
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 font-outfit">City Administration Verification & Overrides</span>
                <span className="font-mono text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                  Target Dept: {editDepartment}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Override Priority Level</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-semibold focus:border-emerald-500"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Override Department</label>
                  <select
                    value={editDepartment}
                    onChange={(e) => handleChangeDepartment(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-semibold focus:border-emerald-500"
                  >
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApproveComplaint()}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase shadow-sm flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Approve Verification & Department Routing</span>
              </button>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <h4 className="font-extrabold text-gray-900 font-outfit text-sm">Assign Department Field Staff Member</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Department Staff Roster</label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500"
                  >
                    {currentDepartmentStaffRoster.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.employee_id}) • Workload: {staff.active_workload_count} tasks
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">SLA Resolution Hours</label>
                  <select
                    value={slaHours}
                    onChange={(e) => setSlaHours(Number(e.target.value))}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-semibold focus:border-emerald-500"
                  >
                    <option value={4}>4 Hours (Emergency SLA)</option>
                    <option value={8}>8 Hours (High Priority SLA)</option>
                    <option value={24}>24 Hours (Standard SLA)</option>
                    <option value={48}>48 Hours (Low Priority SLA)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAssignStaff}
                disabled={submittingAction}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1.5 min-h-[44px]"
              >
                <UserCheck className="w-4 h-4" />
                <span>Assign Staff Member & Set SLA</span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <ActivityTimeline complaintId={selectedComplaint.id} />
            </div>

          </div>
        </div>
      )}

      {showRejectModal && selectedComplaint && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <form onSubmit={handleRejectResolution} className="max-w-md w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Reject Resolution #{selectedComplaint.complaint_number}</h3>
              <button type="button" onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-gray-700">Rejection Reason for Field Staff</label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why repair proof is incomplete..."
                className="w-full bg-white border border-gray-300 rounded-xl p-3 text-xs text-gray-900 focus:border-orange-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px]"
            >
              Confirm Rejection & Reopen Complaint
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
};
