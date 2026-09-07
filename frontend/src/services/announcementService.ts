import { getApiUrl } from '../config/apiConfig';
import { OfficialAnnouncement, MaintenanceWork } from '../types/database.types';

export type AnnouncementType = 'General' | 'Important' | 'Urgent' | 'Maintenance' | 'Service Update' | 'System Update' | 'Emergency' | 'Public Notice';
export type AnnouncementPriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type AnnouncementTargetType = 'all' | 'department';
export type AnnouncementStatus = 'Draft' | 'Scheduled' | 'Published' | 'Expired' | 'Archived';

export interface AnnouncementItem {
  id: string;
  title: string;
  description: string;
  type: AnnouncementType;
  priority: AnnouncementPriorityLevel;
  status?: AnnouncementStatus;
  target_type: AnnouncementTargetType;
  target_audience?: string;
  target_role?: string | null;
  department_id?: string | null;
  department_name?: string;
  posted_by: string;
  created_by?: string;
  created_by_role?: string;
  is_published: boolean;
  is_read?: boolean;
  read_at?: string | null;
  published_at?: string;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STORAGE_ANNOUNCEMENTS = 'nagarsetu_official_announcements';
const LOCAL_STORAGE_MAINTENANCE = 'nagarsetu_maintenance_works';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Fetch Department Head / User Announcements (Filtered securely by backend)
 */
export async function getDepartmentHeadAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await fetch(`${getApiUrl()}/api/announcements`, {
    headers: getAuthHeaders()
  });
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data.announcements)) {
      return data.announcements;
    }
    return [];
  }
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.error || `Failed to fetch announcements (HTTP ${res.status})`);
}

/**
 * Mark an announcement as read for the current user
 */
export async function markAnnouncementAsRead(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/announcements/${id}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to mark announcement read:', err);
    return false;
  }
}

/**
 * Fetch ALL Announcements (Admin view)
 */
export async function getAdminAnnouncements(): Promise<AnnouncementItem[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/announcements/admin/all`, {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.announcements)) {
        return data.announcements;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch admin announcements:', err);
  }
  return [];
}

/**
 * Universal Create Announcement (Admin or Department Head)
 */
export async function createGenericAnnouncement(payload: {
  title: string;
  description: string;
  type: AnnouncementType;
  priority: AnnouncementPriorityLevel;
  status?: AnnouncementStatus;
  target_audience?: string;
  target_type?: AnnouncementTargetType;
  department_id?: string | null;
  department_name?: string;
  is_published?: boolean;
  expires_at?: string | null;
}): Promise<{ success: boolean; announcement?: AnnouncementItem; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/announcements`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, announcement: data.announcement };
    }
    return { success: false, error: data.error || 'Failed to create announcement' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

/**
 * Admin Alias: Create Announcement
 */
export async function createAdminAnnouncement(payload: Parameters<typeof createGenericAnnouncement>[0]) {
  return createGenericAnnouncement(payload);
}

/**
 * Universal Update Announcement
 */
export async function updateAdminAnnouncement(id: string, payload: Partial<AnnouncementItem>): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/announcements/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update announcement:', err);
    return false;
  }
}

/**
 * Universal Delete / Archive Announcement
 */
export async function deleteAdminAnnouncement(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/announcements/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete announcement:', err);
    return false;
  }
}

// Legacy Citizen Compatibility Exports
export async function getOfficialAnnouncements(): Promise<OfficialAnnouncement[]> {
  const anns = await getDepartmentHeadAnnouncements();
  return anns.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    category: (a.type || 'General') as any,
    area: a.department_name || 'Nashik Municipal Area',
    priority: (a.priority === 'Critical' ? 'Emergency' : a.priority === 'High' ? 'Important' : 'Normal') as any,
    start_date: a.published_at || a.created_at,
    status: a.is_published ? 'Published' : 'Draft',
    published_by: a.posted_by,
    created_at: a.created_at,
    updated_at: a.updated_at || a.created_at
  }));
}

export async function getAnnouncementById(id: string): Promise<OfficialAnnouncement | null> {
  const list = await getOfficialAnnouncements();
  return list.find((a) => a.id === id) || null;
}

export async function createAnnouncement(announcement: Omit<OfficialAnnouncement, 'id' | 'created_at' | 'updated_at'>): Promise<OfficialAnnouncement> {
  const res = await createGenericAnnouncement({
    title: announcement.title,
    description: announcement.description,
    type: 'General',
    priority: announcement.priority === 'Emergency' ? 'Critical' : 'High',
    target_type: 'all',
    status: announcement.status === 'Published' ? 'Published' : 'Draft'
  });
  return {
    ...announcement,
    id: res.announcement?.id || `ann-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function getMaintenanceWorks(): Promise<MaintenanceWork[]> {
  try {
    const announcements = await getDepartmentHeadAnnouncements();
    const maintenanceAnnouncements = announcements.filter(
      (a) => a.type === 'Maintenance' || a.title?.toLowerCase().includes('maintenance') || a.title?.toLowerCase().includes('repair')
    );
    return maintenanceAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      department_name: a.department_name || 'Public Works Department (PWD)',
      area: a.target_audience || 'Nashik City',
      location_address: a.target_audience || 'Nashik City',
      latitude: 19.9975,
      longitude: 73.7898,
      status: (a.status === 'Published' ? 'In Progress' : 'Planned') as any,
      priority: a.priority as any,
      start_date: a.published_at || a.created_at,
      expected_completion: a.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      created_by: a.posted_by,
      created_at: a.created_at,
      updated_at: a.updated_at || a.created_at
    }));
  } catch (e) {
    return [];
  }
}

export async function getMaintenanceWorkById(id: string): Promise<MaintenanceWork | null> {
  const list = await getMaintenanceWorks();
  return list.find((m) => m.id === id) || null;
}

export async function createMaintenanceWork(work: Omit<MaintenanceWork, 'id' | 'created_at' | 'updated_at'>): Promise<MaintenanceWork> {
  const res = await createGenericAnnouncement({
    title: work.title,
    description: work.description,
    type: 'Maintenance',
    priority: work.priority === 'Critical' ? 'Critical' : 'High',
    target_type: 'all',
    department_name: work.department_name,
    status: 'Published'
  });
  return {
    ...work,
    id: res.announcement?.id || `maint-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
