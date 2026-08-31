import { Complaint, ComplaintStatus, PriorityLevel, StaffPerformanceMetrics } from '../types/database.types';
import { supabase, isSupabaseConfigured, isValidUuid } from '../lib/supabase';
import { broadcastComplaintChange } from './realtimeService';
import { pushNotification } from './notificationService';
import { getApiUrl } from '../config/apiConfig';
import { geocodeComplaintsWithoutCoordinates, auditAndRepairComplaintLocations } from './locationService';
import { resolveDepartmentInfo } from './departmentService';

const LOCAL_STORAGE_COMPLAINTS_KEY = 'nagarsetu_citizen_complaints_v3';
const LOCAL_STORAGE_OFFLINE_DRAFTS_KEY = 'nagarsetu_offline_drafts_v3';

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
  // Purge legacy storage keys if present
  LEGACY_STORAGE_KEYS.forEach((key) => {
    if (key !== LOCAL_STORAGE_COMPLAINTS_KEY) {
      try {
        const legacyData = localStorage.getItem(key);
        if (legacyData) {
          localStorage.removeItem(key);
        }
      } catch (e) {}
    }
  });

  const data = localStorage.getItem(LOCAL_STORAGE_COMPLAINTS_KEY);
  if (data) {
    try {
      const parsed: Complaint[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((c) => !isDemoComplaint(c));
        if (clean.length !== parsed.length) {
          saveStoredComplaints(clean);
        }
        return clean;
      }
    } catch (e) {}
  }
  return [];
}

export function saveStoredComplaints(complaints: Complaint[]) {
  const clean = complaints.filter((c) => !isDemoComplaint(c));
  localStorage.setItem(LOCAL_STORAGE_COMPLAINTS_KEY, JSON.stringify(clean));
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

  // Persistent Base64 Data URL fallback to prevent temporary blob expiration across reloads
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

// Fetch all complaints from Supabase with real geocoding fallback
export async function getAllComplaints(): Promise<Complaint[]> {
  let list: Complaint[] = [];
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        list = (data as Complaint[]).filter((c) => !isDemoComplaint(c));
      }
    } catch (err) {
      console.warn('Supabase getAllComplaints fallback:', err);
    }
  }

  if (list.length === 0) {
    list = getStoredComplaints();
  }

  const { repairedComplaints } = await auditAndRepairComplaintLocations(list);
  const cleanList = repairedComplaints.filter((c) => !isDemoComplaint(c));
  saveStoredComplaints(cleanList);
  return cleanList;
}

