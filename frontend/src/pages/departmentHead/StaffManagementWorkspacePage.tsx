import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  fetchDepartmentStaffApi,
  createServiceStaffApi,
  updateServiceStaffApi,
  deactivateServiceStaffApi,
  activateServiceStaffApi,
  removeServiceStaffApi,
  DepartmentStaffApiItem,
  DepartmentStaffApiSummary
} from '../../services/adminService';
import {
  Users, UserCheck, UserX, Clock, PlusCircle, Search, Filter,
  RefreshCw, CheckCircle2, AlertTriangle, Eye, Edit3, Trash2,
  Lock, X, Phone, Mail, ShieldCheck, ShieldAlert, Check, User
} from 'lucide-react';

export const StaffManagementWorkspacePage: React.FC = () => {
  const { user, role } = useAuth();
  const activeRole = role || user?.role || 'citizen';
  const isAdmin = ['admin', 'city_admin'].includes(activeRole);
  const isDeptHead = activeRole === 'department_head';

  const userDeptName = user?.department_name || (isDeptHead ? 'My Department' : 'City Administration');
  const userDeptId = user?.department_id ? String(user.department_id) : undefined;

  const [staffList, setStaffList] = useState<DepartmentStaffApiItem[]>([]);
  const [summary, setSummary] = useState<DepartmentStaffApiSummary>({
    totalStaff: 0,
    activeStaff: 0,
    inactiveStaff: 0,
    activeTasks: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Inactive' | 'All'>('Active');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingStaff, setViewingStaff] = useState<DepartmentStaffApiItem | null>(null);
  const [editingStaff, setEditingStaff] = useState<DepartmentStaffApiItem | null>(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<DepartmentStaffApiItem | null>(null);
  const [activateConfirmId, setActivateConfirmId] = useState<DepartmentStaffApiItem | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<DepartmentStaffApiItem | null>(null);

  // Add Staff Form State
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addMobile, setAddMobile] = useState('');
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addConfirmPassword, setAddConfirmPassword] = useState('');
  const [addDesignation, setAddDesignation] = useState('Field Service Staff');
  const [addLanguage, setAddLanguage] = useState('en');
  const [submitting, setSubmitting] = useState(false);

  // Edit Staff Form State
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editLanguage, setEditLanguage] = useState('en');

  const loadStaffData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDepartmentStaffApi({
        status: statusFilter.toLowerCase(),
        search: searchQuery,
        department_id: userDeptId
      });
      setStaffList(res.staff);
      setSummary(res.summary);
    } catch (err: any) {
      console.error(err);
      setError('Unable to load department staff. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, userDeptId]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Handle Add Staff Submission
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addName.trim() || !addMobile.trim() || !addPassword) {
      setError('Name, mobile number, and password are required.');
      return;
    }

    if (addPassword !== addConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await createServiceStaffApi({
      name: addName.trim(),
      email: addEmail.trim() || undefined,
      mobile: addMobile.trim(),
      password: addPassword,
      employee_id: addEmployeeId.trim() || undefined,
      designation: addDesignation,
      language: addLanguage,
      department_id: userDeptId
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`✓ Staff member "${addName.trim()}" created successfully!`);
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddMobile('');
      setAddEmployeeId('');
      setAddPassword('');
      setAddConfirmPassword('');
      await loadStaffData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || 'Failed to create staff member.');
    }
  };

  // Handle Open Edit Modal
  const handleOpenEdit = (staff: DepartmentStaffApiItem) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditMobile(staff.contact_number || staff.mobile);
    setEditEmployeeId(staff.employee_id);
    setEditDesignation(staff.designation);
    setEditLanguage(staff.language || 'en');
  };

  // Handle Edit Submit
  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSubmitting(true);
    setError(null);

    const res = await updateServiceStaffApi(editingStaff.id, {
      name: editName.trim(),
      mobile: editMobile.trim(),
      employee_id: editEmployeeId.trim(),
      designation: editDesignation,
      language: editLanguage
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg(`✓ Staff member profile updated successfully!`);
      setEditingStaff(null);
      await loadStaffData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || 'Failed to update staff member.');
    }
  };

  // Handle Deactivate
  const handleDeactivate = async () => {
    if (!deactivateConfirmId) return;
    const ok = await deactivateServiceStaffApi(deactivateConfirmId.id);
    if (ok) {
      setSuccessMsg(`✓ Staff member "${deactivateConfirmId.name}" deactivated.`);
      setDeactivateConfirmId(null);
      await loadStaffData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to deactivate staff member.');
    }
  };

  // Handle Activate
  const handleActivate = async () => {
    if (!activateConfirmId) return;
    const ok = await activateServiceStaffApi(activateConfirmId.id);
    if (ok) {
      setSuccessMsg(`✓ Staff member "${activateConfirmId.name}" activated.`);
      setActivateConfirmId(null);
      await loadStaffData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to activate staff member.');
    }
  };

  // Handle Remove (Soft Delete)
  const handleRemove = async () => {
    if (!removeConfirmId) return;
    const ok = await removeServiceStaffApi(removeConfirmId.id);
    if (ok) {
      setSuccessMsg(`✓ Staff member "${removeConfirmId.name}" removed (Historical records preserved).`);
      setRemoveConfirmId(null);
      await loadStaffData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to remove staff member.');
    }
  };

  return (
    <DashboardLayout title="Staff Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">

        {/* HEADER SECTION */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Users className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                Staff
              </h1>
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Manage your department's service staff.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadStaffData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1.5 min-h-[42px]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setError(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center space-x-2 shadow-xs min-h-[42px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Staff</span>
            </button>
          </div>
        </div>

        {/* TOAST ALERTS */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-600 font-extrabold">✕</button>
          </div>
        )}

        {/* 1. SUMMARY CARDS (DYNAMIC FROM DB) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[11px] font-extrabold uppercase font-mono tracking-wider">Total Staff</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-2xl font-extrabold text-gray-900 font-outfit block">{summary.totalStaff}</span>
            <span className="text-[10px] text-gray-500 font-medium block">All registered department staff</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-1 bg-emerald-50/20">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-extrabold uppercase font-mono tracking-wider">Active Staff</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-extrabold text-emerald-700 font-outfit block">{summary.activeStaff}</span>
            <span className="text-[10px] text-emerald-800 font-medium block">Available for task assignment</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs space-y-1 bg-amber-50/20">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[11px] font-extrabold uppercase font-mono tracking-wider">Inactive Staff</span>
              <UserX className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-2xl font-extrabold text-amber-800 font-outfit block">{summary.inactiveStaff}</span>
            <span className="text-[10px] text-amber-800 font-medium block">Paused / On leave</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-1 bg-blue-50/20">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[11px] font-extrabold uppercase font-mono tracking-wider">Active Tasks</span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-extrabold text-blue-900 font-outfit block">{summary.activeTasks}</span>
            <span className="text-[10px] text-blue-800 font-medium block">Workload in field execution</span>
          </div>
        </div>

        {/* 2. SEARCH & STATUS FILTER TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search staff by name, employee ID, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
              />
            </div>

            <div className="flex items-center space-x-1.5 font-bold">
              {(['Active', 'Inactive', 'All'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-4 py-2 rounded-xl transition-all min-h-[38px] ${
                    statusFilter === st
                      ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. STAFF DIRECTORY TABLE / MOBILE CARDS */}
        {loading ? (
          <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading department staff records from database...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl space-y-3">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-extrabold text-gray-900 font-outfit">
              {statusFilter === 'Active' ? 'No Active Staff' : statusFilter === 'Inactive' ? 'No Inactive Staff' : 'No staff members found'}
            </h3>
            <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto">
              {statusFilter === 'Active'
                ? 'Add service staff to start assigning field tasks for your department.'
                : 'Try adjusting your search terms or filter selection.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white font-extrabold rounded-xl text-xs"
            >
              + Add Staff
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 uppercase font-mono text-[10px] font-extrabold text-gray-600">
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Employee ID</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">Designation</th>
                    <th className="p-3.5">Active Tasks</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  {staffList.map((staff) => {
                    const isActive = staff.status === 'Active';
                    const isInactive = staff.status === 'Inactive';
                    const isArchived = staff.status === 'Archived';

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs shrink-0 border border-emerald-200">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-gray-900 block text-xs">{staff.name}</span>
                              <span className="text-[11px] text-gray-500">{staff.email || 'No email registered'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-xs font-bold text-gray-800 whitespace-nowrap">
                          {staff.employee_id}
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-mono text-xs text-gray-700">
                          📞 {staff.contact_number || staff.mobile}
                        </td>

                        <td className="p-3.5 whitespace-nowrap font-semibold text-gray-800">
                          {staff.designation}
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold font-mono ${
                            staff.active_tasks > 0
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {staff.active_tasks} Active {staff.active_tasks === 1 ? 'Task' : 'Tasks'}
                          </span>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase font-mono ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isInactive
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {staff.status}
                          </span>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                          {/* VIEW BUTTON */}
                          <button
                            onClick={() => setViewingStaff(staff)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs inline-flex items-center space-x-1 min-h-[32px]"
                            title="View Staff Profile"
                            aria-label={`View profile for ${staff.name}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {/* EDIT BUTTON (for non-archived) */}
                          {!isArchived && (
                            <button
                              onClick={() => handleOpenEdit(staff)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs inline-flex items-center space-x-1 min-h-[32px]"
                              title="Edit Staff Member"
                              aria-label={`Edit ${staff.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* DEACTIVATE BUTTON */}
                          {isActive && (
                            <button
                              onClick={() => setDeactivateConfirmId(staff)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs inline-flex items-center space-x-1 min-h-[32px]"
                              title="Deactivate Staff"
                              aria-label={`Deactivate ${staff.name}`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Deactivate</span>
                            </button>
                          )}

                          {/* ACTIVATE BUTTON */}
                          {isInactive && (
                            <button
                              onClick={() => setActivateConfirmId(staff)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs inline-flex items-center space-x-1 min-h-[32px]"
                              title="Activate Staff"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </button>
                          )}

                          {/* REMOVE BUTTON */}
                          {!isArchived && (
                            <button
                              onClick={() => setRemoveConfirmId(staff)}
                              className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs inline-flex items-center space-x-1 min-h-[32px]"
                              title="Remove Staff"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* ADD STAFF MODAL */}
        {/* ================================================== */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleAddStaffSubmit} className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-gray-200 shadow-xl my-8 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <PlusCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Add Service Staff Member</h3>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AUTOMATIC DEPARTMENT LOCK NOTICE */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Assigned Department:</span>
                  <span className="font-mono bg-white px-2.5 py-0.5 rounded border border-emerald-300 text-emerald-900">
                    {userDeptName}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold font-mono">🔒 Auto-Locked</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amit Patil"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="amit.patil@nagarsetu.gov.in"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. PWD-STF-001"
                    value={addEmployeeId}
                    onChange={(e) => setAddEmployeeId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Staff login password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Confirm password"
                    value={addConfirmPassword}
                    onChange={(e) => setAddConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Designation</label>
                  <input
                    type="text"
                    value={addDesignation}
                    onChange={(e) => setAddDesignation(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Preferred Language</label>
                  <select
                    value={addLanguage}
                    onChange={(e) => setAddLanguage(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="mr">Marathi (मराठी)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-50 min-h-[42px]"
                >
                  {submitting ? 'Creating...' : '+ Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================================================== */}
        {/* VIEW STAFF DETAILS MODAL */}
        {/* ================================================== */}
        {viewingStaff && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm border border-emerald-200">
                    {viewingStaff.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 font-outfit text-base">{viewingStaff.name}</h3>
                    <span className="font-mono text-gray-500 text-[11px]">{viewingStaff.employee_id}</span>
                  </div>
                </div>
                <button onClick={() => setViewingStaff(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-[11px] border border-gray-200">
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Department</span>
                  <span className="font-extrabold text-gray-900">{viewingStaff.department_name}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Designation</span>
                  <span className="font-bold text-gray-900">{viewingStaff.designation}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Mobile</span>
                  <span className="font-mono text-gray-800">{viewingStaff.contact_number || viewingStaff.mobile}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Email</span>
                  <span className="font-mono text-gray-800">{viewingStaff.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Role</span>
                  <span className="font-bold text-gray-900">Service Staff (Field Operations)</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 uppercase block text-[9px] font-mono">Account Status</span>
                  <span className={`font-extrabold uppercase font-mono ${viewingStaff.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {viewingStaff.status}
                  </span>
                </div>
              </div>

              {/* WORKLOAD STATS */}
              {(() => {
                const currentStaff = staffList.find((s) => s.id === viewingStaff.id || s.employee_id === viewingStaff.employee_id) || viewingStaff;
                return (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-[10px] font-extrabold uppercase font-mono text-blue-800 block">Active Tasks</span>
                      <span className="text-lg font-extrabold text-blue-900 font-mono">{currentStaff.active_tasks || 0}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-extrabold uppercase font-mono text-emerald-800 block">Completed</span>
                      <span className="text-lg font-extrabold text-emerald-900 font-mono">{currentStaff.completed_tasks || 0}</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                      <span className="text-[10px] font-extrabold uppercase font-mono text-rose-800 block">Overdue</span>
                      <span className="text-lg font-extrabold text-rose-900 font-mono">{currentStaff.overdue_tasks || 0}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewingStaff(null)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* EDIT STAFF MODAL */}
        {/* ================================================== */}
        {editingStaff && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleEditStaffSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Edit Staff Member Profile</h3>
                <button type="button" onClick={() => setEditingStaff(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Designation</label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold min-h-[42px]"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DEACTIVATE CONFIRMATION MODAL */}
        {deactivateConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-amber-700 border-b border-gray-200 pb-3">
                <UserX className="w-5 h-5" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Deactivate Staff Member?</h3>
              </div>
              <p className="text-gray-700 font-medium leading-relaxed">
                <strong>{deactivateConfirmId.name}</strong> will no longer receive new task assignments for {userDeptName}. Existing work history will be preserved.
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setDeactivateConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold min-h-[42px]"
                >
                  Deactivate Staff
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVATE CONFIRMATION MODAL */}
        {activateConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-emerald-700 border-b border-gray-200 pb-3">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Activate Staff Member?</h3>
              </div>
              <p className="text-gray-700 font-medium leading-relaxed">
                <strong>{activateConfirmId.name}</strong> will become available for new task assignments in {userDeptName}.
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setActivateConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivate}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold min-h-[42px]"
                >
                  Activate Staff
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REMOVE CONFIRMATION MODAL */}
        {removeConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-rose-600 border-b border-gray-200 pb-3">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Remove Staff Member?</h3>
              </div>
              <div className="space-y-2 text-gray-700 font-medium text-xs">
                <p><strong>Employee:</strong> {removeConfirmId.name}</p>
                <p><strong>Employee ID:</strong> {removeConfirmId.employee_id}</p>
                <p className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px]">
                  ⚠️ Warning: This will remove the staff member from active staff management. Historical task and complaint records will be preserved.
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setRemoveConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold min-h-[42px]"
                >
                  Remove Staff
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
