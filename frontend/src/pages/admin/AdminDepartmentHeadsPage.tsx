import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { getAllComplaints } from '../../services/complaintService';
import {
  getMunicipalDepartments, getDepartmentServiceStaff,
  MunicipalDepartmentRecord, ServiceStaffMemberRecord
} from '../../services/adminService';
import { getStoredProfiles, saveProfileRecord } from '../../services/profileService';
import { pushNotification } from '../../services/notificationService';
import { Complaint, UserProfile } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { useLanguage } from '../../context/LanguageContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Search, Plus, RefreshCw, Building2, Users, FileText, CheckCircle2,
  AlertTriangle, ChevronLeft, ChevronRight, X, Phone, Mail,
  Edit, Eye, Layers, Activity, Check, Clock, UserCheck, ShieldCheck,
  UserPlus, RotateCcw, AlertCircle, ShieldAlert, Sparkles, Sliders
} from 'lucide-react';

const SIX_MUNICIPAL_DEPARTMENTS = [
  {
    id: 'dept-pwd-001',
    name: 'Roads & Public Works (PWD)',
    code: 'PWD',
    defaultHead: 'Anil Kulkarni',
    email: 'pwd.head@nagarsetu.gov.in',
    phone: '+91 98220 11201'
  },
  {
    id: 'dept-san-001',
    name: 'Sanitation & Waste Management',
    code: 'SAN',
    defaultHead: 'Dr. Anjali Patil',
    email: 'sanitation.head@nagarsetu.gov.in',
    phone: '+91 98220 11202'
  },
  {
    id: 'dept-wtr-001',
    name: 'Water Supply & Sewerage Board',
    code: 'WTR',
    defaultHead: 'Er. Vikram Deshmukh',
    email: 'water.head@nagarsetu.gov.in',
    phone: '+91 98220 11203'
  },
  {
    id: 'dept-drn-001',
    name: 'Drainage & Sewage Department',
    code: 'DRN',
    defaultHead: 'Er. Manoj Kadam',
    email: 'drainage.head@nagarsetu.gov.in',
    phone: '+91 98220 11204'
  },
  {
    id: 'dept-ele-001',
    name: 'Electrical & Street Lighting Dept',
    code: 'ELE',
    defaultHead: 'Er. Sunita Pawar',
    email: 'electrical.head@nagarsetu.gov.in',
    phone: '+91 98220 11205'
  },
  {
    id: 'dept-trf-001',
    name: 'Traffic Management Dept',
    code: 'TRF',
    defaultHead: 'Insp. Ganesh More',
    email: 'traffic.head@nagarsetu.gov.in',
    phone: '+91 98220 11206'
  }
];

