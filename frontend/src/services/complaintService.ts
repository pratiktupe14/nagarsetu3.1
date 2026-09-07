import { Complaint, ComplaintStatus, PriorityLevel, StaffPerformanceMetrics } from '../types/database.types';
import { supabase, isSupabaseConfigured, isValidUuid } from '../lib/supabase';
import { broadcastComplaintChange } from './realtimeService';
import { pushNotification } from './notificationService';
import { getApiUrl, getNoCacheHeaders } from '../config/apiConfig';
import { geocodeComplaintsWithoutCoordinates, auditAndRepairComplaintLocations } from './locationService';
import { resolveDepartmentInfo } from './departmentService';

const LOCAL_STORAGE_COMPLAINTS_KEY = 'nagarsetu_citizen_complaints_v3';
const LOCAL_STORAGE_OFFLINE_DRAFTS_KEY = 'nagarsetu_offline_drafts_v3';

export class HttpError extends Error {
  status: number;
  data: any;
  isHttpError: boolean;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.isHttpError = true;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class AuthError extends Error {
  isAuthError: boolean;
  status: number;

  constructor(message: string = 'Authentication required to submit complaint. Please log in.') {
    super(message);
    this.name = 'AuthError';
    this.isAuthError = true;
    this.status = 401;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Strict Network Failure Classifier
 * Distinguishes true network failures (fetch threw before reaching server, offline)
 * from valid HTTP responses (200, 201, 400, 401, 403, 404, 409, 422, 500, 502, 503).
 */
export function isNetworkError(err: any): boolean {
  if (!err) return false;

  // 1. If it's an HttpError or has an HTTP status code, it is an HTTP response, NOT a network failure.
  if (err instanceof HttpError || err.isHttpError || typeof err.status === 'number' || err.statusCode) {
    return false;
  }

  // 2. If it's an AuthError, it is an authentication issue, NOT a network failure.
  if (err instanceof AuthError || err.isAuthError || err.message?.includes('Authentication required')) {
    return false;
  }

  // 3. Browser explicitly reports offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  // 4. Standard fetch network error signatures (fetch throws before receiving HTTP response)
  const errMsg = (err.message || '').toLowerCase();
  return (
    errMsg.includes('failed to fetch') ||
    errMsg.includes('networkerror') ||
    errMsg.includes('network error') ||
    errMsg.includes('load failed') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('connection refused') ||
    errMsg.includes('net::err') ||
    errMsg.includes('offline')
  );
}

export function generateComplaintNumber(): string {
  const year = new Date().getFullYear();
  const randomSeq = Math.floor(100000 + Math.random() * 900000);
  return `NS-${year}-${randomSeq}`;
}

const LEGACY_STORAGE_KEYS = [
  'nagarsetu_citizen_complaints_v3',
  'nagarsetu_citizen_complaints',
  'nagarsetu_complaints',
  'nagarsetu_complaint_list',
  'complaints'
];

/**
 * Identifies if a complaint object is a demo/fake record
 */
export function isDemoComplaint(c: Partial<Complaint>): boolean {
  if (!c) return true;
  const num = (c.complaint_number || '').toLowerCase();
  const title = (c.title || '').toLowerCase();
  const addr = (c.location_address || '').toLowerCase();
  const desc = (c.description || '').toLowerCase();

  if (num.includes('000145') || num.includes('000128')) return true;
  if (title.includes('garbage overflow near public market') || title.includes('severe asphalt pothole on m.g. road')) return true;
  if (addr.includes('market yard road') || (addr.includes('m.g. road') && addr.includes('ward 12'))) return true;
  if (desc.includes('solid waste accumulation requiring municipal sanitation clearance') || desc.includes('deep road crater causing traffic congestion')) return true;

  return false;
}

export function getStoredComplaints(): Complaint[] {
  // Purge legacy storage keys if present to ensure PostgreSQL is single source of truth
  LEGACY_STORAGE_KEYS.forEach((key) => {
    try {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  });
  return [];
}

export function saveStoredComplaints(_complaints: Complaint[]) {
  // PostgreSQL is single source of truth; do not write complaints to localStorage
  try {
    localStorage.removeItem(LOCAL_STORAGE_COMPLAINTS_KEY);
  } catch (e) {}
}

// Upload image to Supabase storage bucket ('issues')
export async function uploadComplaintImage(file: File, bucketName: string = 'issues'): Promise<string> {
  if (isSupabaseConfigured()) {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
      if (error) {
        console.error('Supabase storage upload notice:', error.message);
      }
    } catch (err: any) {
      console.error('Supabase storage upload exception:', err);
    }
  }

  // Optimize & Compress client-side to prevent Vercel 4.5MB serverless request limit violations
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(URL.createObjectURL(file));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressed);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas image compression note:', canvasErr);
        }
        resolve(e.target?.result as string);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

// Fetch all complaints from Supabase with real geocoding fallback
export async function getAllComplaints(): Promise<Complaint[]> {
  let list: Complaint[] = [];
  let responseStatus = 0;
  const startTime = new Date().toISOString();

  // 1. Try Express Backend API first with no-cache headers
  try {
    const res = await fetch(`${getApiUrl()}/api/complaints`, {
      headers: getNoCacheHeaders()
    });
    responseStatus = res.status;
    if (res.ok) {
      const data = await res.json();
      const backendComplaints = Array.isArray(data) ? data : Array.isArray(data?.complaints) ? data.complaints : [];
      if (backendComplaints.length >= 0) {
        list = backendComplaints.filter((c: any) => !isDemoComplaint(c));
      }
    }
  } catch (err) {
    console.warn('Express backend getAllComplaints fallback:', err);
  }

  // 2. Try Supabase ONLY if Express Backend API was unreachable (responseStatus !== 200)
  if (responseStatus !== 200 && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        list = (data as Complaint[]).filter((c) => !isDemoComplaint(c));
        responseStatus = 200;
      }
    } catch (err) {
      console.warn('Supabase getAllComplaints fallback:', err);
    }
  }