// Fetch citizen complaints from backend API, Supabase & LocalStorage
export async function getCitizenComplaints(citizenId: string): Promise<Complaint[]> {
  let list: Complaint[] = [];

  // 1. Try Express backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token');
    if (token) {
      const res = await fetch(`${getApiUrl()}/api/complaints/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.complaints)) {
          list = data.complaints as Complaint[];
        }
      }
    }
  } catch (bErr) {
    console.warn('Express backend getCitizenComplaints fallback note:', bErr);
  }

  // 2. Try Supabase if configured
  if (list.length === 0 && isSupabaseConfigured() && citizenId && isValidUuid(citizenId)) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('citizen_id', citizenId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        list = (data as Complaint[]).filter((c) => !isDemoComplaint(c));
      }
    } catch (err) {
      console.warn('Supabase getCitizenComplaints fallback:', err);
    }
  }

  // 3. Merge with LocalStorage cached complaints so local creations are preserved
  const localAll = getStoredComplaints();
  const filteredLocal = localAll.filter((c) => {
    if (isDemoComplaint(c)) return false;
    if (!citizenId || citizenId.trim() === '') return true;
    return (
      !c.citizen_id ||
      String(c.citizen_id) === String(citizenId) ||
      c.citizen_id === 'demo-citizen-id' ||
      c.citizen_id === ''
    );
  });

  const map = new Map<string, Complaint>();

  // Add backend / Supabase list items
  list.forEach((c) => {
    const key = c.complaint_number || String(c.id);
    if (key) map.set(key, c);
  });

  // Merge local items (preserving preview photos & local IDs)
  filteredLocal.forEach((lc) => {
    const key = lc.complaint_number || String(lc.id);
    if (key) {
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...lc } : lc);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Fetch staff tasks from Supabase, Express API & LocalStorage with strict staff data isolation
export async function getStaffTasks(
  staffId?: string,
  departmentName?: string,
  userEmail?: string,
  userName?: string,
  employeeId?: string
): Promise<Complaint[]> {
  const cleanStaffId = String(staffId || '').trim().toLowerCase();
  const cleanEmail = String(userEmail || '').trim().toLowerCase();
  const cleanName = String(userName || '').trim().toLowerCase();
  const cleanEmpId = String(employeeId || '').trim().toLowerCase();

  const allComplaints = await getAllComplaints();

  return allComplaints.filter((c) => {
    if (isDemoComplaint(c)) return false;

    // Strict Staff Isolation: If any staff identity parameter is present, match assigned staff
    if (cleanStaffId || cleanEmail || cleanName || cleanEmpId) {
      const cStaffId = String(c.assigned_staff_id || '').toLowerCase();
      const cStaffEmail = String(c.assigned_staff_email || '').toLowerCase();
      const cStaffName = String(c.assigned_staff_name || '').toLowerCase();
      const cStaffEmpId = String((c as any).assigned_staff_employee_id || (c as any).employee_id || '').toLowerCase();

      const matchId = Boolean(cleanStaffId && (
        cStaffId === cleanStaffId ||
        cStaffId.includes(cleanStaffId) ||
        cleanStaffId.includes(cStaffId)
      ));
      const matchEmail = Boolean(cleanEmail && cStaffEmail && (
        cStaffEmail === cleanEmail ||
        cStaffEmail.includes(cleanEmail) ||
        cleanEmail.includes(cStaffEmail)
      ));
      const matchName = Boolean(cleanName && cStaffName && (
        cStaffName === cleanName ||
        cStaffName.includes(cleanName) ||
        cleanName.includes(cStaffName)
      ));
      const matchEmpId = Boolean(cleanEmpId && (
        cStaffEmpId === cleanEmpId ||
        cStaffId === cleanEmpId ||
        cStaffEmpId.includes(cleanEmpId) ||
        cleanEmpId.includes(cStaffEmpId)
      ));

      return matchId || matchEmail || matchName || matchEmpId;
    }

    if (departmentName && departmentName !== 'All') {
      const targetDept = resolveDepartmentInfo(undefined, departmentName);
      const cResolved = resolveDepartmentInfo(c.department_id, c.department_name || (c as any).department, c.category);
      return cResolved.code === targetDept.code && (c.assigned_staff_id != null || c.status === 'Staff Assigned' || c.status === 'In Progress' || c.status === 'Accepted');
    }

    return c.assigned_staff_id != null || c.status === 'Staff Assigned' || c.status === 'In Progress' || c.status === 'Accepted';
  });
}

// Fetch complaints belonging to a specific department from Supabase, Express API & LocalStorage
export async function getDepartmentComplaints(departmentId?: string, departmentName?: string): Promise<Complaint[]> {
  if (!departmentId && !departmentName) {
    return [];
  }
  const targetDept = resolveDepartmentInfo(departmentId, departmentName);

  // 1. Fetch entire complaint pool across Supabase, Backend, and LocalStorage
  let allComplaints: Complaint[] = await getAllComplaints();

  // 2. Also query Express Backend API /api/complaints if available
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const res = await fetch(`${getApiUrl()}/api/complaints`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      const backendComplaints = Array.isArray(data) ? data : Array.isArray(data?.complaints) ? data.complaints : [];
      if (backendComplaints.length > 0) {
        const map = new Map<string, Complaint>();
        allComplaints.forEach((c) => map.set(c.id || c.complaint_number, c));
        backendComplaints.forEach((c: Complaint) => map.set(c.id || c.complaint_number, c));
        allComplaints = Array.from(map.values());
      }
    }
  } catch (e) {
    // Graceful fallback to allComplaints
  }

  // 3. Authoritatively filter complaints belonging to target department
  return allComplaints.filter((c) => {
    if (isDemoComplaint(c)) return false;

    if (departmentId && (String(c.department_id) === String(departmentId) || String(c.department_id) === targetDept.id)) {
      return true;
    }
    if ((c as any).department_code && (c as any).department_code.toUpperCase() === targetDept.code) {
      return true;
    }

    const cResolved = resolveDepartmentInfo(c.department_id, c.department_name || (c as any).department, c.category);
    return cResolved.code === targetDept.code;
  });
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

  // 3. Try LocalStorage cached complaints fallback
  const all = getStoredComplaints();
  const localMatch = all.find((c) =>
    String(c.id) === String(idOrNumber) ||
    (c.complaint_number && c.complaint_number.toLowerCase() === idOrNumber.toLowerCase())
  );

  if (localMatch) {
    comp = comp ? { ...localMatch, ...comp } : localMatch;
  }

  if (comp) {
    if (comp.latitude != null) comp.latitude = Number(comp.latitude);
    if (comp.longitude != null) comp.longitude = Number(comp.longitude);
  }

  return comp;
}

// Insert new complaint into Supabase & LocalStorage
export async function createComplaint(payload: Omit<Complaint, 'id' | 'created_at' | 'updated_at'>): Promise<Complaint> {
  const newComplaintNumber = payload.complaint_number || generateComplaintNumber();
  const parsedLat = payload.latitude != null ? Number(payload.latitude) : 0;
  const parsedLng = payload.longitude != null ? Number(payload.longitude) : 0;
  const resolvedDept = resolveDepartmentInfo(payload.department_id, payload.department_name);

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


  // Sync with Express backend API if authenticated
  try {
    const token = localStorage.getItem('nagarsetu_token');
    if (token) {
      const res = await fetch(`${getApiUrl()}/api/complaints/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complaint_number: newComplaint.complaint_number,
          photo_url: newComplaint.photo_before_url,
          category: newComplaint.category,
          title: newComplaint.title,
          description: newComplaint.description,
          priority: newComplaint.priority,
          latitude: newComplaint.latitude,
          longitude: newComplaint.longitude,
          location_source: newComplaint.location_source,
          location_address: newComplaint.location_address,
          department_id: newComplaint.department_id
        })
      });
      if (res.ok) {
        const bData = await res.json();
        if (bData) {
          if (bData.complaint_id) newComplaint.id = String(bData.complaint_id);
          if (bData.complaint_number) newComplaint.complaint_number = bData.complaint_number;
        }
      }
    }
  } catch (bErr) {
    console.warn('Backend API createComplaint sync note:', bErr);
  }

  const all = getStoredComplaints();
  all.unshift(newComplaint);
  saveStoredComplaints(all);

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
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({ status: 'Accepted', updated_at: new Date().toISOString() })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Accepted';
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'staff_assigned',
      title: 'Task Accepted by Field Officer',
      message: `Field officer ${comp.assigned_staff_name || 'Officer'} has accepted task ${comp.complaint_number}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Accepted', comp.assigned_staff_name || 'Field Staff', 'Staff accepted field task');
    return true;
  }
  return false;
}

export async function startStaffTravel(complaintId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({ status: 'On the Way', updated_at: new Date().toISOString() })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'On the Way';
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'staff_assigned',
      title: 'Field Staff En Route',
      message: `Maintenance officer is traveling to ${comp.location_address || 'the complaint location'}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'On the Way', comp.assigned_staff_name || 'Field Staff', 'En route to site');
    return true;
  }
  return false;
}

