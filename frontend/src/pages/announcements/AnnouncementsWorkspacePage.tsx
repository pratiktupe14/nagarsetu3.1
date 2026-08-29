import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  getDepartmentHeadAnnouncements,
  getAdminAnnouncements,
  createGenericAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  markAnnouncementAsRead,
  AnnouncementItem,
  AnnouncementType,
  AnnouncementPriorityLevel,
  AnnouncementStatus
} from '../../services/announcementService';
import {
  Megaphone, PlusCircle, Search, Filter, RefreshCw, CheckCircle2,
  AlertTriangle, Edit3, Trash2, ShieldAlert, Clock, Eye, Lock, X, Users,
  Building2, Calendar, FileText, Check, ChevronRight
} from 'lucide-react';

const DEPARTMENTS_LIST = [
  { id: '1', name: 'Public Works Department (PWD)', code: 'PWD' },
  { id: '2', name: 'Sanitation & Waste Management', code: 'SAN' },
  { id: '3', name: 'Water Supply & Sewerage Board', code: 'WTR' },
  { id: '4', name: 'Drainage & Sewage Department', code: 'DRN' },
  { id: '5', name: 'Electrical & Street Lighting', code: 'ELE' },
  { id: '6', name: 'Traffic Management Department', code: 'TRF' },
  { id: '7', name: 'Maintenance Department', code: 'MNT' }
];