  // 3. DB state is authoritative when backend or Supabase query succeeds
  if (responseStatus === 200) {
    const { repairedComplaints } = await auditAndRepairComplaintLocations(list);
    const finalComplaints = repairedComplaints.filter((c) => !isDemoComplaint(c));

    if (import.meta.env.DEV) {
      console.log('[ADMIN DATA SYNC]', {
        apiUrl: `${getApiUrl()}/api/complaints`,
        fetchTime: startTime,
        responseStatus,
        databaseRecordCount: list.length,
        lastUpdatedRecord: finalComplaints[0]?.updated_at || finalComplaints[0]?.created_at || 'N/A',
        finalRecordCount: finalComplaints.length
      });
    }

    return finalComplaints;
  }

  // If both Express API and Supabase failed, throw explicit database error
  throw new Error('Database Error: Failed to retrieve complaints from the server. Please check your network connection.');
}

// Fetch citizen complaints directly from backend API or Supabase
export async function getCitizenComplaints(citizenId: string): Promise<Complaint[]> {
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  if (token) {
    try {
      const res = await fetch(`${getApiUrl()}/api/complaints/my`, {
        headers: getNoCacheHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data && Array.isArray(data.complaints) ? data.complaints : []);
        const cleanList = (rawList as Complaint[]).filter((c) => !isDemoComplaint(c));
        return cleanList;
      }
      throw new Error(`Failed to load citizen complaints (HTTP ${res.status})`);
    } catch (bErr: any) {
      console.warn('Express backend getCitizenComplaints error:', bErr);
      if (!isSupabaseConfigured()) {
        throw bErr;
      }
    }
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured() && citizenId && isValidUuid(citizenId)) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('citizen_id', citizenId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return (data as Complaint[]).filter((c) => !isDemoComplaint(c));
      }
      if (error) throw new Error(error.message);
    } catch (err) {
      console.warn('Supabase getCitizenComplaints error:', err);
      throw err;
    }
  }

  if (!token) {
    return [];
  }
  throw new Error('Database Error: Unable to fetch citizen complaints from the server.');
}

// Fetch staff tasks directly from backend database API
export async function getStaffTasks(
  staffId?: string,
  departmentName?: string,
  userEmail?: string,
  userName?: string,
  employeeId?: string
): Promise<Complaint[]> {
  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  if (token) {
    try {
      const res = await fetch(`${getApiUrl()}/api/staff/tasks`, {
        headers: getNoCacheHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const staffTasks: Complaint[] = Array.isArray(data) ? data : (data?.tasks || []);
        if (Array.isArray(staffTasks)) {
          return staffTasks.filter((c: any) => !isDemoComplaint(c));
        }
      }
      throw new Error(`Failed to load field tasks from database (HTTP ${res.status})`);
    } catch (err: any) {
      console.error('Backend /api/staff/tasks fetch error:', err);
      throw err;
    }
  }

  return [];
}

// Fetch complaints belonging to a specific department directly from backend API
export async function getDepartmentComplaints(departmentId?: string, departmentName?: string): Promise<Complaint[]> {
  if (!departmentId && !departmentName) {
    return [];
  }

  const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
  const headers = getNoCacheHeaders(token ? { Authorization: `Bearer ${token}` } : {});

  try {
    const res = await fetch(`${getApiUrl()}/api/department/complaints`, { headers });
    if (res.ok) {
      const data = await res.json();
      const backendComplaints = Array.isArray(data) ? data : Array.isArray(data?.complaints) ? data.complaints : [];
      if (Array.isArray(backendComplaints)) {
        return backendComplaints.filter((c: any) => !isDemoComplaint(c));
      }
    }
    throw new Error(`Failed to fetch department complaints (HTTP ${res.status})`);
  } catch (e: any) {
    console.error('Backend API getDepartmentComplaints error:', e);
    throw e;
  }
}


export async function getComplaintById(idOrNumber: string): Promise<Complaint | null> {
  if (!idOrNumber) return null;

  let comp: Complaint | null = null;

  // 1. Try local Express Backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const res = await fetch(`${getApiUrl()}/api/complaints/${encodeURIComponent(idOrNumber)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.complaint) {
        comp = data.complaint as Complaint;
      }
    }
  } catch (backendErr) {
    console.warn('Express backend getComplaintById fallback note:', backendErr);
  }

  // 2. Try Supabase if configured
  if (!comp && isSupabaseConfigured()) {
    try {
      const isUuid = isValidUuid(idOrNumber);
      const query = isUuid
        ? supabase.from('complaints').select('*').or(`id.eq.${idOrNumber},complaint_number.eq.${idOrNumber}`).maybeSingle()
        : supabase.from('complaints').select('*').eq('complaint_number', idOrNumber).maybeSingle();

      const { data, error } = await query;

      if (!error && data) {
        comp = data as Complaint;
      }
    } catch (err) {
      console.warn('Supabase getComplaintById fallback:', err);
    }
  }

  if (comp) {
    if (comp.latitude != null) comp.latitude = Number(comp.latitude);
    if (comp.longitude != null) comp.longitude = Number(comp.longitude);
  }

  return comp;
}