export async function startStaffWork(complaintId: string, photoBeforeWorkUrl?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: 'In Progress',
          ...(photoBeforeWorkUrl ? { photo_before_work_url: photoBeforeWorkUrl } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'In Progress';
    if (photoBeforeWorkUrl) comp.photo_before_work_url = photoBeforeWorkUrl;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'work_started',
      title: 'Repair Work Commenced',
      message: `On-site repair work has started for complaint ${comp.complaint_number}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'In Progress', comp.assigned_staff_name || 'Field Staff', 'Commenced site repair');
    return true;
  }
  return false;
}

export async function submitStaffResolution(
  complaintId: string,
  photoAfterUrl: string,
  workPerformed: string,
  materialsUsed?: string,
  additionalNotes?: string
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: 'Resolution Submitted',
          photo_after_url: photoAfterUrl,
          work_performed: workPerformed,
          materials_used: materialsUsed,
          additional_notes: additionalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Resolution Submitted';
    comp.photo_after_url = photoAfterUrl;
    comp.work_performed = workPerformed;
    comp.materials_used = materialsUsed;
    comp.additional_notes = additionalNotes;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolution_submitted',
      title: 'Resolution Proof Submitted',
      message: `Maintenance team submitted repair proof for ${comp.complaint_number}. Under City Administration verification.`
    });

    pushNotification({
      user_id: 'admin-group',
      role: 'city_admin',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolution_submitted',
      title: 'Resolution Submitted for Review',
      message: `Staff ${comp.assigned_staff_name || 'Officer'} uploaded resolution proof for ${comp.complaint_number}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Resolution Submitted', comp.assigned_staff_name || 'Field Staff', 'Submitted repair proof & work notes');
    return true;
  }
  return false;
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

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    if (approve) {
      comp.status = 'Resolved';
      
      pushNotification({
        user_id: comp.citizen_id,
        role: 'citizen',
        complaint_id: comp.id,
        complaint_number: comp.complaint_number,
        type: 'resolved',
        title: 'Complaint Officially Resolved',
        message: `City Administration verified repair proof for ${comp.complaint_number}. Please rate the repair quality!`
      });

      broadcastComplaintChange(comp.id, prevStatus, 'Resolved', 'City Administration', 'Approved resolution proof & closed issue');
    } else {
      comp.status = 'Reopened';
      comp.admin_rejection_reason = rejectionReason;
      comp.description += `\n\n[ADMIN REJECT REASON (${new Date().toLocaleDateString()})]: ${rejectionReason}`;
      
      pushNotification({
        user_id: comp.assigned_staff_id || '',
        role: 'service_staff',
        complaint_id: comp.id,
        complaint_number: comp.complaint_number,
        type: 'reopened',
        title: 'Resolution Proof Rejected',
        message: `Resolution for ${comp.complaint_number} was rejected: ${rejectionReason}. Re-inspection required.`
      });

      broadcastComplaintChange(comp.id, prevStatus, 'Reopened', 'City Administration', `Rejected resolution proof: ${rejectionReason}`);
    }
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);
    return true;
  }
  return false;
}

