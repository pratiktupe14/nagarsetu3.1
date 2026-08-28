import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getNotificationsForRole, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead, getStoredNotifications, saveStoredNotifications
} from '../../services/notificationService';
import { NotificationItem, NotificationType } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Bell, Check, CheckCheck, Clock, ShieldCheck, AlertTriangle, FileText,
  Wrench, CheckCircle2, RotateCcw, Zap, ExternalLink, Filter, Search,
  RefreshCw, Building2, Users, Star, Layers, Sparkles, X, ChevronRight
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<NotificationType, { icon: React.ReactNode; color: string; badge: string }> = {
  submitted: { icon: <FileText className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'New Submission' },
  verified: { icon: <ShieldCheck className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'Verified' },
  approved: { icon: <Zap className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Approved' },
  department_assigned: { icon: <Building2 className="w-4 h-4 text-sky-600" />, color: 'bg-sky-50 border-sky-200', badge: 'Dept Assigned' },
  staff_assigned: { icon: <Wrench className="w-4 h-4 text-cyan-600" />, color: 'bg-cyan-50 border-cyan-200', badge: 'Staff Dispatched' },
  work_started: { icon: <Wrench className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-200', badge: 'Work In Progress' },
  resolution_submitted: { icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />, color: 'bg-purple-50 border-purple-200', badge: 'Proof Submitted' },
  resolved: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Resolved' },
  reopened: { icon: <RotateCcw className="w-4 h-4 text-orange-600" />, color: 'bg-orange-50 border-orange-200', badge: 'Reopened' },
  critical: { icon: <AlertTriangle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-300', badge: 'Critical Hazard' },
  sla_warning: { icon: <Clock className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-200', badge: 'SLA Warning' },
  sla_breached: { icon: <AlertTriangle className="w-4 h-4 text-rose-700" />, color: 'bg-rose-100 border-rose-400', badge: 'SLA Breached' }
};

export const AdminNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Unread' | 'Read' | 'Complaint' | 'SLA' | 'Staff' | 'Critical'>('All');

  // Load Notifications
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      // Ensure seed notifications if empty
      let list = getNotificationsForRole(user?.id, 'city_admin');
      
      // Inject extra realistic municipal admin notifications if list is small
      if (list.length <= 3) {
        const enrichedSeed: NotificationItem[] = [
          ...list,
          {
            id: 'notif-adm-101',
            user_id: 'admin-group',
            role: 'city_admin',
            complaint_id: 'comp-101',
            complaint_number: 'NS-2026-100234',
            type: 'sla_breached',
            title: 'SLA Breach Warning: Sewage Overflow in Ward 12',
            message: 'Complaint NS-2026-100234 has exceeded its 24-hour resolution deadline by 3.5 hours.',
            is_read: false,
            created_at: new Date(Date.now() - 3600000 * 1).toISOString()
          },
          {
            id: 'notif-adm-102',
            user_id: 'admin-group',
            role: 'city_admin',
            complaint_id: 'comp-102',
            complaint_number: 'NS-2026-100567',
            type: 'critical',
            title: 'CRITICAL Hazard Reported: Exposed High-Voltage Line',
            message: 'Public safety hazard reported at MG Road Junction. Electrical Dept dispatched urgently.',
            is_read: false,
            created_at: new Date(Date.now() - 3600000 * 3).toISOString()
          },
          {
            id: 'notif-adm-103',
            user_id: 'admin-group',
            role: 'city_admin',
            complaint_id: 'comp-104',
            complaint_number: 'NS-2026-000210',
            type: 'resolution_submitted',
            title: 'Resolution Proof Uploaded for Review',
            message: 'Field Staff Ramesh Kumar submitted after-work photos for Road Pothole repair NS-2026-000210.',
            is_read: false,
            created_at: new Date(Date.now() - 3600000 * 6).toISOString()
          },
          {
            id: 'notif-adm-104',
            user_id: 'admin-group',
            role: 'city_admin',
            complaint_id: 'comp-105',
            complaint_number: 'NS-2026-000234',
            type: 'resolved',
            title: 'Complaint Resolved & Citizen Feedback Received',
            message: 'Citizen rated 5 Stars (★ ★ ★ ★ ★): "Prompt repair of water leakage on College Road!"',
            is_read: true,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString()
          },
          {
            id: 'notif-adm-105',
            user_id: 'admin-group',
            role: 'city_admin',
            complaint_id: 'comp-106',
            complaint_number: 'NS-2026-000258',
            type: 'sla_warning',
            title: 'SLA Deadline Approaching (45m Remaining)',
            message: 'Streetlight outage NS-2026-000258 is approaching its SLA target in Ward 8.',
            is_read: true,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString()
          }
        ];
        
        saveStoredNotifications(enrichedSeed);
        list = getNotificationsForRole(user?.id, 'city_admin');
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
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  // Notification Counts
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.is_read).length;
    const critical = notifications.filter((n) => n.type === 'critical').length;
    const sla = notifications.filter((n) => n.type === 'sla_warning' || n.type === 'sla_breached').length;
    const staff = notifications.filter((n) => n.type === 'staff_assigned' || n.type === 'work_started' || n.type === 'resolution_submitted').length;

    return { total, unread, critical, sla, staff };
  }, [notifications]);

  // Filtered Notifications based on Search & Tabs
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab Filter
      if (activeTab === 'Unread' && n.is_read) return false;
      if (activeTab === 'Read' && !n.is_read) return false;
      if (activeTab === 'Critical' && n.type !== 'critical') return false;
      if (activeTab === 'SLA' && n.type !== 'sla_warning' && n.type !== 'sla_breached') return false;
      if (activeTab === 'Staff' && n.type !== 'staff_assigned' && n.type !== 'work_started' && n.type !== 'resolution_submitted') return false;
      if (activeTab === 'Complaint' && ['staff_assigned', 'critical', 'sla_warning', 'sla_breached'].includes(n.type)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesMsg = n.message.toLowerCase().includes(q);
        const matchesNum = (n.complaint_number || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesMsg && !matchesNum) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  // 11. DATE GROUPING (Today, Yesterday, Earlier This Week, Older)
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 86400000 * 7;

    const groups: {
      today: NotificationItem[];
      yesterday: NotificationItem[];
      thisWeek: NotificationItem[];
      older: NotificationItem[];
    } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filteredNotifications.forEach((n) => {
      const time = new Date(n.created_at).getTime();
      if (time >= todayStart) {
        groups.today.push(n);
      } else if (time >= yesterdayStart) {
        groups.yesterday.push(n);
      } else if (time >= weekStart) {
        groups.thisWeek.push(n);
      } else {
        groups.older.push(n);
      }
    });

    return groups;
  }, [filteredNotifications]);

  // Actions
  const handleMarkSingleAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markNotificationAsRead(id);
    loadData();
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(user?.id, 'city_admin');
    loadData();
  };

  const handleNavigateAction = (n: NotificationItem) => {
    if (!n.is_read) {
      markNotificationAsRead(n.id);
    }

    if (n.complaint_id) {
      navigate(`/citizen/complaint/${n.complaint_id}`);
    } else {
      navigate('/admin/portal');
    }
  };

  return (
    <DashboardLayout title="Notifications">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen">
        
        {/* ================================================== */}
        {/* 2. PAGE HEADER */}
        {/* ================================================== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                Notifications
              </h1>
              {stats.unread > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {stats.unread} Unread
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium">
              Stay updated with complaint activity, municipal operations and important alerts.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* 9. MARK ALL AS READ */}
            <button
              onClick={handleMarkAllRead}
              disabled={stats.unread === 0}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* 3. NOTIFICATION SUMMARY METRIC BLOCKS */}
        {/* ================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-5 border border-gray-200 rounded-xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
          
          <button
            onClick={() => setActiveTab('All')}
            className={`p-3.5 text-center space-y-0.5 transition-colors ${activeTab === 'All' ? 'bg-slate-50' : 'hover:bg-gray-50'}`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">All Notifications</span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">{stats.total}</span>
          </button>

          <button
            onClick={() => setActiveTab('Unread')}
            className={`p-3.5 text-center space-y-0.5 transition-colors ${activeTab === 'Unread' ? 'bg-emerald-50/50' : 'hover:bg-gray-50'}`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Unread</span>
            <span className="text-xl font-extrabold text-emerald-700 font-mono block">{stats.unread}</span>
          </button>

          <button
            onClick={() => setActiveTab('Critical')}
            className={`p-3.5 text-center space-y-0.5 transition-colors ${activeTab === 'Critical' ? 'bg-rose-50/50' : 'hover:bg-gray-50'}`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Critical Hazards</span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">{stats.critical}</span>
          </button>

          <button
            onClick={() => setActiveTab('SLA')}
            className={`p-3.5 text-center space-y-0.5 transition-colors ${activeTab === 'SLA' ? 'bg-rose-50/50' : 'hover:bg-gray-50'}`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">SLA Alerts</span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">{stats.sla}</span>
          </button>

          <button
            onClick={() => setActiveTab('Staff')}
            className={`p-3.5 text-center space-y-0.5 transition-colors ${activeTab === 'Staff' ? 'bg-cyan-50/50' : 'hover:bg-gray-50'}`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block font-outfit">Staff Updates</span>
            <span className="text-xl font-extrabold text-cyan-700 font-mono block">{stats.staff}</span>
          </button>

        </div>

        {/* ================================================== */}
        {/* 4. FILTER BAR & SEARCH */}
        {/* ================================================== */}
        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search notifications by title, ID or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-900 focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['All', 'Unread', 'Read', 'Complaint', 'SLA', 'Staff', 'Critical'] as const).map((tab) => (
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
        {/* 5, 6, 7, 11, 12, 13. NOTIFICATION LIST GROUPED BY DATE */}
        {/* ================================================== */}
        {loading ? (
          /* 15. LOADING SKELETON */
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 bg-white rounded-xl border border-gray-200 animate-pulse flex space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* 16. ERROR STATE */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">Unable to load notifications.</h3>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          /* 14. EMPTY STATE */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
            <Bell className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-base font-bold text-gray-900 font-outfit">No Notifications</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You're all caught up. New municipal updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* GROUP 1: TODAY */}
            {groupedNotifications.today.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-gray-600 uppercase tracking-wider font-outfit border-b border-gray-200 pb-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Today</span>
                  <span className="font-mono text-gray-400 font-normal">({groupedNotifications.today.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedNotifications.today.map((n) => (
                    <NotificationCard key={n.id} item={n} onMarkRead={handleMarkSingleAsRead} onAction={handleNavigateAction} />
                  ))}
                </div>
              </div>
            )}

            {/* GROUP 2: YESTERDAY */}
            {groupedNotifications.yesterday.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-gray-600 uppercase tracking-wider font-outfit border-b border-gray-200 pb-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span>Yesterday</span>
                  <span className="font-mono text-gray-400 font-normal">({groupedNotifications.yesterday.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedNotifications.yesterday.map((n) => (
                    <NotificationCard key={n.id} item={n} onMarkRead={handleMarkSingleAsRead} onAction={handleNavigateAction} />
                  ))}
                </div>
              </div>
            )}

            {/* GROUP 3: THIS WEEK */}
            {groupedNotifications.thisWeek.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-gray-600 uppercase tracking-wider font-outfit border-b border-gray-200 pb-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span>Earlier This Week</span>
                  <span className="font-mono text-gray-400 font-normal">({groupedNotifications.thisWeek.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedNotifications.thisWeek.map((n) => (
                    <NotificationCard key={n.id} item={n} onMarkRead={handleMarkSingleAsRead} onAction={handleNavigateAction} />
                  ))}
                </div>
              </div>
            )}

            {/* GROUP 4: OLDER */}
            {groupedNotifications.older.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-gray-600 uppercase tracking-wider font-outfit border-b border-gray-200 pb-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span>Older Notifications</span>
                  <span className="font-mono text-gray-400 font-normal">({groupedNotifications.older.length})</span>
                </div>
                <div className="space-y-2">
                  {groupedNotifications.older.map((n) => (
                    <NotificationCard key={n.id} item={n} onMarkRead={handleMarkSingleAsRead} onAction={handleNavigateAction} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

// ==================================================
// INDIVIDUAL NOTIFICATION CARD COMPONENT
// ==================================================
interface NotificationCardProps {
  item: NotificationItem;
  onMarkRead: (id: string, e: React.MouseEvent) => void;
  onAction: (item: NotificationItem) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ item, onMarkRead, onAction }) => {
  const iconMeta = NOTIFICATION_ICONS[item.type] || {
    icon: <Bell className="w-4 h-4 text-emerald-600" />,
    color: 'bg-emerald-50 border-emerald-200',
    badge: 'Notification'
  };

  const isCritical = item.type === 'critical' || item.type === 'sla_breached';

  return (
    <div
      onClick={() => onAction(item)}
      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isCritical
          ? 'bg-rose-50/70 border-rose-300 shadow-xs'
          : !item.is_read
          ? 'bg-emerald-50/40 border-emerald-200 shadow-xs border-l-4 border-l-emerald-600'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start space-x-3">
        {/* Icon with Color Badge */}
        <div className={`p-2.5 rounded-xl border shrink-0 ${iconMeta.color}`}>
          {iconMeta.icon}
        </div>

        <div className="space-y-1">
          {/* Header Title & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {!item.is_read && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
            )}
            
            <h4 className={`text-xs sm:text-sm leading-snug font-outfit ${!item.is_read ? 'font-extrabold text-gray-900' : 'font-bold text-gray-800'}`}>
              {item.title}
            </h4>

            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isCritical
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {iconMeta.badge}
            </span>
          </div>

          {/* Message Description */}
          <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
            {item.message}
          </p>

          {/* Footer Metadata */}
          <div className="flex items-center space-x-3 text-[11px] font-mono text-gray-500 pt-1">
            {item.complaint_number && (
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {item.complaint_number}
              </span>
            )}
            <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>•</span>
            <span>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
        {!item.is_read && (
          <button
            onClick={(e) => onMarkRead(item.id, e)}
            className="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-lg transition-colors flex items-center space-x-1"
            title="Mark as Read"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Mark Read</span>
          </button>
        )}

        <button
          onClick={() => onAction(item)}
          className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-1"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