// Insert new complaint into PostgreSQL & Supabase
export async function createComplaint(payload: Omit<Complaint, 'id' | 'created_at' | 'updated_at'>): Promise<Complaint> {
  const newComplaintNumber = payload.complaint_number || generateComplaintNumber();
  const parsedLat = payload.latitude != null ? Number(payload.latitude) : 0;
  const parsedLng = payload.longitude != null ? Number(payload.longitude) : 0;
  const resolvedDept = resolveDepartmentInfo(payload.department_id, payload.department_name, payload.category);

  const newComplaint: Complaint = {
    ...payload,
    department_id: payload.department_id || resolvedDept.id,
    department_name: payload.department_name || resolvedDept.fullName,
    latitude: parsedLat,
    longitude: parsedLng,
    complaint_number: newComplaintNumber,
    id: 'comp-' + Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    try {
      const SUPABASE_DEPT_MAP: Record<string, string> = {
        PWD: '8ed9f760-1314-427c-a515-c2a54d6df6d8',
        SAN: '9cabc1f2-fd10-48dd-a5cb-01d05197de22',
        WTR: 'ead370cc-459c-44f0-899f-8a97f0928beb',
        DRN: 'ee73cb82-cc47-4333-b7d6-4491353c1354',
        ELE: '31842723-23ac-490b-912b-9f6d9afbdfb3',
        TRF: 'ae5e4d0c-996f-4d81-9528-d642664c93ae'
      };

      let resolvedDeptUuid = newComplaint.department_id;
      if (!resolvedDeptUuid || !isValidUuid(resolvedDeptUuid)) {
        const deptNameStr = (newComplaint.department_name || '').toLowerCase();
        const catStr = (newComplaint.category || '').toLowerCase();

        if (deptNameStr.includes('water') || catStr.includes('water')) resolvedDeptUuid = SUPABASE_DEPT_MAP.WTR;
        else if (deptNameStr.includes('sanitation') || deptNameStr.includes('waste') || catStr.includes('garbage') || catStr.includes('waste')) resolvedDeptUuid = SUPABASE_DEPT_MAP.SAN;
        else if (deptNameStr.includes('drain') || deptNameStr.includes('sewag') || catStr.includes('drain') || catStr.includes('sewag')) resolvedDeptUuid = SUPABASE_DEPT_MAP.DRN;
        else if (deptNameStr.includes('electric') || deptNameStr.includes('light') || catStr.includes('electric') || catStr.includes('light')) resolvedDeptUuid = SUPABASE_DEPT_MAP.ELE;
        else if (deptNameStr.includes('traffic') || catStr.includes('traffic')) resolvedDeptUuid = SUPABASE_DEPT_MAP.TRF;
        else if (deptNameStr.includes('public works') || deptNameStr.includes('pwd') || catStr.includes('road') || catStr.includes('pothole')) resolvedDeptUuid = SUPABASE_DEPT_MAP.PWD;
      }

      const dbPayload: Record<string, any> = {
        complaint_number: newComplaint.complaint_number,
        photo_before_url: newComplaint.photo_before_url,
        category: newComplaint.category,
        title: newComplaint.title,
        description: newComplaint.description,
        priority: newComplaint.priority || 'Medium',
        status: newComplaint.status || 'Submitted',
        department_id: resolvedDeptUuid || null,
        latitude: newComplaint.latitude,
        longitude: newComplaint.longitude,
        location_source: newComplaint.location_source,
        location_address: newComplaint.location_address
      };

      if (isValidUuid(newComplaint.citizen_id)) {
        dbPayload.citizen_id = newComplaint.citizen_id;
      }

      const { data, error } = await supabase
        .from('complaints')
        .insert([dbPayload])
        .select()
        .single();

      if (!error && data) {
        newComplaint.id = data.id;
        if (data.department_id) newComplaint.department_id = data.department_id;
      }
    } catch (err) {
      console.warn('Supabase createComplaint insert fallback:', err);
    }
  }


  // Sync with Express backend API
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    if (token) {
      const res = await fetch(`${getApiUrl()}/api/complaints/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complaint_number: newComplaint.complaint_number,
          photo_url: newComplaint.photo_before_url || '',
          category: newComplaint.category,
          title: newComplaint.title,
          description: newComplaint.description,
          priority: newComplaint.priority,
          latitude: newComplaint.latitude,
          longitude: newComplaint.longitude,
          location_source: newComplaint.location_source,
          location_address: newComplaint.location_address,
          department_id: newComplaint.department_id,
          ai_category: (newComplaint as any).ai_category || newComplaint.category,
          ai_specific_issue: (newComplaint as any).ai_specific_issue,
          ai_confidence: (newComplaint as any).ai_confidence,
          ai_severity: (newComplaint as any).ai_severity,
          ai_urgency: (newComplaint as any).ai_urgency,
          ai_evidence: (newComplaint as any).ai_evidence,
          ai_model: (newComplaint as any).ai_model,
          ai_analyzed_at: (newComplaint as any).ai_analyzed_at,
          needs_manual_verification: (newComplaint as any).needs_manual_verification
        })
      });
      if (res.ok) {
        const bData = await res.json();
        if (bData) {
          const compInfo = bData.complaint || bData;
          if (compInfo.id || bData.complaint_id) newComplaint.id = String(compInfo.id || bData.complaint_id);
          if (compInfo.complaint_number || bData.complaint_number) newComplaint.complaint_number = compInfo.complaint_number || bData.complaint_number;
          if (compInfo.status) newComplaint.status = compInfo.status;
          if (compInfo.department?.id) newComplaint.department_id = compInfo.department.id;
          if (compInfo.department?.name) newComplaint.department_name = compInfo.department.name;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new AuthError('Session expired. Please sign in again.');
        }
        const msg = errData.error || errData.message || (errData.details ? errData.details.join(', ') : '') || `Failed to submit complaint (HTTP ${res.status})`;
        throw new HttpError(res.status, msg, errData);
      }
    } else {
      throw new AuthError('Authentication required to submit complaint. Please log in.');
    }
  } catch (bErr: any) {
    console.error('Backend API createComplaint error:', bErr);
    throw bErr;
  }

  pushNotification({
    user_id: newComplaint.citizen_id,
    role: 'citizen',
    complaint_id: newComplaint.id,
    complaint_number: newComplaint.complaint_number,
    type: 'submitted',
    title: `Complaint Logged (${newComplaint.complaint_number})`,
    message: `Your civic complaint '${newComplaint.title}' has been logged for municipal verification.`
  });

  pushNotification({
    user_id: 'admin-group',
    role: 'city_admin',
    complaint_id: newComplaint.id,
    complaint_number: newComplaint.complaint_number,
    type: newComplaint.priority === 'Critical' ? 'critical' : 'submitted',
    title: newComplaint.priority === 'Critical' ? `CRITICAL Priority Complaint Flagged` : `New Complaint Submitted`,
    message: `New issue '${newComplaint.title}' reported in ${newComplaint.location_address || 'Central District'}.`
  });

  broadcastComplaintChange(newComplaint.id, undefined, 'Submitted', 'Citizen', 'Initial complaint submission');

  return newComplaint;
}

export async function acceptStaffTask(complaintId: string): Promise<boolean> {
  const targetIdStr = String(complaintId || '').trim();

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const apiRes = await fetch(`${getApiUrl()}/api/staff/task/${encodeURIComponent(targetIdStr)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ status: 'Accepted' })
    });
    if (!apiRes.ok) {
      await fetch(`${getApiUrl()}/api/staff/tasks/${encodeURIComponent(targetIdStr)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: 'Accepted' })
      });
    }
  } catch (apiErr) {
    console.warn('Backend acceptStaffTask API note:', apiErr);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured() && targetIdStr) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdStr);
      let supaQuery = supabase.from('complaints').update({ status: 'Accepted', updated_at: new Date().toISOString() });
      if (isUuid) {
        supaQuery = supaQuery.eq('id', targetIdStr);
      } else {
        supaQuery = supaQuery.eq('complaint_number', targetIdStr);
      }
      await supaQuery;
    } catch (e) {}
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: targetIdStr,
    role: 'citizen',
    complaint_id: targetIdStr,
    complaint_number: targetIdStr,
    type: 'staff_assigned',
    title: 'Task Accepted by Field Officer',
    message: `Field officer has accepted task ${targetIdStr}.`
  });

  broadcastComplaintChange(targetIdStr, undefined, 'Accepted', 'Field Staff', 'Staff accepted field task');

  return true;
}

export async function startStaffTravel(complaintId: string): Promise<boolean> {
  const targetIdStr = String(complaintId || '').trim();

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    await fetch(`${getApiUrl()}/api/staff/task/${encodeURIComponent(targetIdStr)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ status: 'On the Way' })
    });
  } catch (apiErr) {
    console.warn('Backend startStaffTravel API note:', apiErr);
  }

  // 2. Supabase if configured
  if (isSupabaseConfigured() && targetIdStr) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdStr);
      let supaQuery = supabase.from('complaints').update({ status: 'On the Way', updated_at: new Date().toISOString() });
      if (isUuid) {
        supaQuery = supaQuery.eq('id', targetIdStr);
      } else {
        supaQuery = supaQuery.eq('complaint_number', targetIdStr);
      }
      await supaQuery;
    } catch (e) {}
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: targetIdStr,
    role: 'citizen',
    complaint_id: targetIdStr,
    complaint_number: targetIdStr,
    type: 'staff_assigned',
    title: 'Field Staff En Route',
    message: 'Maintenance officer is traveling to the complaint location.'
  });

  broadcastComplaintChange(targetIdStr, undefined, 'On the Way', 'Field Staff', 'En route to site');

  return true;
}