export async function submitComplaintFeedback(complaintId: string, rating: number, comment: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('complaint_feedback').insert([{
        complaint_id: complaintId,
        rating,
        comment
      }]);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    comp.rating = rating;
    comp.feedback_comment = comment;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);
    return true;
  }
  return false;
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

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Reopened';
    comp.description += `\n\n[CITIZEN REOPEN REASON (${new Date().toLocaleDateString()})]: ${reason}`;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: 'admin-group',
      role: 'city_admin',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'reopened',
      title: 'Citizen Reopened Complaint',
      message: `Citizen reopened complaint ${comp.complaint_number}: ${reason}`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Reopened', 'Citizen', `Citizen reopened issue: ${reason}`);
    return true;
  }
  return false;
}

export async function supportDuplicateComplaint(complaintId: string): Promise<number> {
  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  const count = comp ? (comp.support_count || 0) + 1 : 1;

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({ support_count: count })
        .eq('id', complaintId);
    } catch (e) {}
  }

  if (comp) {
    comp.support_count = count;
    saveStoredComplaints(all);
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
  const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
  const drafts = data ? JSON.parse(data) : [];
  drafts.unshift({ ...draft, savedAt: new Date().toISOString() });
  localStorage.setItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
}

export function getOfflineDrafts() {
  const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function clearOfflineDrafts() {
  localStorage.removeItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
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
      if (apiRes.status === 403 || apiRes.status === 400) {
        throw new Error(errJson.error || 'Server rejected task assignment.');
      }
    }
  } catch (apiErr: any) {
    if (apiErr.message && (apiErr.message.includes('Forbidden') || apiErr.message.includes('REJECTED') || apiErr.message.includes('inactive'))) {
      throw apiErr;
    }
    console.warn('Backend assign task API fallback:', apiErr);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      let isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId);
      let query = supabase.from('complaints').update({
        assigned_staff_id: staffId,
        assigned_staff_name: staffName,
        assigned_staff_email: staffEmail || '',
        assigned_staff_employee_id: staffEmpId || staffId,
        assigned_by: headId,
        assigned_by_name: headName,
        status: 'Staff Assigned',
        updated_at: new Date().toISOString()
      });

      if (isUuid) {
        await query.eq('id', complaintId);
      } else {
        await query.eq('complaint_number', complaintId);
      }
    } catch (e) {}
  }

  // 3. LocalStorage persistence
  const all = getStoredComplaints();
  let comp = all.find((c) => c.id === complaintId || c.complaint_number === complaintId);
  const prevStatus = comp ? comp.status : 'Submitted';

  if (!comp) {
    // If complaint was not yet in LocalStorage cache, create entry
    comp = {
      id: complaintId,
      complaint_number: complaintId.startsWith('NS-') ? complaintId : `NS-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      title: 'Assigned Civic Complaint',
      description: 'Task assigned by Department Head',
      category: 'General Civic Issue',
      priority: 'Medium',
      status: 'Staff Assigned',
      location_address: 'Nashik City',
      assigned_staff_id: staffId,
      assigned_staff_name: staffName,
      assigned_staff_email: staffEmail || '',
      assigned_staff_employee_id: staffEmpId || staffId,
      assigned_by: headId,
      assigned_by_name: headName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as unknown as Complaint;
    all.push(comp);
  } else {
    comp.assigned_staff_id = staffId;
    comp.assigned_staff_name = staffName;
    if (staffEmail) comp.assigned_staff_email = staffEmail;
    if (staffEmpId) (comp as any).assigned_staff_employee_id = staffEmpId;
    comp.assigned_by = headId;
    comp.assigned_by_name = headName;
    comp.status = 'Staff Assigned';
    comp.updated_at = new Date().toISOString();
  }

  saveStoredComplaints(all);

  pushNotification({
    user_id: staffId,
    role: 'service_staff',
    complaint_id: comp.id,
    complaint_number: comp.complaint_number,
    type: 'staff_assigned',
    title: 'New Field Task Assigned',
    message: `Department Head ${headName} assigned task ${comp.complaint_number} to you.`
  });

  broadcastComplaintChange(comp.id, prevStatus, 'Staff Assigned', headName, `Assigned to ${staffName}`);
  return true;
}

export async function requestReworkDepartmentHead(
  complaintId: string,
  reworkReason: string,
  headName: string
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: 'Reopened',
          rework_reason: reworkReason,
          admin_rejection_reason: reworkReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Reopened';
    comp.rework_reason = reworkReason;
    comp.admin_rejection_reason = reworkReason;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.assigned_staff_id || '',
      role: 'service_staff',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'reopened',
      title: 'Field Work Rework Requested',
      message: `Department Head ${headName} requested rework on ${comp.complaint_number}: ${reworkReason}`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Reopened', headName, `Requested rework: ${reworkReason}`);
    return true;
  }
  return false;
}

export async function approveResolutionDepartmentHead(
  complaintId: string,
  headName: string
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: 'Resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Resolved';
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolved',
      title: 'Complaint Officially Resolved',
      message: `Department Head ${headName} approved field repair proof for ${comp.complaint_number}.`
    });

    pushNotification({
      user_id: 'admin-group',
      role: 'city_admin',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'resolved',
      title: 'Department Resolution Approved',
      message: `Department Head ${headName} approved field resolution for ${comp.complaint_number}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Resolved', headName, 'Approved field repair proof');
    return true;
  }
  return false;
}
