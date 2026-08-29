import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  getAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  AnnouncementItem,
  AnnouncementType,
  AnnouncementPriorityLevel
} from '../../services/announcementService';
import {
  Megaphone, PlusCircle, Trash2, Edit3, CheckCircle2,
  AlertTriangle, RefreshCw, Layers, ShieldAlert, Lock, Check, X
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

export const AdminAnnouncementsPage: React.FC = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annDesc, setAnnDesc] = useState('');
  const [annType, setAnnType] = useState<AnnouncementType>('General');
  const [annPriority, setAnnPriority] = useState<AnnouncementPriorityLevel>('Medium');
  const [targetType, setTargetType] = useState<'all' | 'department'>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('1');
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal State
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annDesc.trim()) {
      setError('Title and description are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    let deptName = 'All Departments';
    let deptId = null;

    if (targetType === 'department') {
      const match = DEPARTMENTS_LIST.find((d) => d.id === selectedDeptId);
      deptName = match ? match.name : 'Public Works Department (PWD)';
      deptId = selectedDeptId;
    }

    const res = await createAdminAnnouncement({
      title: annTitle.trim(),
      description: annDesc.trim(),
      type: annType,
      priority: annPriority,
      target_type: targetType,
      department_id: deptId,
      department_name: deptName,
      is_published: isPublished
    });

    setSubmitting(false);

    if (res.success) {
      setSuccessMsg('✓ Announcement published successfully!');
      setShowCreateModal(false);
      setAnnTitle('');
      setAnnDesc('');
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
      target_type: editingAnn.target_type,
      department_id: editingAnn.department_id,
      department_name: editingAnn.department_name,
      is_published: editingAnn.is_published
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
      setSuccessMsg('✓ Announcement deleted successfully!');
      setDeleteConfirmId(null);
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setError('Failed to delete announcement.');
    }
  };

  return (
    <DashboardLayout title="City Administration - Municipal Announcements">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Megaphone className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                Municipal Announcements Management
              </h1>
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Publish citywide emergency notices or department-specific advisories to Department Head Portals.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadAnnouncements}
              disabled={loading}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                setError(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center space-x-2 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Announcement</span>
            </button>
          </div>
        </div>

        {/* TOAST NOTIFICATIONS */}
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

        {/* ANNOUNCEMENTS DIRECTORY TABLE */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-white space-y-0">
          <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-sm font-outfit">
              Published & Draft Advisories ({announcements.length})
            </h3>
            <span className="text-[11px] font-mono font-bold text-gray-500">
              Citywide Admin Directory
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-500 font-medium">
              Loading announcements database state...
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500 space-y-2">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-bold text-gray-800">No announcements published yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs"
              >
                + Create First Announcement
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 uppercase font-mono text-[10px] font-extrabold text-gray-600">
                    <th className="p-3.5">Announcement Title & Details</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Target Audience</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {announcements.map((ann) => (
                    <tr key={ann.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-extrabold text-gray-900 block text-xs">📢 {ann.title}</span>
                        <p className="text-[11px] text-gray-500 font-medium line-clamp-1 max-w-lg mt-0.5">
                          {ann.description}
                        </p>
                        <span className="text-[10px] text-gray-400 font-mono block mt-1">
                          Posted by {ann.posted_by} • {new Date(ann.published_at || ann.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold">
                        <span className="px-2.5 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-800 text-[11px]">
                          {ann.type}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono uppercase ${
                          ann.priority === 'Critical' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          ann.priority === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {ann.priority}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold">
                        <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                          {ann.target_type === 'all' ? 'All 7 Departments' : ann.department_name}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {ann.is_published ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold font-mono">
                            PUBLISHED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold font-mono">
                            DRAFT
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => setEditingAnn(ann)}
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                          title="Edit Announcement"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(ann.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* CREATE ANNOUNCEMENT MODAL */}
        {/* ================================================== */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-gray-200 shadow-xl my-8 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2 text-emerald-700">
                  <Megaphone className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-gray-900 font-outfit text-base">Create Municipal Announcement</h3>
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
                  placeholder="e.g. Ward 5 Asphalt Resurfacing & Maintenance Advisory"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter full advisory details for targeted Department Heads..."
                  value={annDesc}
                  onChange={(e) => setAnnDesc(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Announcement Type *</label>
                  <select
                    value={annType}
                    onChange={(e) => setAnnType(e.target.value as AnnouncementType)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold"
                  >
                    <option value="General">General Notice</option>
                    <option value="Important">Important Advisory</option>
                    <option value="Urgent">Urgent Action</option>
                    <option value="Maintenance">Maintenance Schedule</option>
                    <option value="System Update">System Update</option>
                    <option value="Emergency">Emergency Protocol</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Priority Level *</label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as AnnouncementPriorityLevel)}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              {/* TARGET AUDIENCE SELECTION */}
              <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-3">
                <span className="font-extrabold text-gray-900 uppercase font-mono text-[11px] block">Target Audience Routing</span>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 font-bold text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>All 7 Departments (Global)</span>
                  </label>

                  <label className="flex items-center space-x-2 font-bold text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'department'}
                      onChange={() => setTargetType('department')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Specific Department Only</span>
                  </label>
                </div>

                {targetType === 'department' && (
                  <div className="pt-2">
                    <label className="block font-bold text-gray-700 mb-1">Select Target Department *</label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-extrabold text-emerald-800"
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

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <label className="flex items-center space-x-2 font-extrabold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Publish Immediately</span>
                </label>

                <div className="flex items-center space-x-3">
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
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-50"
                  >
                    {submitting ? 'Publishing...' : 'Publish Announcement'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingAnn && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <form onSubmit={handleUpdateAnnouncement} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-gray-200 shadow-xl my-8 text-xs font-sans">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Edit Municipal Announcement</h3>
                <button type="button" onClick={() => setEditingAnn(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  value={editingAnn.title}
                  onChange={(e) => setEditingAnn({ ...editingAnn, title: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="block font-extrabold text-gray-800 mb-1">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={editingAnn.description}
                  onChange={(e) => setEditingAnn({ ...editingAnn, description: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Type</label>
                  <select
                    value={editingAnn.type}
                    onChange={(e) => setEditingAnn({ ...editingAnn, type: e.target.value as AnnouncementType })}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold"
                  >
                    <option value="General">General Notice</option>
                    <option value="Important">Important Advisory</option>
                    <option value="Urgent">Urgent Action</option>
                    <option value="Maintenance">Maintenance Schedule</option>
                    <option value="System Update">System Update</option>
                    <option value="Emergency">Emergency Protocol</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-gray-800 mb-1">Priority</label>
                  <select
                    value={editingAnn.priority}
                    onChange={(e) => setEditingAnn({ ...editingAnn, priority: e.target.value as AnnouncementPriorityLevel })}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingAnn(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DELETE CONFIRM MODAL */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200 shadow-xl text-xs font-sans">
              <div className="flex items-center space-x-2 text-rose-600 border-b border-gray-200 pb-3">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-extrabold text-gray-900 font-outfit text-base">Delete Announcement</h3>
              </div>
              <p className="text-gray-700 font-medium">Are you sure you want to delete this municipal announcement? This action cannot be undone.</p>
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
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