export async function startStaffWork(complaintId: string, photoBeforeWorkUrl?: string): Promise<boolean> {
  const targetIdStr = String(complaintId || '').trim();

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    await fetch(`${getApiUrl()}/api/staff/task/${encodeURIComponent(targetIdStr)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        status: 'In Progress',
        ...(photoBeforeWorkUrl ? { photo_before_work_url: photoBeforeWorkUrl } : {})
      })
    });
  } catch (apiErr) {
    console.warn('Backend startStaffWork API note:', apiErr);
  }

  // 2. Supabase if configured
  if (isSupabaseConfigured() && targetIdStr) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdStr);
      let supaQuery = supabase.from('complaints').update({
        status: 'In Progress',
        ...(photoBeforeWorkUrl ? { photo_before_work_url: photoBeforeWorkUrl } : {}),
        updated_at: new Date().toISOString()
      });
      if (isUuid) {
        supaQuery = supaQuery.eq('id', targetIdStr);
      } else {
        supaQuery = supaQuery.eq('complaint_number', targetIdStr);
      }
      await supaQuery;
    } catch (e) {}
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: targetIdStr,
    role: 'citizen',
    complaint_id: targetIdStr,
    complaint_number: targetIdStr,
    type: 'work_started',
    title: 'Repair Work Commenced',
    message: `On-site repair work has started for complaint ${targetIdStr}.`
  });

  broadcastComplaintChange(targetIdStr, undefined, 'In Progress', 'Field Staff', 'Commenced site repair');

  return true;
}

export async function submitStaffResolution(
  complaintId: string,
  photoAfterInput: string | File,
  workPerformed: string,
  materialsUsed?: string,
  additionalNotes?: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  let dbWriteVerified = false;
  let apiResponseData: any = null;
  let dbUpdateDetails: any = null;

  let photoAfterUrl = '';
  if (photoAfterInput instanceof File) {
    photoAfterUrl = await uploadComplaintImage(photoAfterInput, 'issues');
  } else {
    photoAfterUrl = photoAfterInput || '';
  }

  const comp = await getComplaintById(complaintId);
  const oldStatus = comp ? comp.status : 'In Progress';
  const staffId = comp?.assigned_staff_id || '';
  const staffEmail = comp?.assigned_staff_email || '';
  const deptId = comp?.department_id || '';

  let apiResStatus = 'N/A';

  // 1. Try Express backend API first if authenticated
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    if (token) {
      const targetParam = comp?.complaint_number || complaintId;
      const targetApiUrl = `${getApiUrl()}/api/staff/task/${encodeURIComponent(targetParam)}/resolve`;
      const apiRes = await fetch(targetApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complaint_number: comp?.complaint_number || complaintId,
          complaint_id: comp?.id || complaintId,
          photo_after_url: photoAfterUrl,
          work_performed: workPerformed,
          materials_used: materialsUsed || '',
          additional_notes: additionalNotes || ''
        })
      });
      apiResStatus = String(apiRes.status);
      apiResponseData = await apiRes.json().catch(() => ({ statusText: apiRes.statusText }));
      if (apiRes.ok) {
        dbWriteVerified = true;
        dbUpdateDetails = apiResponseData;
      }
    }
  } catch (apiErr) {
    console.warn('Backend resolve task API fallback:', apiErr);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId);
      const isNumeric = /^\d+$/.test(complaintId);

      const updateFields: Record<string, any> = {
        status: 'Resolution Submitted',
        photo_after_url: photoAfterUrl,
        work_performed: workPerformed,
        materials_used: materialsUsed || '',
        additional_notes: additionalNotes || '',
        updated_at: nowIso
      };

      let supaQuery = supabase.from('complaints').update(updateFields);
      if (isUuid) {
        supaQuery = supaQuery.eq('id', complaintId);
      } else if (isNumeric) {
        supaQuery = supaQuery.eq('id', parseInt(complaintId, 10));
      } else {
        supaQuery = supaQuery.eq('complaint_number', complaintId);
      }

      const { data: updateRows, error: supaErr } = await supaQuery.select();
      if (supaErr) {
        console.error('Supabase resolution update error:', supaErr);
      } else {
        // Read back from database to verify persistence
        let readQuery = supabase
          .from('complaints')
          .select('id, complaint_number, status, assigned_staff_id, assigned_staff_email, assigned_staff_name, photo_after_url, work_performed, materials_used, updated_at');
        if (isUuid) {
          readQuery = readQuery.eq('id', complaintId);
        } else if (isNumeric) {
          readQuery = readQuery.eq('id', parseInt(complaintId, 10));
        } else {
          readQuery = readQuery.eq('complaint_number', complaintId);
        }

        const { data: verifyRow } = await readQuery.maybeSingle();
        if (verifyRow && (verifyRow.status === 'Resolution Submitted' || (verifyRow.status as string) === 'Completed — Pending Verification')) {
          dbWriteVerified = true;
          dbUpdateDetails = verifyRow;
        } else {
          console.warn('Supabase read-back warning: Status in DB is', verifyRow?.status);
        }
      }
    } catch (e) {
      console.warn('Supabase resolution update exception:', e);
    }
  }

  // 3. Broadcast and notify
  if (comp) {
    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolution_submitted',
      title: 'Resolution Proof Submitted',
      message: `Maintenance team submitted repair proof for ${comp.complaint_number}. Under Department Head verification.`
    });

    pushNotification({
      user_id: comp.assigned_by || 'dh-group',
      role: 'department_head',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolution_submitted',
      title: 'Work Completed — Awaiting Verification',
      message: `Staff ${comp.assigned_staff_name || 'Officer'} uploaded resolution proof for ${comp.complaint_number}.`
    });

    broadcastComplaintChange(comp.id, oldStatus, 'Resolution Submitted', comp.assigned_staff_name || 'Field Staff', 'Submitted repair proof & work notes');
  }

  const resolvedTargetUrl = `${getApiUrl()}/api/staff/task/${encodeURIComponent(complaintId)}/resolve`;

  // DEVELOPMENT DIAGNOSTIC LOGGING (STEP 5)
  console.log('========== [STAFF COMPLETION DEBUG] ==========');
  console.log(`API URL: ${resolvedTargetUrl}`);
  console.log(`HTTP METHOD: POST`);
  console.log(`COMPLAINT ID: ${complaintId}`);
  console.log(`STAFF ID: ${staffId}`);
  console.log(`STAFF EMAIL: ${staffEmail}`);
  console.log(`DEPARTMENT: ${deptId}`);
  console.log(`CURRENT STATUS: ${oldStatus}`);
  console.log(`TARGET STATUS: Resolution Submitted`);
  console.log(`HTTP STATUS: ${apiResStatus}`);
  console.log(`BACKEND RESPONSE:`, apiResponseData);
  console.log(`DATABASE UPDATE RESULT:`, dbUpdateDetails);
  console.log(`READ-BACK RESULT: ${dbWriteVerified ? 'SUCCESS' : 'FAILED'}`);
  console.log('================================================');

  if (!dbWriteVerified) {
    throw new Error(`Task completion failed: Database UPDATE could not be verified at ${resolvedTargetUrl}. Please ensure network connection or database backend availability.`);
  }

  return true;
}

export async function reviewResolutionAdmin(
  complaintId: string,
  approve: boolean,
  rejectionReason?: string
): Promise<boolean> {
  const newStatus = approve ? 'Resolved' : 'Reopened';
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: newStatus,
          ...(rejectionReason ? { admin_rejection_reason: rejectionReason } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  // Broadcast and notify
  if (approve) {
    pushNotification({
      user_id: complaintId,
      role: 'citizen',
      complaint_id: complaintId,
      complaint_number: complaintId,
      type: 'resolved',
      title: 'Complaint Officially Resolved',
      message: `City Administration verified repair proof for ${complaintId}. Please rate the repair quality!`
    });
    broadcastComplaintChange(complaintId, 'Resolution Submitted', 'Resolved', 'City Administration', 'Approved resolution proof & closed issue');
  } else {
    pushNotification({
      user_id: complaintId,
      role: 'service_staff',
      complaint_id: complaintId,
      complaint_number: complaintId,
      type: 'reopened',
      title: 'Resolution Proof Rejected',
      message: `Resolution for ${complaintId} was rejected: ${rejectionReason}. Re-inspection required.`
    });
    broadcastComplaintChange(complaintId, 'Resolution Submitted', 'Reopened', 'City Administration', `Rejected resolution proof: ${rejectionReason}`);
  }
  return true;
}

export async function submitComplaintFeedback(complaintId: string, rating: number, comment: string): Promise<boolean> {
  let backendSuccess = false;
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    if (token) {
      const res = await fetch(`${getApiUrl()}/api/complaints/${encodeURIComponent(complaintId)}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, comment })
      });
      if (res.ok) {
        backendSuccess = true;
      }
    }
  } catch (err) {
    console.warn('Backend feedback error:', err);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('complaint_feedback').insert([{
        complaint_id: complaintId,
        rating,
        comment
      }]);
      backendSuccess = true;
    } catch (e) {}
  }

  return backendSuccess;
}

