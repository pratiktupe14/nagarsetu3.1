/**
 * Offline Draft Service for NagarSetu 3.1
 * Native IndexedDB implementation for offline-first citizen complaint drafts.
 * Stores actual Blob / File binary data, original capture timestamp, and original GPS coordinates.
 */

export interface OfflineDraftImage {
  angle: 'front' | 'left' | 'right' | 'closeup';
  blob: Blob | File;
  name: string;
  type: string;
  size: number;
  lastModified?: number;
}

export interface OfflineDraft {
  draft_id: string;
  citizen_id?: string;
  created_at: string;
  updated_at: string;
  draft_status: 'local_draft';

  title: string;
  description: string;
  category: string;
  subcategory?: string;

  // Original issue-site coordinates (MUST NOT be overwritten on submission from another location)
  latitude: number;
  longitude: number;
  location_source: string;
  location_accuracy_m?: number;
  original_capture_time?: string;
  exif_gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp?: string;
  } | null;

  manual_address?: string;
  landmark?: string;
  ward?: string;
  sector?: string;

  priority?: string;
  department?: string;

  images: OfflineDraftImage[];
}

const DB_NAME = 'nagarsetu_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'complaint_drafts';

// In-memory fallback for environments without IndexedDB (e.g. Node tests / SSR)
const memoryStore = new Map<string, OfflineDraft>();

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB not available in current environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'draft_id' });
        store.createIndex('citizen_id', 'citizen_id', { unique: false });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Save a new draft or update existing draft in IndexedDB
 */
export async function saveDraft(draft: OfflineDraft): Promise<string> {
  if (!draft.draft_id) {
    draft.draft_id = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const now = new Date().toISOString();
  if (!draft.created_at) draft.created_at = now;
  draft.updated_at = now;
  draft.draft_status = 'local_draft';

  if (!isIndexedDBAvailable()) {
    memoryStore.set(draft.draft_id, { ...draft });
    syncMetadataToLocalStorage();
    return draft.draft_id;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(draft);

    req.onsuccess = () => {
      syncMetadataToLocalStorage();
      resolve(draft.draft_id);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a single draft by ID
 */
export async function getDraft(draftId: string): Promise<OfflineDraft | null> {
  if (!draftId) return null;

  if (!isIndexedDBAvailable()) {
    return memoryStore.get(draftId) || null;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(draftId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all drafts, optionally filtered by citizen_id
 */
export async function getDrafts(citizenId?: string): Promise<OfflineDraft[]> {
  if (!isIndexedDBAvailable()) {
    const list = Array.from(memoryStore.values());
    if (citizenId) {
      return list.filter(d => !d.citizen_id || d.citizen_id === citizenId);
    }
    return list;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      let results: OfflineDraft[] = req.result || [];
      if (citizenId) {
        results = results.filter(d => !d.citizen_id || d.citizen_id === citizenId);
      }
      // Sort newest updated first
      results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update an existing draft
 */
export async function updateDraft(draftId: string, updates: Partial<OfflineDraft>): Promise<void> {
  const existing = await getDraft(draftId);
  if (!existing) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const merged: OfflineDraft = {
    ...existing,
    ...updates,
    draft_id: draftId,
    // Strictly preserve original coordinates if updates don't explicitly pass new ones
    latitude: updates.latitude !== undefined ? updates.latitude : existing.latitude,
    longitude: updates.longitude !== undefined ? updates.longitude : existing.longitude,
    original_capture_time: existing.original_capture_time || updates.original_capture_time,
    exif_gps: existing.exif_gps || updates.exif_gps,
    updated_at: new Date().toISOString()
  };

  await saveDraft(merged);
}

/**
 * Delete a draft after successful submission or explicit user action
 */
export async function deleteDraft(draftId: string): Promise<void> {
  if (!draftId) return;

  if (!isIndexedDBAvailable()) {
    memoryStore.delete(draftId);
    syncMetadataToLocalStorage();
    return;
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(draftId);

    req.onsuccess = () => {
      syncMetadataToLocalStorage();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Count saved drafts
 */
export async function countDrafts(citizenId?: string): Promise<number> {
  const list = await getDrafts(citizenId);
  return list.length;
}

/**
 * Keep lightweight metadata in localStorage for instant synchronous counts in UI headers
 */
const METADATA_KEY = 'nagarsetu_offline_drafts_meta';

export function getOfflineDraftsCount(): number {
  try {
    if (typeof localStorage === 'undefined') return memoryStore.size;
    const meta = localStorage.getItem(METADATA_KEY);
    if (!meta) return 0;
    const parsed = JSON.parse(meta);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

async function syncMetadataToLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const drafts = await getDrafts();
    const meta = drafts.map(d => ({
      draft_id: d.draft_id,
      title: d.title,
      category: d.category,
      updated_at: d.updated_at,
      citizen_id: d.citizen_id,
      photo_count: d.images ? d.images.length : 0
    }));
    localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
  } catch (e) {
    // Non-critical
  }
}
