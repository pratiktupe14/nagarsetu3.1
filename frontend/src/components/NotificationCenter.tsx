import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getNotificationsForRole, getUnreadNotificationCount, markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/notificationService';
import { NotificationItem, NotificationType } from '../types/database.types';
import { subscribeToRealtimeComplaints } from '../services/realtimeService';
import {
  Bell, Check, CheckCheck, Clock, ShieldCheck, AlertTriangle, FileText,
  Wrench, CheckCircle2, RotateCcw, Zap, ExternalLink
} from 'lucide-react';

const NOTIFICATION_ICONS: Record<NotificationType, { icon: React.ReactNode; color: string }> = {
  submitted: { icon: <FileText className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200' },
  verified: { icon: <ShieldCheck className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50 border-blue-200' },
  approved: { icon: <Zap className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200' },
  department_assigned: { icon: <FileText className="w-4 h-4 text-sky-600" />, color: 'bg-sky-50 border-sky-200' },
  staff_assigned: { icon: <Wrench className="w-4 h-4 text-cyan-600" />, color: 'bg-cyan-50 border-cyan-200' },
  work_started: { icon: <Wrench className="w-4 h-4 text-amber-600" />, color: 'bg-amber-50 border-amber-200' },
  resolution_submitted: { icon: <CheckCircle2 className="w-4 h-4 text-purple-600" />, color: 'bg-purple-50 border-purple-200' },
  resolved: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 border-emerald-200' },
  reopened: { icon: <RotateCcw className="w-4 h-4 text-orange-600" />, color: 'bg-orange-50 border-orange-200' },
  critical: { icon: <AlertTriangle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-200' },
  sla_warning: { icon: <Clock className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 border-rose-200' },
  sla_breached: { icon: <AlertTriangle className="w-4 h-4 text-rose-700" />, color: 'bg-rose-100 border-rose-300' }
};

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'All' | 'Unread'>('All');

  const role = user?.role || 'citizen';

  const loadNotifications = useCallback(() => {
    const list = getNotificationsForRole(user?.id, role);
    setNotifications(list);
    setUnreadCount(getUnreadNotificationCount(user?.id, role));
  }, [user, role]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Subscribe to realtime changes
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeComplaints(() => {
      loadNotifications();
    });
    return () => unsubscribe();
  }, [loadNotifications]);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markNotificationAsRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(user?.id, role);
    loadNotifications();
  };

  const handleViewComplaint = (complaintId?: string) => {
    setIsOpen(false);
    if (!complaintId) return;

    if (role === 'city_admin') {
      navigate('/admin/portal');
    } else if (role === 'service_staff') {
      navigate('/staff/portal');
    } else {
      navigate(`/citizen/complaint/${complaintId}`);
    }
  };

  const filteredNotifs = notifications.filter((n) => (activeTab === 'Unread' ? !n.is_read : true));

  return (
    <div className="relative inline-block text-left">
      
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        
        {/* Subtle Emerald Counter Indicator */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-600 text-white font-mono text-[9px] font-extrabold items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-96 max-w-sm rounded-2xl bg-white border border-gray-200 shadow-xl z-50 overflow-hidden font-sans space-y-2">
          
          {/* Popover Header */}
          <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-gray-900 text-sm font-outfit">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-4 flex items-center space-x-2 border-b border-gray-100 pb-2 text-xs">
            <button
              onClick={() => setActiveTab('All')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'All'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({notifications.length})
            </button>

            <button
              onClick={() => setActiveTab('Unread')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'Unread'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {filteredNotifs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 space-y-1">
                <Bell className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-700">{t('noNotificationsAvailable')}</p>
              </div>
            ) : (
              filteredNotifs.map((n) => {
                const conf = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.submitted;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleViewComplaint(n.complaint_id)}
                    className={`p-3.5 hover:bg-gray-50 transition-colors cursor-pointer flex items-start space-x-3 text-xs ${
                      !n.is_read ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Icon Badge */}
                    <div className={`p-2 rounded-xl border shrink-0 ${conf.color}`}>
                      {conf.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-gray-900 font-outfit line-clamp-1">{n.title}</span>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-1" />
                        )}
                      </div>

                      <p className="text-gray-600 leading-snug text-[11px] line-clamp-2">{n.message}</p>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 font-mono">
                        <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(n.id, e)}
                            className="text-emerald-700 font-bold hover:underline"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Close */}
          <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-gray-600 hover:text-gray-900"
            >
              Close Notifications
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