export async function reopenComplaint(complaintId: string, reason: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({ status: 'Reopened', updated_at: new Date().toISOString() })
        .eq('id', complaintId);
    } catch (e) {}
  }

  pushNotification({
    user_id: 'admin-group',
    role: 'city_admin',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'reopened',
    title: 'Citizen Reopened Complaint',
    message: `Citizen reopened complaint ${complaintId}: ${reason}`
  });

  broadcastComplaintChange(complaintId, undefined, 'Reopened', 'Citizen', `Citizen reopened issue: ${reason}`);
  return true;
}

export async function supportDuplicateComplaint(complaintId: string): Promise<number> {
  let count = 1;
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('complaints').select('support_count').eq('id', complaintId).maybeSingle();
      count = ((data?.support_count) || 0) + 1;
      await supabase
        .from('complaints')
        .update({ support_count: count })
        .eq('id', complaintId);
    } catch (e) {}
  }
  return count;
}

export function getStaffPerformanceMetrics(staffTasks: Complaint[]): StaffPerformanceMetrics {
  const completed = staffTasks.filter((t) => t.status === 'Resolved' || t.status === 'Resolution Submitted').length;
  const inProgress = staffTasks.filter((t) => t.status === 'In Progress' || t.status === 'Accepted' || t.status === 'On the Way').length;
  
  const now = new Date();
  const overdue = staffTasks.filter((t) => {
    if (t.status === 'Resolved') return false;
    if (!t.sla_deadline) return false;
    return new Date(t.sla_deadline) < now;
  }).length;

  const total = staffTasks.length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;

  return {
    tasksCompleted: completed,
    tasksInProgress: inProgress,
    avgResolutionHours: 4.2,
    overdueTasks: overdue,
    successRatePercentage: successRate
  };
}

