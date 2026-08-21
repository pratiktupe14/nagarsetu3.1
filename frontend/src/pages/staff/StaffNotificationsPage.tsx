import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import {
  getNotificationsForRole, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead, getStoredNotifications, saveStoredNotifications
} from '../../services/notificationService';
import {
  getStaffTasks, acceptStaffTask, startStaffTravel, startStaffWork,
  submitStaffResolution, getComplaintById
} from '../../services/complaintService';
import { formatSlaRemainingTime, logActivity } from '../../services/adminService';
import { NotificationItem, NotificationType, Complaint, ComplaintStatus } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Bell, Check, CheckCheck, Clock, ShieldCheck, AlertTriangle, FileText,
  Wrench, CheckCircle2, RotateCcw, Zap, ExternalLink, Filter, Search,
  RefreshCw, Building2, Users, Star, Layers, Sparkles, X, ChevronRight,
  User, Lock, Navigation, Play, Camera, Upload
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<NotificationType, { icon: React.ReactNode; color: string; badge: string }> = {
  submitted: { icon: <FileText className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'New Task' },
  verified: { icon: <ShieldCheck className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'Verified' },
  approved: { icon: <Zap className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Approved' },
  department_assigned: { icon: <Building2 className="w-4 h-4 text-sky-600" />, color: 'bg-sky-50 border-sky-200', badge: 'Dept Assigned' },
  staff_assigned: { icon: <Wrench className="w-4 h-4 text-cyan-600" />, color: 'bg-cyan-50 border-cyan-200', badge: 'New Assignment' },
  work_started: { icon: <Wrench className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-200', badge: 'Work In Progress' },
  resolution_submitted: { icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />, color: 'bg-purple-50 border-purple-200', badge: 'Proof Submitted' },
  resolved: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Work Verified' },
  reopened: { icon: <RotateCcw className="w-4 h-4 text-orange-600" />, color: 'bg-orange-50 border-orange-200', badge: 'Task Reopened' },
  critical: { icon: <AlertTriangle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-300', badge: 'Critical Hazard' },
  sla_warning: { icon: <Clock className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-300', badge: 'SLA Approaching' },
  sla_breached: { icon: <AlertTriangle className="w-4 h-4 text-rose-700" />, color: 'bg-rose-100 border-rose-400', badge: 'SLA Overdue' }
};

// SEED NOTIFICATIONS FOR SERVICE STAFF WORKUPDATES IF FEW EXIST
const SEED_STAFF_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'staff-notif-1',
    user_id: 'staff-101',
    role: 'service_staff',
    complaint_id: 'comp-101',
    complaint_number: 'NS-2026-100234',
    type: 'staff_assigned',
    title: 'New Civic Task Assigned to You',
    message: 'Complaint NS-2026-100234 (Road Pothole on Station Road) has been assigned to you.',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString()
  },
  {
    id: 'staff-notif-2',
    user_id: 'staff-101',
    role: 'service_staff',
    complaint_id: 'comp-103',
    complaint_number: 'NS-2026-000189',
    type: 'sla_warning',
    title: 'SLA Due Soon Alert',
    message: 'Complaint NS-2026-000189 is due in 1 hour. Please prioritize field completion.',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 3.5).toISOString()
  },
  {
    id: 'staff-notif-3',
    user_id: 'staff-101',
    role: 'service_staff',
    complaint_id: 'comp-104',
    complaint_number: 'NS-2026-000210',
    type: 'sla_breached',
    title: 'Task Overdue SLA Alert',
    message: 'Complaint NS-2026-000210 has exceeded its SLA deadline.',
    is_read: false,
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'staff-notif-4',
    user_id: 'staff-101',
    role: 'service_staff',
    complaint_id: 'comp-102',
    complaint_number: 'NS-2026-100567',
    type: 'resolved',
    title: 'Work Verified & Approved',
    message: 'Your completed repair work for NS-2026-100567 has been verified by City Admin.',
    is_read: true,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

export const StaffNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Staff Identity
  const staffName = user?.full_name || 'Field Officer';
  const staffEmployeeId = 'STF-0012';
  const staffDepartment = 'Roads / PWD';
  const staffDepartmentFull = 'Roads & Public Works (PWD)';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Unread' | 'Read' | 'Task Updates' | 'SLA Alerts' | 'Admin Messages' | 'System' | 'Critical'>('All');

  // Task Detail Modal State
  const [detailModalTask, setDetailModalTask] = useState<Complaint | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [submittingProgressNote, setSubmittingProgressNote] = useState(false);
  const [photoAfterFile, setPhotoAfterFile] = useState<File | null>(null);
  const [photoAfterPreview, setPhotoAfterPreview] = useState<string>('');
  const [workNotes, setWorkNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Load Notifications for Staff
  const loadNotifications = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      let list = getNotificationsForRole(user?.id || 'staff-101', 'service_staff');
      
      // Ensure seed staff notifications exist if list is sparse
      const existingIds = new Set(list.map((n) => n.id));
      const missingSeeds = SEED_STAFF_NOTIFICATIONS.filter((s) => !existingIds.has(s.id));
      if (missingSeeds.length > 0) {
        const allStored = getStoredNotifications();
        const merged = [...missingSeeds, ...allStored];
        saveStoredNotifications(merged);
        list = getNotificationsForRole(user?.id || 'staff-101', 'service_staff');
      }

      setNotifications(list);
    } catch (e) {
      console.error(e);
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useRealtimeComplaints(useCallback(() => {
    loadNotifications();
  }, [loadNotifications]));

  // Handlers for Read/Unread Status
  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markNotificationAsRead(id);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead(user?.id || 'staff-101', 'service_staff');
    loadNotifications();
  };

  // Open Complaint Modal from Notification
  const handleOpenTaskDetail = async (complaintId?: string) => {
    if (!complaintId) return;
    try {
      const task = await getComplaintById(complaintId);
      if (task) {
        setDetailModalTask(task);
      } else {
        navigate('/staff/tasks');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Metrics Bar
  const metrics = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.is_read).length;
    const taskUpdates = notifications.filter(
      (n) => n.type === 'staff_assigned' || n.type === 'department_assigned' || n.type === 'work_started' || n.type === 'resolution_submitted'
    ).length;
    const slaAlerts = notifications.filter((n) => n.type === 'sla_warning' || n.type === 'sla_breached').length;
    const critical = notifications.filter((n) => n.type === 'critical' || n.type === 'sla_breached').length;

    return { total, unread, taskUpdates, slaAlerts, critical };
  }, [notifications]);

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab Filter
      if (activeTab === 'Unread' && n.is_read) return false;
      if (activeTab === 'Read' && !n.is_read) return false;
      if (activeTab === 'Task Updates' && !(n.type === 'staff_assigned' || n.type === 'department_assigned' || n.type === 'work_started' || n.type === 'resolution_submitted' || n.type === 'resolved')) return false;
      if (activeTab === 'SLA Alerts' && !(n.type === 'sla_warning' || n.type === 'sla_breached')) return false;
      if (activeTab === 'Admin Messages' && !(n.type === 'work_started' || n.type === 'department_assigned')) return false;
      if (activeTab === 'Critical' && !(n.type === 'critical' || n.type === 'sla_breached')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesMsg = n.message.toLowerCase().includes(q);
        const matchesComp = (n.complaint_number || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg && !matchesComp) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  // Date Grouping (Today, Yesterday, Earlier This Week, Older)
  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 86400000 * 7;

    const groups: { label: string; items: NotificationItem[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Earlier This Week', items: [] },
      { label: 'Older', items: [] }
    ];

    filteredNotifications.forEach((n) => {
      const time = new Date(n.created_at).getTime();
      if (time >= startOfToday) {
        groups[0].items.push(n);
      } else if (time >= startOfYesterday) {
        groups[1].items.push(n);
      } else if (time >= startOfWeek) {
        groups[2].items.push(n);
      } else {
        groups[3].items.push(n);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [filteredNotifications]);

  // Field Status Lifecycle Actions in Modal
  const handleStatusTransition = async (taskId: string, newStatus: ComplaintStatus) => {
    try {
      if (newStatus === 'Accepted') await acceptStaffTask(taskId);
      else if (newStatus === 'On the Way') await startStaffTravel(taskId);
      else if (newStatus === 'In Progress') await startStaffWork(taskId);

      const updatedTask = await getComplaintById(taskId);
      setDetailModalTask(updatedTask);
      loadNotifications();
    } catch (err) {
      console.error(err);
      alert('Error updating task status.');
    }
  };

  const handleAddProgressNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailModalTask || !progressNote.trim()) return;

    setSubmittingProgressNote(true);
    try {
      logActivity(
        detailModalTask.id,
        staffName,
        'Field Work Progress Update',
        detailModalTask.status,
        detailModalTask.status,
        progressNote.trim()
      );
      setProgressNote('');
      const updatedTask = await getComplaintById(detailModalTask.id);
      setDetailModalTask(updatedTask);
    } catch (err) {
      console.error(err);
      alert('Error posting update.');
    } finally {
      setSubmittingProgressNote(false);
    }
  };

  const handleSubmitResolutionProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailModalTask || !photoAfterPreview) {
      alert('Please upload or select an "AFTER" repair proof photo.');
      return;
    }

    setSubmittingResolution(true);
    try {
      await submitStaffResolution(
        detailModalTask.id,
        photoAfterPreview,
        workNotes || 'Field maintenance work completed.',
        materialsUsed || 'Standard repair materials & asphalt'
      );

      setDetailModalTask(null);
      setPhotoAfterFile(null);
      setPhotoAfterPreview('');
      setWorkNotes('');
      setMaterialsUsed('');
      loadNotifications();
    } catch (err) {
      console.error(err);
      alert('Error submitting resolution proof.');
    } finally {
      setSubmittingResolution(false);
    }
  };

  return (
    <DashboardLayout title="Notifications">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* ================================================== */}
        {/* 2. PAGE HEADER WITH MARK ALL READ & REFRESH */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Notifications
              </h1>
              {metrics.unread > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                  {metrics.unread} Unread
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Stay updated with your assigned tasks, deadlines and municipal work updates.
            </p>
          </div>

          {/* RIGHT SIDE ACTIONS & LOCKED IDENTITY */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-2 px-3 flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-extrabold text-gray-900 font-outfit">{staffName}</span>
              </div>
              <div className="h-4 w-px bg-gray-300" />
              <div className="flex items-center space-x-1 text-gray-600">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold">{staffDepartment}</span>
                <Lock className="w-3 h-3 text-gray-400" />
              </div>
            </div>

            <button
              onClick={handleMarkAllAsRead}
              disabled={metrics.unread === 0}
              className="px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-slate-50 font-bold text-xs transition-colors flex items-center space-x-1.5 min-h-[44px] disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Mark All as Read</span>
            </button>

            <button
              onClick={loadNotifications}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white text-gray-700 border border-gray-300 hover:bg-slate-50 transition-colors min-h-[44px]"
              title="Refresh Notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

          </div>
        </div>

        {/* ================================================== */}
        {/* 3. SUMMARY METRICS BAR */}
        {/* ================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
          
          <div className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">All Notifications</span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">{metrics.total}</span>
          </div>

          <div className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Unread</span>
            <span className="text-xl font-extrabold text-blue-700 font-mono block">{metrics.unread}</span>
          </div>

          <div className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Task Updates</span>
            <span className="text-xl font-extrabold text-amber-700 font-mono block">{metrics.taskUpdates}</span>
          </div>

          <div className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">SLA Alerts</span>
            <span className="text-xl font-extrabold text-orange-700 font-mono block">{metrics.slaAlerts}</span>
          </div>

          <div className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical</span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">{metrics.critical}</span>
          </div>

        </div>

        {/* ================================================== */}
        {/* 4. FILTERS & SEARCH */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['All', 'Unread', 'Read', 'Task Updates', 'SLA Alerts', 'Admin Messages', 'Critical'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-mono transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-emerald-800 shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* ================================================== */}
        {/* 5, 10. NOTIFICATION LIST GROUPED BY DATE */}
        {/* ================================================== */}
        {loading ? (
          /* 14. LOADING STATE */
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          /* 15. ERROR STATE */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">{error}</h3>
            <button
              onClick={loadNotifications}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* 13. EMPTY STATE */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3 font-sans">
            <Bell className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-gray-900 font-outfit">No Notifications</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You're all caught up. New task and work updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedNotifications.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex items-center space-x-2 border-b border-gray-200 pb-1.5">
                  <span className="text-xs font-extrabold uppercase font-outfit tracking-wider text-gray-600">
                    {group.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-gray-700">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.items.map((n) => {
                    const iconConfig = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.submitted;
                    const isCritical = n.type === 'critical' || n.type === 'sla_breached';

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id)}
                        className={`p-4 rounded-xl border transition-all relative space-y-2 ${
                          isCritical
                            ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
                            : !n.is_read
                            ? 'bg-emerald-50/20 border-emerald-300 shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        {/* UNREAD INDICATOR DOT */}
                        {!n.is_read && (
                          <div className="absolute top-4 left-2 w-2 h-2 rounded-full bg-emerald-600" title="Unread notification" />
                        )}

                        <div className="flex items-start justify-between gap-3 pl-3">
                          <div className="flex items-start space-x-3">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${iconConfig.color}`}>
                              {iconConfig.icon}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs ${!n.is_read ? 'font-extrabold text-gray-900' : 'font-bold text-gray-800'}`}>
                                  {n.title}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-white border border-gray-200 text-gray-700">
                                  {iconConfig.badge}
                                </span>
                                {n.complaint_number && (
                                  <span className="font-mono text-xs font-extrabold text-emerald-700">
                                    {n.complaint_number}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-gray-600 leading-relaxed">
                                {n.message}
                              </p>

                              <div className="flex items-center space-x-3 text-[11px] text-gray-500 font-mono pt-1">
                                <span>{new Date(n.created_at).toLocaleString()}</span>
                                <span>•</span>
                                <span>{staffDepartment}</span>
                              </div>
                            </div>
                          </div>

                          {/* ACTIONS */}
                          <div className="flex items-center space-x-2 shrink-0">
                            {n.complaint_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(n.id);
                                  handleOpenTaskDetail(n.complaint_id);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center space-x-1 min-h-[36px]"
                              >
                                <span>View Task</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!n.is_read && (
                              <button
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                className="p-2 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                title="Mark as Read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================================================== */}
        {/* TASK DETAIL & EXECUTION MODAL (REUSED) */}
        {/* ================================================== */}
        {detailModalTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs overflow-y-auto font-sans">
            <div className="max-w-3xl w-full bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-md my-8 space-y-6 max-h-[90vh] overflow-y-auto">
              
              {/* MODAL HEADER */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      {detailModalTask.complaint_number}
                    </span>
                    <StatusBadge status={detailModalTask.status} />
                    <PriorityBadge priority={detailModalTask.priority} />
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 font-outfit">{detailModalTask.title}</h3>
                </div>

                <button
                  onClick={() => setDetailModalTask(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ADMIN INSTRUCTIONS CALLOUT */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                <span className="font-extrabold text-amber-900 font-outfit uppercase tracking-wider block">
                  Admin Instructions
                </span>
                <p className="text-amber-800">
                  {detailModalTask.additional_notes || 'Inspect site, repair damaged civic infrastructure, and upload clear after-work photograph proof for approval.'}
                </p>
              </div>

              {/* FIELD WORKFLOW TRANSITION BUTTONS */}
              {detailModalTask.status !== 'Resolved' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3 text-xs">
                  <span className="font-extrabold text-gray-900 font-outfit block">Field Execution Lifecycle Actions</span>
                  <div className="flex flex-wrap gap-2">
                    
                    {/* Step 1: Accept Task */}
                    {(detailModalTask.status === 'Department Assigned' || detailModalTask.status === 'Staff Assigned') && (
                      <button
                        onClick={() => handleStatusTransition(detailModalTask.id, 'Accepted')}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center space-x-1.5 min-h-[44px]"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept Task Assignment</span>
                      </button>
                    )}

                    {/* Step 2: Navigate to Location */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${detailModalTask.latitude},${detailModalTask.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center space-x-1.5 min-h-[44px]"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Navigate to Location</span>
                    </a>

                    {/* Step 3: Mark On the Way */}
                    {detailModalTask.status === 'Accepted' && (
                      <button
                        onClick={() => handleStatusTransition(detailModalTask.id, 'On the Way')}
                        className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold flex items-center space-x-1.5 min-h-[44px]"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Mark "On the Way to Site"</span>
                      </button>
                    )}

                    {/* Step 4: Start Work */}
                    {(detailModalTask.status === 'Accepted' || detailModalTask.status === 'On the Way') && (
                      <button
                        onClick={() => handleStatusTransition(detailModalTask.id, 'In Progress')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1.5 min-h-[44px]"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Work (In Progress)</span>
                      </button>
                    )}

                  </div>
                </div>
              )}

              {/* BEFORE / AFTER PHOTO GALLERY */}
              <div className="space-y-2 text-xs border-t border-gray-200 pt-4">
                <h4 className="font-extrabold text-gray-900 font-outfit text-sm">Complaint Photo Evidence</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-gray-700 block mb-1">BEFORE (Citizen Report - Locked)</span>
                    <div className="relative rounded-xl overflow-hidden h-44 bg-gray-100 border border-gray-200">
                      <img src={detailModalTask.photo_before_url} alt="Before" className="w-full h-full object-cover" />
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-gray-700 block mb-1">AFTER (Resolution Proof Photo)</span>
                    {detailModalTask.photo_after_url || photoAfterPreview ? (
                      <div className="relative rounded-xl overflow-hidden h-44 border border-emerald-400">
                        <img src={detailModalTask.photo_after_url || photoAfterPreview} alt="Proof" className="w-full h-full object-cover" />
                        {detailModalTask.status !== 'Resolved' && (
                          <button
                            type="button"
                            onClick={() => setPhotoAfterPreview('')}
                            className="absolute top-2 right-2 bg-rose-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                          >
                            Change Photo
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center space-y-2 bg-gray-50/50 h-44 flex flex-col items-center justify-center">
                        <Camera className="w-6 h-6 text-gray-400" />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          id="staff-notif-proof-input"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setPhotoAfterFile(e.target.files[0]);
                              setPhotoAfterPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                        <label
                          htmlFor="staff-notif-proof-input"
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer min-h-[44px] inline-flex items-center space-x-1"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Repair Photo</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COMPLETE TASK FORM */}
              {detailModalTask.status !== 'Resolved' && (
                <form onSubmit={handleSubmitResolutionProof} className="space-y-4 pt-2 border-t border-gray-200 text-xs">
                  <h4 className="font-extrabold text-gray-900 font-outfit text-sm">Resolution Details & Proof Submission</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Work Resolution Notes *</label>
                      <input
                        type="text"
                        required
                        value={workNotes}
                        onChange={(e) => setWorkNotes(e.target.value)}
                        placeholder="e.g. Completed asphalt patching and road compaction."
                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Materials / Equipment Used</label>
                      <input
                        type="text"
                        value={materialsUsed}
                        onChange={(e) => setMaterialsUsed(e.target.value)}
                        placeholder="e.g. 50kg asphalt emulsion, roller compactor."
                        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingResolution || (!photoAfterPreview && !detailModalTask.photo_after_url)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center space-x-1.5 min-h-[44px] disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{submittingResolution ? 'Submitting Proof...' : 'Mark Work Completed (Send for Admin Verification)'}</span>
                  </button>
                </form>
              )}

              {/* TASK ACTIVITY TIMELINE */}
              <div className="pt-3 border-t border-gray-200">
                <ActivityTimeline complaintId={detailModalTask.id} />
              </div>

            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
