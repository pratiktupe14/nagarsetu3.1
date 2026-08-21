import { NotificationItem, NotificationType, UserRole } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const LOCAL_STORAGE_NOTIFS_KEY = 'nagarsetu_notifications_v7';

const SEED_NOTIFICATIONS: NotificationItem[] = [];

export function getStoredNotifications(): NotificationItem[] {
  const data = localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {}
  }
  return [];
}

export function saveStoredNotifications(notifs: NotificationItem[]) {
  localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, JSON.stringify(notifs));
}

export function getNotificationsForRole(userId?: string, role: UserRole = 'citizen'): NotificationItem[] {
  const all = getStoredNotifications();
  return all.filter((n) => {
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
  if (isSupabaseConfigured()) {
    try {
      supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    } catch (e) {}
  }

  const all = getStoredNotifications();
  const target = all.find((n) => n.id === notifId);
  if (target) {
    target.is_read = true;
    saveStoredNotifications(all);
  }
}

export function markAllNotificationsAsRead(userId?: string, role: UserRole = 'citizen'): void {
  if (isSupabaseConfigured() && userId) {
    try {
      supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    } catch (e) {}
  }

  const all = getStoredNotifications();
  all.forEach((n) => {
    if (role === 'city_admin' && (n.role === 'city_admin' || n.user_id === 'admin-group')) {
      n.is_read = true;
    } else if (role === 'service_staff' && (n.role === 'service_staff' || (!!userId && n.user_id === userId))) {
      n.is_read = true;
    } else if (role === 'citizen' && ((!!userId && n.user_id === userId) || n.role === 'citizen')) {
      n.is_read = true;
    }
  });
  saveStoredNotifications(all);
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

  const all = getStoredNotifications();
  all.unshift(newItem);
  saveStoredNotifications(all);
  return newItem;
}
