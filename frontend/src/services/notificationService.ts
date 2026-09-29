import { NotificationItem, NotificationType, UserRole } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl, getNoCacheHeaders } from '../config/apiConfig';

const LOCAL_STORAGE_NOTIFS_KEY = 'nagarsetu_notifications_v7';

// Purge any legacy stored notifications to ensure PostgreSQL is single source of truth
try {
  localStorage.removeItem(LOCAL_STORAGE_NOTIFS_KEY);
  localStorage.removeItem('nagarsetu_notifications');
} catch (e) {}

// In-memory runtime cache (PostgreSQL is authoritative source of truth)
let memoryNotifications: NotificationItem[] = [];

export function getStoredNotifications(): NotificationItem[] {
  return memoryNotifications;
}

export function saveStoredNotifications(notifs: NotificationItem[]) {
  memoryNotifications = notifs;
}

/**
 * Fetch authoritative user notifications from PostgreSQL backend API
 */
export async function syncNotificationsFromBackend(): Promise<NotificationItem[]> {
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  if (!token) {
    memoryNotifications = [];
    return [];
  }

  try {
    const res = await fetch(`${getApiUrl()}/api/notifications/my`, {
      headers: getNoCacheHeaders({ Authorization: `Bearer ${token}` })
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data?.notifications || []);
      const formatted: NotificationItem[] = rawList.map((n: any) => ({
        id: String(n.id),
        user_id: String(n.user_id || ''),
        role: (n.role || 'citizen') as UserRole,
        complaint_id: n.complaint_id ? String(n.complaint_id) : undefined,
        complaint_number: n.complaint_number || undefined,
        type: (n.channel === 'sms' ? 'status_change' : (n.type || 'system')) as NotificationType,
        title: n.title || (n.message ? n.message.slice(0, 45) : 'Notification'),
        message: n.message || '',
        is_read: n.is_read === 1 || n.is_read === true,
        created_at: n.sent_at || n.created_at || new Date().toISOString()
      }));

      memoryNotifications = formatted;
      return formatted;
    }
    throw new Error(`Failed to load notifications from database (HTTP ${res.status})`);
  } catch (err) {
    console.warn('Backend notifications sync error:', err);
    if (!isSupabaseConfigured()) {
      throw err;
    }
  }

  // Fallback to Supabase if backend unreachable
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted: NotificationItem[] = data.map((n: any) => ({
          id: String(n.id),
          user_id: String(n.user_id || ''),
          role: (n.role || 'citizen') as UserRole,
          complaint_id: n.complaint_id ? String(n.complaint_id) : undefined,
          complaint_number: n.complaint_number || undefined,
          type: (n.type || 'system') as NotificationType,
          title: n.title || n.message?.slice(0, 45) || 'Notification',
          message: n.message || '',
          is_read: n.is_read === true || n.is_read === 1,
          created_at: n.created_at || new Date().toISOString()
        }));
        memoryNotifications = formatted;
        return formatted;
      }
    } catch (sErr) {
      console.warn('Supabase notifications sync error:', sErr);
    }
  }

  return memoryNotifications;
}

export function getNotificationsForRole(userId?: string, role: UserRole = 'citizen'): NotificationItem[] {
  return memoryNotifications.filter((n) => {
    if (role === 'city_admin') return n.role === 'city_admin' || n.user_id === 'admin-group';
    if (role === 'service_staff') return n.role === 'service_staff' || (!!userId && n.user_id === userId);
    return (!!userId && n.user_id === userId) || n.role === 'citizen';
  });
}

export function getUnreadNotificationCount(userId?: string, role: UserRole = 'citizen'): number {
  const notifs = getNotificationsForRole(userId, role);
  return notifs.filter((n) => !n.is_read).length;
}

export function markNotificationAsRead(notifId: string): void {
  const target = memoryNotifications.find((n) => n.id === notifId);
  if (target) {
    target.is_read = true;
  }

  // Sync to PostgreSQL backend
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  if (token) {
    const parsedId = parseInt(notifId, 10);
    fetch(`${getApiUrl()}/api/notifications/mark-read`, {
      method: 'POST',
      headers: {
        ...getNoCacheHeaders(),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notification_id: isNaN(parsedId) ? null : parsedId })
    }).catch(() => {});
  }

  if (isSupabaseConfigured()) {
    try {
      supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    } catch (e) {}
  }
}

export function markAllNotificationsAsRead(userId?: string, role: UserRole = 'citizen'): void {
  memoryNotifications.forEach((n) => {
    if (role === 'city_admin' && (n.role === 'city_admin' || n.user_id === 'admin-group')) {
      n.is_read = true;
    } else if (role === 'service_staff' && (n.role === 'service_staff' || (!!userId && n.user_id === userId))) {
      n.is_read = true;
    } else if (role === 'citizen' && ((!!userId && n.user_id === userId) || n.role === 'citizen')) {
      n.is_read = true;
    }
  });

  // Sync to PostgreSQL backend
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  if (token) {
    fetch(`${getApiUrl()}/api/notifications/mark-read`, {
      method: 'POST',
      headers: {
        ...getNoCacheHeaders(),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notification_id: null })
    }).catch(() => {});
  }

  if (isSupabaseConfigured() && userId) {
    try {
      supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    } catch (e) {}
  }
}

export function pushNotification(payload: Omit<NotificationItem, 'id' | 'created_at' | 'is_read'>): NotificationItem {
  const newItem: NotificationItem = {
    ...payload,
    id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    is_read: false,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    try {
      supabase.from('notifications').insert([{
        user_id: payload.user_id,
        role: payload.role,
        complaint_id: payload.complaint_id,
        complaint_number: payload.complaint_number,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        is_read: false
      }]);
    } catch (e) {}
  }

  memoryNotifications.unshift(newItem);
  return newItem;
}