export function saveOfflineDraft(draft: any) {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
    const drafts = data ? JSON.parse(data) : [];
    const draftId = draft.id || `draft-${Date.now()}`;
    drafts.unshift({ ...draft, id: draftId, savedAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {}
}

export function getOfflineDrafts(): any[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function clearOfflineDrafts() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
  } catch (e) {}
}

export function removeOfflineDraft(draftIdOrSavedAt: string) {
  try {
    const drafts = getOfflineDrafts();
    const filtered = drafts.filter((d: any) => d.id !== draftIdOrSavedAt && d.savedAt !== draftIdOrSavedAt);
    localStorage.setItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY, JSON.stringify(filtered));
  } catch (e) {}
}

export async function submitOfflineDraft(draft: any): Promise<Complaint> {
  const newComplaintData: Omit<Complaint, 'id' | 'created_at' | 'updated_at'> = {
    complaint_number: draft.complaint_number || generateComplaintNumber(),
    citizen_id: draft.citizen_id || '',
    category: draft.category || 'Other',
    title: draft.title || `${draft.category || 'Civic'} Issue Reported`,
    description: draft.description || '',
    priority: draft.priority || 'Medium',
    department_name: draft.department || draft.department_name || 'Public Works Department',
    department_id: draft.department_id,
    latitude: draft.lat != null ? Number(draft.lat) : 20.0059,
    longitude: draft.lng != null ? Number(draft.lng) : 73.7898,
    location_address: draft.locationAddress || 'Nashik City',
    location_source: draft.locationSource || 'manual_pin',
    photo_before_url: draft.photoPreviewUrl || draft.photo_before_url || '',
    status: 'Submitted'
  };

  const created = await createComplaint(newComplaintData);
  removeOfflineDraft(draft.id || draft.savedAt);
  return created;
}

