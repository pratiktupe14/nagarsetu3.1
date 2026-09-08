import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getNotificationsForRole, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead, syncNotificationsFromBackend
} from '../../services/notificationService';
import { NotificationItem, NotificationType } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import {
  Bell, Check, CheckCheck, Clock, ShieldCheck, AlertTriangle, FileText,
  Wrench, CheckCircle2, RotateCcw, Zap, ExternalLink, Filter, Search,
  RefreshCw, Sparkles, ChevronRight, Building2
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<NotificationType, { icon: React.ReactNode; color: string; badge: string }> = {
  submitted: { icon: <FileText className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'Submitted' },
  verified: { icon: <ShieldCheck className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200', badge: 'Verified' },
  approved: { icon: <Zap className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Approved' },
  department_assigned: { icon: <Building2 className="w-4 h-4 text-sky-600" />, color: 'bg-sky-50 border-sky-200', badge: 'Dept Assigned' },
  staff_assigned: { icon: <Wrench className="w-4 h-4 text-cyan-600" />, color: 'bg-cyan-50 border-cyan-200', badge: 'Staff Dispatched' },
  work_started: { icon: <Wrench className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-200', badge: 'Work Started' },
  resolution_submitted: { icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />, color: 'bg-purple-50 border-purple-200', badge: 'Resolution Proof' },
  resolved: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200', badge: 'Resolved' },
  reopened: { icon: <RotateCcw className="w-4 h-4 text-orange-600" />, color: 'bg-orange-50 border-orange-200', badge: 'Reopened' },
  critical: { icon: <AlertTriangle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-300', badge: 'Critical Update' },
  sla_warning: { icon: <Clock className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-200', badge: 'SLA Notice' },
  sla_breached: { icon: <AlertTriangle className="w-4 h-4 text-rose-700" />, color: 'bg-rose-100 border-rose-400', badge: 'SLA Delayed' }
};

export const CitizenNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Unread' | 'Read'>('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let list = getNotificationsForRole(user?.id, 'citizen');
      setNotifications(list);

      await syncNotificationsFromBackend();
      list = getNotificationsForRole(user?.id, 'citizen');
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

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'Unread' && n.is_read) return false;
      if (activeTab === 'Read' && !n.is_read) return false;

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

  const handleMarkSingleAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markNotificationAsRead(id);
    loadData();
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(user?.id, 'citizen');
    loadData();
  };

  const handleNavigateAction = (n: NotificationItem) => {
    if (!n.is_read) {
      markNotificationAsRead(n.id);
    }

    if (n.complaint_id) {
      navigate(`/citizen/complaint/${n.complaint_id}`);
    } else {
      navigate('/citizen/portal');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <DashboardLayout title="Notifications">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto text-gray-900 bg-white min-h-screen">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight font-outfit">
                My Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold font-mono bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Real-time updates regarding your filed civic complaints and municipality alerts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50 min-h-[44px]"
            >
              <CheckCheck className="w-4 h-4 text-gray-500" />
              <span>Mark All Read</span>
            </button>
            <button
              onClick={() => loadData()}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-xs transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh Notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER TABS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-xl">
            {(['All', 'Unread', 'Read'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  activeTab === tab
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* LIST */}
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 font-outfit">No notifications found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You will receive live status notifications here as municipal teams inspect and resolve issues.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => {
              const meta = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.submitted;
              return (
                <div
                  key={item.id}
                  onClick={() => handleNavigateAction(item)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                    item.is_read
                      ? 'bg-white border-gray-100 hover:border-gray-200'
                      : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70 shadow-xs'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl border ${meta.color} shrink-0 mt-0.5`}>
                      {meta.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-extrabold text-gray-900 font-outfit">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {meta.badge}
                        </span>
                        {item.complaint_number && (
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {item.complaint_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-gray-400 block pt-0.5">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {!item.is_read && (
                      <button
                        onClick={(e) => handleMarkSingleAsRead(item.id, e)}
                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
                        title="Mark as read"
                        aria-label="Mark notification as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
export default CitizenNotificationsPage;