export const AnnouncementsWorkspacePage: React.FC = () => {
  const { user, role } = useAuth();
  const activeRole = role || user?.role || 'citizen';
  const isAdmin = ['admin', 'city_admin'].includes(activeRole);
  const isDeptHead = activeRole === 'department_head';
  const isStaff = activeRole === 'service_staff';
  const isCitizen = activeRole === 'citizen';
  const canCreate = isAdmin || isDeptHead;

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AnnouncementItem | null>(null);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State for Creation
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AnnouncementType>('General');
  const [priority, setPriority] = useState<AnnouncementPriorityLevel>('Medium');
  const [status, setStatus] = useState<AnnouncementStatus>('Published');
  const [targetAudience, setTargetAudience] = useState<string>('all_citizens');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('1');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: AnnouncementItem[] = [];
      if (isAdmin) {
        data = await getAdminAnnouncements();
      } else {
        data = await getDepartmentHeadAnnouncements();
      }
      setAnnouncements(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch announcements.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Open Detail and Mark as Read
  const handleOpenDetail = async (ann: AnnouncementItem) => {
    setSelectedDetail(ann);
    if (!ann.is_read) {
      await markAnnouncementAsRead(ann.id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? { ...a, is_read: true } : a))
      );
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    let targetType: 'all' | 'department' = 'all';
    let deptId: string | null = null;
    let deptName: string | undefined = undefined;

    if (isAdmin) {
      if (targetAudience === 'specific_department') {
        targetType = 'department';
        const match = DEPARTMENTS_LIST.find((d) => d.id === selectedDeptId);
        deptId = selectedDeptId;
        deptName = match ? match.name : 'Public Works Department (PWD)';
      }
    } else if (isDeptHead) {
      targetType = 'department';
      deptId = String(user?.department_id || '1');
      deptName = user?.department_name || 'My Department';
    }

    const res = await createGenericAnnouncement({
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      status,
      target_audience: targetAudience,
      target_type: targetType,
      department_id: deptId,
      department_name: deptName,
      expires_at: expiresAt || null
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg('✓ Announcement published successfully!');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setExpiresAt('');
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError(res.error || 'Failed to publish announcement.');
    }
  };

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn) return;

    setSubmitting(true);
    const ok = await updateAdminAnnouncement(editingAnn.id, {
      title: editingAnn.title,
      description: editingAnn.description,
      type: editingAnn.type,
      priority: editingAnn.priority,
      status: editingAnn.status,
      expires_at: editingAnn.expires_at
    });
    setSubmitting(false);

    if (ok) {
      setSuccessMsg('✓ Announcement updated successfully!');
      setEditingAnn(null);
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to update announcement.');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const ok = await deleteAdminAnnouncement(id);
    if (ok) {
      setSuccessMsg('✓ Announcement archived successfully!');
      setDeleteConfirmId(null);
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to archive announcement.');
    }
  };

  // Filtered List
  const filteredAnnouncements = announcements.filter((ann) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ann.title.toLowerCase().includes(q) ||
      ann.description.toLowerCase().includes(q) ||
      (ann.department_name && ann.department_name.toLowerCase().includes(q)) ||
      (ann.posted_by && ann.posted_by.toLowerCase().includes(q));

    const matchesStatus =
      selectedStatus === 'All'
        ? true
        : selectedStatus === 'Unread'
        ? !ann.is_read
        : ann.status === selectedStatus;

    const matchesType = selectedType === 'All' || ann.type === selectedType;
    const matchesPriority = selectedPriority === 'All' || ann.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  const unreadCount = announcements.filter((a) => !a.is_read).length;

  return (
    <DashboardLayout title="Announcements">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER SECTION */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Megaphone className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                Announcements
              </h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[11px] animate-pulse">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Create, publish and manage important civic updates.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadAnnouncements}
              disabled={loading}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1.5 min-h-[42px]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {canCreate && (
              <button
                onClick={() => {
                  setError(null);
                  setShowCreateModal(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center space-x-2 shadow-xs min-h-[42px]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Create Announcement</span>
              </button>
            )}
          </div>
        </div>

        {/* SUCCESS & ERROR MESSAGES */}
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

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search announcements by title, description, department or publisher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 font-medium min-h-[42px]"
              />
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-bold text-gray-800 focus:outline-none focus:border-emerald-600 min-h-[42px]"
              >
                <option value="All">Type: All</option>
                <option value="General">General</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
                <option value="Emergency">Emergency</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Service Update">Service Update</option>
                <option value="System Update">System Update</option>
                <option value="Public Notice">Public Notice</option>
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 font-bold text-gray-800 focus:outline-none focus:border-emerald-600 min-h-[42px]"
              >
                <option value="All">Priority: All</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-1 border-t border-gray-100 pt-3 overflow-x-auto font-bold text-xs">
            {['All', 'Unread', 'Published', 'Draft', 'Scheduled', 'Expired', 'Archived'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap min-h-[38px] ${
                  selectedStatus === st
                    ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {st === 'Unread' ? `Unread (${unreadCount})` : st}
              </button>
            ))}
          </div>
        </div>

        {/* ANNOUNCEMENT CARDS GRID */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-12 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 space-y-3">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-base font-extrabold text-gray-900 font-outfit">No announcements found</h3>
            <p className="text-xs text-gray-500">Try adjusting your search terms or filter selection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnnouncements.map((ann) => {
              const isUnread = !ann.is_read;

              return (
                <div
                  key={ann.id}
                  onClick={() => handleOpenDetail(ann)}
                  className={`bg-white rounded-2xl border p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 relative ${
                    isUnread ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* CARD HEADER BADGES */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                        ann.priority === 'Critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : ann.priority === 'High'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        {ann.priority} Priority
                      </span>

                      <div className="flex items-center space-x-1">
                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>● NEW</span>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold">
                          {ann.type}
                        </span>
                      </div>
                    </div>

                    {/* TITLE */}
                    <h3 className="font-extrabold text-gray-900 text-sm font-outfit line-clamp-2 leading-snug">
                      📢 {ann.title}
                    </h3>

                    {/* DESCRIPTION */}
                    <p className="text-xs text-gray-600 font-medium line-clamp-3 leading-relaxed">
                      {ann.description}
                    </p>
                  </div>

                  {/* CARD FOOTER */}
                  <div className="pt-3 border-t border-gray-100 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-gray-500 font-medium">
                      <span className="font-bold text-gray-800 truncate">
                        🏢 {ann.department_name || 'All Departments'}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400">
                        {new Date(ann.published_at || ann.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-gray-400 font-medium">
                        By {ann.posted_by}
                      </span>

                      {(isAdmin || (isDeptHead && ann.department_id === String(user?.department_id))) && (
                        <div className="flex items-center space-x-1 z-10" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditingAnn(ann)}
                            className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                            title="Edit"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(ann.id)}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700"
                            title="Archive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================================================== */}
        {/* CREATE ANNOUNCEMENT MODAL */}
        {/* ================================================== */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-gray-200 shadow-xl my-8 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <Megaphone className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Create Announcement</h3>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward 5 Water Pipeline Repairs Advisory"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium min-h-[42px]"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter full announcement message..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AnnouncementType)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                  >
                    <option value="General">General</option>
                    <option value="Important">Important</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Service Update">Service Update</option>
                    <option value="System Update">System Update</option>
                    <option value="Public Notice">Public Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Priority *</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPriorityLevel)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              {/* TARGET AUDIENCE SELECTION BASED ON ROLE */}
              <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-3">
                <span className="font-extrabold text-gray-900 uppercase font-mono text-[11px] block">Target Audience Routing</span>

                {isAdmin ? (
                  <div className="space-y-3">
                    <label className="block font-bold text-gray-800">Select Audience *</label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold min-h-[42px]"
                    >
                      <option value="all_citizens">All Citizens</option>
                      <option value="all_dept_heads">All Department Heads</option>
                      <option value="all_staff">All Service Staff</option>
                      <option value="all_departments">All 7 Departments (Global)</option>
                      <option value="specific_department">Specific Department</option>
                    </select>

                    {targetAudience === 'specific_department' && (
                      <div className="pt-1">
                        <label className="block font-bold text-gray-700 mb-1">Target Department *</label>
                        <select
                          value={selectedDeptId}
                          onChange={(e) => setSelectedDeptId(e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-extrabold text-emerald-800 min-h-[42px]"
                        >
                          {DEPARTMENTS_LIST.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code} - {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs text-gray-700 font-bold mb-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Department Head Authorization Locked to: </span>
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                        {user?.department_name || 'My Department'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 p-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer font-bold text-gray-800">
                        <input
                          type="radio"
                          name="deptHeadTarget"
                          checked={targetAudience === 'citizens'}
                          onChange={() => setTargetAudience('citizens')}
                          className="text-emerald-600"
                        />
                        <span>Citizens</span>
                      </label>

                      <label className="flex items-center space-x-2 p-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer font-bold text-gray-800">
                        <input
                          type="radio"
                          name="deptHeadTarget"
                          checked={targetAudience === 'department'}
                          onChange={() => setTargetAudience('department')}
                          className="text-emerald-600"
                        />
                        <span>My Department</span>
                      </label>

                      <label className="flex items-center space-x-2 p-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer font-bold text-gray-800">
                        <input
                          type="radio"
                          name="deptHeadTarget"
                          checked={targetAudience === 'staff'}
                          onChange={() => setTargetAudience('staff')}
                          className="text-emerald-600"
                        />
                        <span>Service Staff</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-50 min-h-[42px]"
                >
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================================================== */}
        {/* ANNOUNCEMENT DETAIL MODAL */}
        {/* ================================================== */}
        {selectedDetail && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <Megaphone className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Announcement Details</h3>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                    {selectedDetail.type}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold uppercase font-mono">
                    {selectedDetail.priority} Priority
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">
                    Target: {selectedDetail.target_audience || selectedDetail.target_type}
                  </span>
                </div>

                <h2 className="text-lg font-extrabold text-gray-900 font-outfit">
                  📢 {selectedDetail.title}
                </h2>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 leading-relaxed text-gray-800 font-medium whitespace-pre-wrap">
                  {selectedDetail.description}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="font-bold block text-gray-500 uppercase font-mono text-[9px]">Department</span>
                    <span className="font-bold text-gray-900">{selectedDetail.department_name || 'All Departments'}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 uppercase font-mono text-[9px]">Published By</span>
                    <span className="font-bold text-gray-900">{selectedDetail.posted_by}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 uppercase font-mono text-[9px]">Published Date</span>
                    <span className="font-mono text-gray-800">{new Date(selectedDetail.published_at || selectedDetail.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 uppercase font-mono text-[9px]">Read Status</span>
                    <span className="font-bold text-emerald-700">✓ Marked as Read</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedDetail(null)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE / ARCHIVE CONFIRMATION MODAL */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-rose-600 border-b border-gray-200 pb-3">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Archive Announcement</h3>
              </div>
              <p className="text-gray-700 font-medium">Are you sure you want to archive this announcement? It will no longer appear in active feeds.</p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAnnouncement(deleteConfirmId)}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