// Department Head Workflow Functions
export async function assignTaskByDepartmentHead(
  complaintId: string,
  staffId: string,
  staffName: string,
  staffDept: string,
  headId: string,
  headName: string,
  headDept: string,
  staffEmail?: string,
  staffEmpId?: string
): Promise<boolean> {
  // CROSS-DEPARTMENT SECURITY CHECK
  const normDept = (d: string) => {
    const s = (d || '').split('(')[0].trim().toLowerCase();
    if (s.includes('pwd') || s.includes('public works')) return 'PWD';
    if (s.includes('san') || s.includes('sanitat')) return 'SAN';
    if (s.includes('wtr') || s.includes('water')) return 'WTR';
    if (s.includes('ele') || s.includes('electric')) return 'ELE';
    if (s.includes('trf') || s.includes('traffic')) return 'TRF';
    if (s.includes('mnt') || s.includes('mainten')) return 'MNT';
    if (s.includes('drn') || s.includes('drain')) return 'DRN';
    return s.toUpperCase();
  };

  const cleanStaffDept = normDept(staffDept);
  const cleanHeadDept = normDept(headDept);
  
  if (cleanStaffDept && cleanHeadDept && cleanStaffDept !== cleanHeadDept) {
    throw new Error(`CROSS-DEPARTMENT ASSIGNMENT REJECTED: Department Head of '${headDept}' cannot assign staff belonging to '${staffDept}'.`);
  }

  // 1. Try Backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const apiRes = await fetch(`${getApiUrl()}/api/department/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        staff_id: staffId
      })
    });

    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || errJson.message || `Server rejected task assignment (HTTP ${apiRes.status}).`);
    }
  } catch (apiErr: any) {
    if (apiErr.message && (apiErr.message.includes('Forbidden') || apiErr.message.includes('REJECTED') || apiErr.message.includes('inactive') || apiErr.message.includes('failed') || apiErr.message.includes('Server rejected'))) {
      throw apiErr;
    }
    console.warn('Backend assign task API fallback:', apiErr);
  }

  const compIdStr = String(complaintId || '').trim();

  // 2. Try Supabase if configured
  if (isSupabaseConfigured() && compIdStr) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(compIdStr);
      const updateFields: Record<string, any> = {
        assigned_staff_id: staffId,
        assigned_staff_name: staffName,
        assigned_staff_email: staffEmail || '',
        assigned_by: headId,
        assigned_by_name: headName,
        status: 'Staff Assigned',
        updated_at: new Date().toISOString()
      };

      let supaQuery = supabase.from('complaints').update(updateFields);
      if (isUuid) {
        supaQuery = supaQuery.eq('id', compIdStr);
      } else {
        supaQuery = supaQuery.eq('complaint_number', compIdStr);
      }

      const { data: updateRows, error: supaErr } = await supaQuery.select();
      if (supaErr) {
        console.error('Supabase task assignment update error:', supaErr);
      } else if (updateRows && updateRows.length > 0) {
        // Read back from database to verify persistence
        let readQuery = supabase.from('complaints').select('id, complaint_number, assigned_staff_id, assigned_staff_name, assigned_staff_email, status');
        if (isUuid) {
          readQuery = readQuery.eq('id', compIdStr);
        } else {
          readQuery = readQuery.eq('complaint_number', compIdStr);
        }

        const { data: verifyRow } = await readQuery.maybeSingle();
        if (verifyRow && verifyRow.status !== 'Staff Assigned') {
          console.warn('Supabase read-back warning: Status in DB is', verifyRow.status);
        }
      }
    } catch (e) {
      console.warn('Supabase task assignment exception:', e);
    }
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: staffId,
    role: 'service_staff',
    complaint_id: complaintId,
    complaint_number: compIdStr,
    type: 'staff_assigned',
    title: 'New Field Task Assigned',
    message: `Department Head ${headName} assigned task ${compIdStr} to you.`
  });

  broadcastComplaintChange(complaintId, 'Submitted', 'Staff Assigned', headName, `Assigned to ${staffName}`);
  return true;
}

