import { OfficialAnnouncement, MaintenanceWork, MaintenanceWorkUpdateLog } from '../types/database.types';

// Official Announcements (Database source of truth)
const initialAnnouncements: OfficialAnnouncement[] = [];

// Maintenance Works (Database source of truth)
const initialMaintenanceWorks: MaintenanceWork[] = [];

const LOCAL_STORAGE_ANNOUNCEMENTS = 'nagarsetu_official_announcements';
const LOCAL_STORAGE_MAINTENANCE = 'nagarsetu_maintenance_works';

function getStoredAnnouncements(): OfficialAnnouncement[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}

function getStoredMaintenance(): MaintenanceWork[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MAINTENANCE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return [];
}

function saveAnnouncements(list: OfficialAnnouncement[]) {
  localStorage.setItem(LOCAL_STORAGE_ANNOUNCEMENTS, JSON.stringify(list));
}

function saveMaintenance(list: MaintenanceWork[]) {
  localStorage.setItem(LOCAL_STORAGE_MAINTENANCE, JSON.stringify(list));
}

// Service API
export async function getOfficialAnnouncements(): Promise<OfficialAnnouncement[]> {
  return getStoredAnnouncements().filter((a) => a.status === 'Published');
}

export async function getMaintenanceWorks(): Promise<MaintenanceWork[]> {
  return getStoredMaintenance();
}

export async function getAnnouncementById(id: string): Promise<OfficialAnnouncement | null> {
  const list = getStoredAnnouncements();
  return list.find((a) => a.id === id) || null;
}

export async function getMaintenanceWorkById(id: string): Promise<MaintenanceWork | null> {
  const list = getStoredMaintenance();
  return list.find((m) => m.id === id) || null;
}

export async function createAnnouncement(announcement: Omit<OfficialAnnouncement, 'id' | 'created_at' | 'updated_at'>): Promise<OfficialAnnouncement> {
  const list = getStoredAnnouncements();
  const newAnn: OfficialAnnouncement = {
    ...announcement,
    id: `ann-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const updated = [newAnn, ...list];
  saveAnnouncements(updated);
  return newAnn;
}

export async function createMaintenanceWork(work: Omit<MaintenanceWork, 'id' | 'created_at' | 'updated_at'>): Promise<MaintenanceWork> {
  const list = getStoredMaintenance();
  const newWork: MaintenanceWork = {
    ...work,
    id: `maint-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const updated = [newWork, ...list];
  saveMaintenance(updated);
  return newWork;
}

export async function updateMaintenanceStatus(id: string, status: MaintenanceWork['status']): Promise<MaintenanceWork | null> {
  const list = getStoredMaintenance();
  const index = list.findIndex((m) => m.id === id);
  if (index === -1) return null;
  list[index].status = status;
  list[index].updated_at = new Date().toISOString();
  saveMaintenance(list);
  return list[index];
}