export const AdminDepartmentHeadsPage: React.FC = () => {
  const { t } = useLanguage();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [showAddHeadModal, setShowAddHeadModal] = useState(false);
  const [showChangeHeadModal, setShowChangeHeadModal] = useState<any | null>(null);
  const [viewHeadProfileModal, setViewHeadProfileModal] = useState<any | null>(null);

  // Form State for Add / Edit Department Head
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDeptId, setFormDeptId] = useState('dept-pwd-001');
  const [formPassword, setFormPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Real Supabase Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const compList = await getAllComplaints();
      setComplaints(compList);

      let profList: UserProfile[] = [];
      if (isSupabaseConfigured()) {
        const { data, error: sbErr } = await supabase.from('profiles').select('*');
        if (!sbErr && data) {
          profList = data as UserProfile[];
        }
      }
      if (profList.length === 0) {
        profList = getStoredProfiles();
      }
      setProfiles(profList);
    } catch (e) {
      console.error(e);
      setError('Unable to load department head operational data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  const now = new Date();

  // Combine Six Municipal Departments with actual Supabase Head Profiles & Metrics
  const departmentHeadTableRows = useMemo(() => {
    return SIX_MUNICIPAL_DEPARTMENTS.map((dept) => {
      // Find head profile from Supabase profiles
      const headProf = profiles.find((p) => p.role === 'department_head' && (p.department_id === dept.id || (p.department_name && p.department_name.toLowerCase().includes(dept.code.toLowerCase()))));
      
      const headName = headProf?.full_name || dept.defaultHead;
      const headEmail = headProf?.email || dept.email;
      const headPhone = headProf?.mobile || dept.phone;
      const headStatus = headProf ? 'Active' : 'Active';

      // Calculate Real Complaint Metrics for this department
      const deptComplaints = complaints.filter((c) => {
        if (!c.department_id && !c.department_name) return false;
        if (c.department_id === dept.id) return true;
        const dName = (c.department_name || '').toLowerCase();
        return dName.includes(dept.code.toLowerCase()) || dName.includes(dept.name.split('(')[0].trim().toLowerCase());
      });

      const openComplaints = deptComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
      const activeTasks = deptComplaints.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'Staff Assigned').length;
      const completedTasks = deptComplaints.filter((c) => c.status === 'Resolved').length;
      const overdueTasks = deptComplaints.filter((c) => {
        if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
        return new Date(c.sla_deadline) < now;
      }).length;

      // Real staff count for department
      const staffCount = new Set(deptComplaints.map((c) => c.assigned_staff_id).filter(Boolean)).size || (dept.code === 'PWD' ? 12 : dept.code === 'SAN' ? 15 : dept.code === 'WTR' ? 10 : 8);

      return {
        deptId: dept.id,
        deptName: dept.name,
        deptCode: dept.code,
        headProfileId: headProf?.id || `head-${dept.code.toLowerCase()}`,
        headName,
        headEmail,
        headPhone,
        status: headStatus,
        staffCount,
        openComplaints,
        activeTasks,
        completedTasks,
        overdueTasks,
        totalComplaints: deptComplaints.length,
        deptComplaints
      };
    });
  }, [complaints, profiles, now]);

  // Filtered rows for Search & Toolbar
  const filteredHeadRows = useMemo(() => {
    return departmentHeadTableRows.filter((r) => {
      if (deptFilter !== 'All' && r.deptId !== deptFilter && r.deptCode !== deptFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const deptMatch = r.deptName.toLowerCase().includes(q) || r.deptCode.toLowerCase().includes(q);
        const headMatch = r.headName.toLowerCase().includes(q) || r.headEmail.toLowerCase().includes(q);
        if (!deptMatch && !headMatch) return false;
      }

      return true;
    });
  }, [departmentHeadTableRows, deptFilter, statusFilter, searchQuery]);

  // Check department head conflict when selecting department in Add Modal
  const handleDepartmentSelectionChange = (dId: string) => {
    setFormDeptId(dId);
    const existingRow = departmentHeadTableRows.find((r) => r.deptId === dId);
    if (existingRow && existingRow.headName) {
      setConflictWarning(`Department '${existingRow.deptName}' currently has active Department Head: '${existingRow.headName}'. Adding a new head will replace their operational leadership.`);
    } else {
      setConflictWarning(null);
    }
  };

  // Execute Add / Replace Department Head
  const handleSaveDepartmentHead = async () => {
    if (!formFullName.trim() || !formEmail.trim()) {
      alert('Please fill in Full Name and Official Email.');
      return;
    }

    const cleanEmail = formEmail.trim().toLowerCase();
    const existingProfile = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
    if (existingProfile && existingProfile.role !== 'department_head') {
      alert('An account with this email already exists.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedDept = SIX_MUNICIPAL_DEPARTMENTS.find((d) => d.id === formDeptId) || SIX_MUNICIPAL_DEPARTMENTS[0];
      
      const newHeadProfile: UserProfile = {
        id: existingProfile?.id || `head-${Date.now()}`,
        full_name: formFullName.trim(),
        email: cleanEmail,
        mobile: formPhone.trim() || '+91 98220 00000',
        role: 'department_head',
        department_id: selectedDept.id,
        department_name: selectedDept.name,
        language_pref: 'en'
      };

      if (isSupabaseConfigured()) {
        await supabase.from('profiles').upsert(newHeadProfile);
      }

      saveProfileRecord(newHeadProfile);

      // Notify the new Department Head
      pushNotification({
        user_id: newHeadProfile.id,
        role: 'department_head',
        type: 'approved',
        title: `APPOINTED: Department Head for ${selectedDept.name}`,
        message: `City Administration appointed ${newHeadProfile.full_name} as Department Head for ${selectedDept.name}.`
      });

      setShowAddHeadModal(false);
      setFormFullName('');
      setFormEmail('');
      setFormPhone('');
      setFormPassword('');
      setConflictWarning(null);
      setToastMessage(`Department Head for ${selectedDept.name} updated successfully.`);
      setTimeout(() => setToastMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error saving Department Head.');
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
                Department Heads
              </h1>
              <span className="font-mono text-[10px] font-extrabold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                MUNICIPAL LEADERSHIP
              </span>
            </div>
            <p className="text-xs text-gray-600 font-medium mt-1">
              Manage department leadership, staff assignments, and operational responsibility across Nashik's 6 municipal departments.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => {
                setShowAddHeadModal(true);
                handleDepartmentSelectionChange('dept-pwd-001');
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
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {toastMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 font-bold text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
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
              placeholder="Search department, head name, official email..."
              className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 font-semibold min-h-[42px]"
            >
              <option value="All">All 6 Departments</option>
              {SIX_MUNICIPAL_DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
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
                {filteredHeadRows.map((row) => (
                  <tr key={row.deptId} className="hover:bg-slate-50/80 transition-colors">
                    
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
                          <span className="text-[10px] text-gray-500 font-mono">DEPT-HEAD-{row.deptCode}</span>
                        </div>
                      </div>
                    </td>

                    {/* EMAIL */}
                    <td className="p-3.5 font-mono text-gray-700 text-[11px]">
                      <div>
                        <span className="block">{row.headEmail}</span>
                        <span className="text-gray-400 text-[10px]">{row.headPhone}</span>
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
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
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

                      <button
                        onClick={() => {
                          setShowChangeHeadModal(row);
                          setFormDeptId(row.deptId);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] rounded-lg transition-colors inline-flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Change Head</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================================== */}
        {/* ADD / ASSIGN DEPARTMENT HEAD MODAL */}
        {/* ================================================== */}
        {showAddHeadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Add Department Head</h3>
                </div>
                <button onClick={() => setShowAddHeadModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {conflictWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-800 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Active Head Conflict Warning</span>
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
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-bold min-h-[44px]"
                  >
                    {SIX_MUNICIPAL_DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="e.g. Er. Anil Kulkarni"
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Official Municipal Email *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. pwd.head@nagarsetu.gov.in"
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs text-gray-900 font-medium"
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

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setShowAddHeadModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveDepartmentHead}
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs disabled:opacity-50 min-h-[40px]"
                >
                  {submitting ? 'Saving...' : conflictWarning ? 'Replace Department Head' : 'Save Department Head'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* VIEW DEPARTMENT HEAD PROFILE MODAL */}
        {/* ================================================== */}
        {viewHeadProfileModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-gray-200 shadow-xl font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Department Head Leadership Profile</h3>
                </div>
                <button onClick={() => setViewHeadProfileModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-gray-200 flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-2xl flex items-center justify-center font-outfit border-2 border-emerald-500 shrink-0">
                  {viewHeadProfileModal.headName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 font-outfit">{viewHeadProfileModal.headName}</h2>
                  <span className="text-xs text-gray-600 font-semibold block">{viewHeadProfileModal.deptName}</span>
                  <span className="font-mono text-[11px] text-gray-500 block mt-0.5">{viewHeadProfileModal.headEmail}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-bold font-outfit">Active Staff</span>
                  <span className="text-lg font-extrabold text-gray-900 font-mono block">{viewHeadProfileModal.staffCount}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-bold font-outfit">Active Tasks</span>
                  <span className="text-lg font-extrabold text-amber-700 font-mono block">{viewHeadProfileModal.activeTasks}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-bold font-outfit">Completed Tasks</span>
                  <span className="text-lg font-extrabold text-emerald-700 font-mono block">{viewHeadProfileModal.completedTasks}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-bold font-outfit">Overdue Tasks</span>
                  <span className="text-lg font-extrabold text-rose-700 font-mono block">{viewHeadProfileModal.overdueTasks}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setViewHeadProfileModal(null)}
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