export async function requestReworkDepartmentHead(
  complaintId: string,
  reworkReason: string,
  headName: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const apiRes = await fetch(`${getApiUrl()}/api/department/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        verified_by_name: headName,
        status: 'Reopened',
        rework_reason: reworkReason
      })
    });
    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || `Server rework request failed (HTTP ${apiRes.status}).`);
    }
  } catch (apiErr: any) {
    if (apiErr.message && (apiErr.message.includes('Forbidden') || apiErr.message.includes('failed') || apiErr.message.includes('Server'))) {
      throw apiErr;
    }
    console.warn('Backend rework task API fallback:', apiErr);
  }

  if (isSupabaseConfigured()) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId);
      let supaQuery = supabase
        .from('complaints')
        .update({
          status: 'Reopened',
          rework_reason: reworkReason,
          admin_rejection_reason: reworkReason,
          updated_at: nowIso
        });

      if (isUuid) {
        supaQuery = supaQuery.eq('id', complaintId);
      } else {
        supaQuery = supaQuery.eq('complaint_number', complaintId);
      }
      await supaQuery;
    } catch (e) {
      console.warn('Supabase request rework exception:', e);
    }
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: complaintId,
    role: 'service_staff',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'reopened',
    title: 'Field Work Rework Requested',
    message: `Department Head ${headName} requested rework on ${complaintId}: ${reworkReason}`
  });

  broadcastComplaintChange(complaintId, 'Resolution Submitted', 'Reopened', headName, `Requested rework: ${reworkReason}`);
  return true;
}

export async function approveResolutionDepartmentHead(
  complaintId: string,
  headName: string,
  headId?: string,
  deptId?: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const apiRes = await fetch(`${getApiUrl()}/api/department/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        verified_by: headId,
        verified_by_name: headName,
        status: 'Resolved'
      })
    });
    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || `Server verification failed (HTTP ${apiRes.status}).`);
    }
  } catch (apiErr: any) {
    if (apiErr.message && (apiErr.message.includes('Forbidden') || apiErr.message.includes('failed') || apiErr.message.includes('Server'))) {
      throw apiErr;
    }
    console.warn('Backend verify task API fallback:', apiErr);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId);
      const updatePayload: Record<string, any> = {
        status: 'Resolved',
        verified_by: headId || '',
        verified_by_name: headName,
        verified_at: nowIso,
        updated_at: nowIso
      };

      let supaQuery = supabase.from('complaints').update(updatePayload);
      if (isUuid) {
        supaQuery = supaQuery.eq('id', complaintId);
      } else {
        supaQuery = supaQuery.eq('complaint_number', complaintId);
      }

      const { data: updateRows, error: supaErr } = await supaQuery.select();
      if (supaErr) {
        console.error('Supabase verification update error:', supaErr);
      } else if (updateRows && updateRows.length > 0) {
        // Read back from database to verify persistence
        let readQuery = supabase.from('complaints').select('id, complaint_number, status, verified_by_name');
        if (isUuid) {
          readQuery = readQuery.eq('id', complaintId);
        } else {
          readQuery = readQuery.eq('complaint_number', complaintId);
        }

        const { data: verifyRow } = await readQuery.maybeSingle();
        if (verifyRow && verifyRow.status !== 'Resolved') {
          console.warn('Supabase read-back warning: Status in DB is', verifyRow.status);
        }
      }
    } catch (e) {
      console.warn('Supabase resolution verification exception:', e);
    }
  }

  // 3. Broadcast and notify
  pushNotification({
    user_id: complaintId,
    role: 'citizen',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'resolved',
    title: 'Complaint Officially Verified & Resolved',
    message: `Department Head ${headName} verified field repair proof and resolved ticket ${complaintId}.`
  });

  pushNotification({
    user_id: 'admin-group',
    role: 'city_admin',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'resolved',
    title: 'Department Resolution Approved',
    message: `Department Head ${headName} approved field resolution for ${complaintId}.`
  });

  broadcastComplaintChange(complaintId, 'Resolution Submitted', 'Resolved', headName, 'Approved field repair proof & closed ticket');
  return true;
}

export async function purgeAllComplaints(): Promise<boolean> {
  // 1. Clear LocalStorage cached complaints
  try {
    saveStoredComplaints([]);
    localStorage.removeItem(LOCAL_STORAGE_COMPLAINTS_KEY);
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
  } catch (e) {}

  // 2. Call backend API purge endpoint
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const res = await fetch(`${getApiUrl()}/api/complaints/purge-all`, { method: 'DELETE', headers });
    if (!res.ok) {
      console.warn('Backend purge complaints endpoint returned status:', res.status);
    }
  } catch (e) {
    console.warn('Backend purge complaints note:', e);
  }

  // 3. Purge Supabase table rows if configured
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('feedback').delete().neq('id', 0);
      await supabase.from('assignments').delete().neq('id', 0);
      await supabase.from('complaint_status_history').delete().neq('id', 0);
      await supabase.from('complaints').delete().neq('id', 0);
    } catch (e) {}
  }

  return true;
}
