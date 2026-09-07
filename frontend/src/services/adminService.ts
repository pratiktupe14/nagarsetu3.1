import { Complaint, ComplaintActivityLog, DepartmentStaffMember, AdminKPIStats, PriorityLevel } from '../types/database.types';
import { getAllComplaints } from './complaintService';
import { broadcastComplaintChange } from './realtimeService';
import { pushNotification } from './notificationService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl, getNoCacheHeaders } from '../config/apiConfig';
import { resolveDepartmentInfo, isStaffInDepartment } from './departmentService';

const LOCAL_STORAGE_ACTIVITY_LOGS_KEY = 'nagarsetu_activity_logs_v5';

const LOCAL_STORAGE_DEPARTMENTS_KEY = 'nagarsetu_departments_v3';

export interface MunicipalDepartmentRecord {
  id: string;
  name: string;
  code: string;
  department_head: string;
  contact_number: string;
  email: string;
  description: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

const DEFAULT_MUNICIPAL_DEPARTMENTS: MunicipalDepartmentRecord[] = [
  {
    id: 'dept-PWD',
    name: 'Roads & Public Works (PWD)',
    code: 'PWD-01',
    department_head: 'Rahul Kumar',
    contact_number: '+91 98220 00001',
    email: 'rahul.kumar@nagarsetu.gov.in',
    description: 'Asphalt road repairs, pothole filling, sidewalk paving, and structural civic infrastructure maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-SAN',
    name: 'Sanitation & Waste Management',
    code: 'SAN-01',
    department_head: 'Amit Sharma',
    contact_number: '+91 98220 00002',
    email: 'amit.sharma@nagarsetu.gov.in',
    description: 'Solid waste collection, dumpster clearing, street sweeping, market sanitation, and public hygiene.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-WTR',
    name: 'Water Supply & Sewerage Board',
    code: 'WTR-01',
    department_head: 'Vikram Patil',
    contact_number: '+91 98220 00003',
    email: 'vikram.patil@nagarsetu.gov.in',
    description: 'Potable water mains, underground pipeline leakage sealing, valve control, and sewage network maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-ELE',
    name: 'Electrical & Lighting Dept',
    code: 'ELE-01',
    department_head: 'Aditya Joshi',
    contact_number: '+91 98220 00005',
    email: 'aditya.joshi@nagarsetu.gov.in',
    description: 'LED streetlights, junction box repairs, feeder pillar cabinets, and municipal electrical grid maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-DRN',
    name: 'Drainage & Sewage Department',
    code: 'DRN-01',
    department_head: 'Sanjay More',
    contact_number: '+91 98220 00004',
    email: 'sanjay.more@nagarsetu.gov.in',
    description: 'Monsoon stormwater channels, drain de-silting, culvert clearing, and urban flood mitigation.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-TRF',
    name: 'Traffic Management Dept',
    code: 'TRF-01',
    department_head: 'Rohan Deshmukh',
    contact_number: '+91 98220 00006',
    email: 'rohan.deshmukh@nagarsetu.gov.in',
    description: 'Traffic light signals, road signage, speed breakers, zebra crossings, and junction traffic flow.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-MNT',
    name: 'Maintenance Department',
    code: 'MNT-01',
    department_head: 'Kunal Kulkarni',
    contact_number: '+91 98220 00007',
    email: 'kunal.kulkarni@nagarsetu.gov.in',
    description: 'General civic facility repairs, building maintenance, public asset upkeep, and municipal asset management.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  }
];

// In-memory runtime cache for municipal departments (PostgreSQL is authoritative source)
let memoryDepartments: MunicipalDepartmentRecord[] = [...DEFAULT_MUNICIPAL_DEPARTMENTS];

try {
  localStorage.removeItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
} catch (e) {}

export function getMunicipalDepartments(): MunicipalDepartmentRecord[] {
  return memoryDepartments;
}

export function setMemoryMunicipalDepartments(depts: MunicipalDepartmentRecord[]) {
  memoryDepartments = depts;
}

export function saveMunicipalDepartments(depts: MunicipalDepartmentRecord[]) {
  memoryDepartments = depts;
}

export function saveOrUpdateMunicipalDepartment(dept: Omit<MunicipalDepartmentRecord, 'id' | 'created_at'> & { id?: string }): MunicipalDepartmentRecord {
  const all = getMunicipalDepartments();
  if (dept.id) {
    const existingIndex = all.findIndex((d) => d.id === dept.id);
    if (existingIndex >= 0) {
      const updated: MunicipalDepartmentRecord = {
        ...all[existingIndex],
        ...dept
      };
      all[existingIndex] = updated;
      saveMunicipalDepartments(all);
      return updated;
    }
  }

  const newDept: MunicipalDepartmentRecord = {
    ...dept,
    id: 'dept-' + Date.now(),
    created_at: new Date().toISOString()
  };
  all.unshift(newDept);
  saveMunicipalDepartments(all);
  return newDept;
}

export async function saveMunicipalDepartmentApi(
  dept: Omit<MunicipalDepartmentRecord, 'id' | 'created_at'> & { id?: string }
): Promise<MunicipalDepartmentRecord> {
  const token = localStorage.getItem('nagarsetu_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const isEdit = Boolean(dept.id && !dept.id.startsWith('dept-'));
  const url = isEdit
    ? `${getApiUrl()}/admin/departments/${dept.id}`
    : `${getApiUrl()}/admin/departments`;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({
        name: dept.name,
        code: dept.code,
        description: dept.description
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to save department to database');
    }

    const data = await res.json();
    const savedRecord: MunicipalDepartmentRecord = {
      id: String(data.department?.id || dept.id || 'dept-' + Date.now()),
      name: data.department?.name || dept.name,
      code: data.department?.code || dept.code,
      department_head: dept.department_head,
      contact_number: dept.contact_number,
      email: dept.email,
      description: data.department?.description || dept.description || '',
      status: dept.status,
      created_at: data.department?.created_at || new Date().toISOString()
    };

    saveOrUpdateMunicipalDepartment(savedRecord);
    return savedRecord;
  } catch (err: any) {
    console.error('saveMunicipalDepartmentApi error:', err);
    throw err;
  }
}

export async function deleteMunicipalDepartmentApi(id: string): Promise<void> {
  const token = localStorage.getItem('nagarsetu_token');
  const headers = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const res = await fetch(`${getApiUrl()}/admin/departments/${id}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Failed to delete department from database');
  }

  const all = getMunicipalDepartments().filter((d) => d.id !== id);
  saveMunicipalDepartments(all);
}

const LOCAL_STORAGE_STAFF_KEY = 'nagarsetu_service_staff_v3';

function getAuthHeaders(): HeadersInit {
  return getNoCacheHeaders({ 'Content-Type': 'application/json' });
}

export interface DepartmentStaffApiItem {
  id: string;
  name: string;
  email: string;
  mobile: string;
  contact_number: string;
  employee_id: string;
  designation: string;
  department_id?: string | null;
  department_name?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  language: string;
  joined_date: string;
  created_at: string;
}

export interface DepartmentStaffApiSummary {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  activeTasks: number;
}

export async function fetchDepartmentStaffApi(params?: {
  status?: string;
  search?: string;
  department_id?: string;
}): Promise<{ staff: DepartmentStaffApiItem[]; summary: DepartmentStaffApiSummary }> {
  try {
    const qParams = new URLSearchParams();
    if (params?.status) qParams.append('status', params.status);
    if (params?.search) qParams.append('search', params.search);
    if (params?.department_id) qParams.append('department_id', params.department_id);

    const res = await fetch(`${getApiUrl()}/api/department/staff?${qParams.toString()}`, {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
        const mappedStaff: ServiceStaffMemberRecord[] = data.staff.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          employee_id: s.employee_id || `STF-${s.id}`,
          department_name: s.department_name || 'Municipal Department',
          role: s.designation || s.role || 'Service Staff',
          status: (s.status || 'active').toLowerCase() === 'active' ? 'Available' : 'Offline',
          contact_number: s.mobile || s.contact_number || s.phone || '+91 98220 00000',
          email: s.email,
          ward_area: 'Nashik City',
          joined_date: s.created_at || new Date().toISOString(),
          created_at: s.created_at || new Date().toISOString(),
          active_tasks: s.active_tasks || 0,
          completed_tasks: s.completed_tasks || 0,
          overdue_tasks: s.overdue_tasks || 0
        }));
        if (mappedStaff.length > 0) {
          memoryStaffRecords = mappedStaff;
        }
        return {
          staff: data.staff,
          summary: data.summary || {
            totalStaff: data.staff.length,
            activeStaff: data.staff.filter((s: any) => (s.status || 'Active').toLowerCase() === 'active').length,
            inactiveStaff: data.staff.filter((s: any) => (s.status || '').toLowerCase() === 'inactive').length,
            activeTasks: data.staff.reduce((acc: number, s: any) => acc + (parseInt(s.active_tasks || 0, 10)), 0)
          }
        };
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to fetch department staff (HTTP ${res.status})`);
    } catch (err: any) {
      console.error('Failed to fetch staff from API:', err);
      throw err;
    }
  }

export async function createServiceStaffApi(payload: {
  name: string;
  mobile: string;
  email?: string;
  password: string;
  employee_id?: string;
  designation?: string;
  language?: string;
  department_id?: string;
}): Promise<{ success: boolean; staff?: DepartmentStaffApiItem; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, staff: data.staff };
    }
    return { success: false, error: data.error || 'Failed to create staff member' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

export async function updateServiceStaffApi(id: string, payload: Partial<DepartmentStaffApiItem>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

export async function deactivateServiceStaffApi(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}/deactivate`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

export async function activateServiceStaffApi(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

export async function removeServiceStaffApi(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server error' };
  }
}

export interface ServiceStaffMemberRecord {
  id: string;
  name: string;
  employee_id: string;
  department_id?: string | number;
  department_name: string;
  role: string;
  status: 'Available' | 'On Task' | 'Offline' | 'On Leave' | 'Busy';
  contact_number: string;
  email: string;
  ward_area: string;
  joined_date: string;
  created_at: string;
  active_tasks?: number;
  completed_tasks?: number;
  overdue_tasks?: number;
}

export const DEMO_SERVICE_STAFF_RECORDS: ServiceStaffMemberRecord[] = [];

const DEFAULT_SERVICE_STAFF: ServiceStaffMemberRecord[] = [];

// In-memory runtime cache for service staff records (PostgreSQL is authoritative source)
let memoryStaffRecords: ServiceStaffMemberRecord[] = [];
let isFetchingStaff = false;

try {
  localStorage.removeItem(LOCAL_STORAGE_STAFF_KEY);
} catch (e) {}

export function getAllServiceStaffRecords(): ServiceStaffMemberRecord[] {
  if (memoryStaffRecords.length === 0 && !isFetchingStaff) {
    isFetchingStaff = true;
    fetchDepartmentStaffApi()
      .then((res) => {
        if (res && res.staff && res.staff.length > 0) {
          memoryStaffRecords = res.staff.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            employee_id: s.employee_id || `STF-${s.id}`,
            department_name: s.department_name || 'Municipal Department',
            role: s.designation || s.role || 'Service Staff',
            status: (s.status || 'active').toLowerCase() === 'active' ? 'Available' : 'Offline',
            contact_number: s.mobile || s.contact_number || s.phone || '+91 98220 00000',
            email: s.email,
            ward_area: 'Nashik City',
            joined_date: s.created_at || new Date().toISOString(),
            created_at: s.created_at || new Date().toISOString(),
            active_tasks: s.active_tasks || 0,
            completed_tasks: s.completed_tasks || 0,
            overdue_tasks: s.overdue_tasks || 0
          }));
        }
      })
      .catch((err) => console.warn('Background staff fetch error:', err))
      .finally(() => { isFetchingStaff = false; });
  }
  return memoryStaffRecords;
}

export function setMemoryServiceStaffRecords(staff: ServiceStaffMemberRecord[]) {
  memoryStaffRecords = staff;
}

export async function getDepartmentServiceStaff(departmentId?: string, departmentName?: string): Promise<ServiceStaffMemberRecord[]> {
  if (!departmentId && !departmentName) {
    return [];
  }

  // 1. Try Backend Express API first
  try {
    const apiRes = await fetchDepartmentStaffApi({ department_id: departmentId });
    if (apiRes && Array.isArray(apiRes.staff)) {
      return apiRes.staff.map((s) => ({
        id: s.id,
        name: s.name,
        employee_id: s.employee_id,
        department_name: s.department_name || departmentName || 'Municipal Department',
        role: s.designation || 'Service Staff',
        status: s.status === 'Active' ? 'Available' : 'Offline',
        contact_number: s.contact_number || s.mobile || '+91 98220 00000',
        email: s.email,
        ward_area: 'Nashik City',
        joined_date: s.joined_date || new Date().toISOString(),
        created_at: s.created_at || new Date().toISOString(),
        active_tasks: s.active_tasks || 0,
        completed_tasks: s.completed_tasks || 0,
        overdue_tasks: s.overdue_tasks || 0
      }));
    }
  } catch (e) {
    console.warn('fetchDepartmentStaffApi failed in getDepartmentServiceStaff:', e);
  }

  function isValidUuid(id?: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'service_staff');
      if (departmentId && isValidUuid(departmentId)) {
        query = query.eq('department_id', departmentId);
      } else if (departmentName) {
        const cleanDept = departmentName.split('(')[0].trim();
        query = query.or(`department_name.ilike.%${cleanDept}%,employee_id.ilike.%${cleanDept}%`);
      }
      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.full_name || p.name || 'Staff Member',
          employee_id: p.employee_id || `STF-${String(p.id).slice(0, 4).toUpperCase()}`,
          department_name: p.department_name || departmentName || 'Municipal Department',
          role: 'Service Staff',
          status: p.status || 'Available',
          contact_number: p.phone_number || p.mobile || '+91 98220 00000',
          email: p.email || 'staff@nagarsetu.gov.in',
          ward_area: p.ward_area || 'Nashik City',
          joined_date: p.created_at || new Date().toISOString(),
          created_at: p.created_at || new Date().toISOString()
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch staff error:', e);
    }
  }

  return [];
}

export async function getStaffMemberById(staffId: string): Promise<ServiceStaffMemberRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', staffId).single();
      if (!error && data) {
        return {
          id: data.id,
          name: data.full_name || data.name || 'Staff Member',
          employee_id: data.employee_id || `STF-${String(data.id).slice(0, 4).toUpperCase()}`,
          department_name: data.department_name || 'Municipal Department',
          role: 'Service Staff',
          status: data.status || 'Available',
          contact_number: data.phone_number || '+91 98220 00000',
          email: data.email || 'staff@nagarsetu.gov.in',
          ward_area: data.ward_area || 'Nashik City',
          joined_date: data.created_at || new Date().toISOString(),
          created_at: data.created_at || new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn('Supabase fetch staff by ID error:', e);
    }
  }

  const all = getAllServiceStaffRecords();
  const staff = all.find((s) => s.id === staffId || s.employee_id === staffId) || null;
  if (!staff) return null;

  const storedComplaints = await getAllComplaints().catch(() => []);
  const isAssigned = (c: any) =>
    c.assigned_staff_id === staff.id ||
    c.assigned_staff_id === staff.employee_id ||
    (c.assigned_staff_email && c.assigned_staff_email.toLowerCase() === (staff.email || '').toLowerCase()) ||
    c.assigned_staff_name === staff.name;

  const activeTasks = storedComplaints.filter(
    (c) => isAssigned(c) && ['Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified'].includes(c.status)
  ).length;

  const completedTasks = storedComplaints.filter(
    (c) => isAssigned(c) && c.status === 'Resolved'
  ).length;

  const overdueTasks = storedComplaints.filter(
    (c) => isAssigned(c) && ((c.status as string) === 'Overdue' || (c.status !== 'Resolved' && c.status !== 'Rejected' && c.sla_deadline && new Date(c.sla_deadline) < new Date()))
  ).length;

  return {
    ...staff,
    active_tasks: activeTasks,
    completed_tasks: completedTasks,
    overdue_tasks: overdueTasks
  };
}

export function saveServiceStaffRecords(staff: ServiceStaffMemberRecord[]) {
  memoryStaffRecords = staff;
}

export function saveOrUpdateServiceStaffRecord(staff: Omit<ServiceStaffMemberRecord, 'id' | 'created_at'> & { id?: string }): ServiceStaffMemberRecord {
  const all = getAllServiceStaffRecords();
  if (staff.id) {
    const existingIndex = all.findIndex((s) => s.id === staff.id);
    if (existingIndex >= 0) {
      const updated: ServiceStaffMemberRecord = {
        ...all[existingIndex],
        ...staff
      };
      all[existingIndex] = updated;
      saveServiceStaffRecords(all);
      return updated;
    }
  }

  const newStaff: ServiceStaffMemberRecord = {
    ...staff,
    id: 'staff-' + Date.now(),
    created_at: new Date().toISOString()
  };
  all.unshift(newStaff);
  saveServiceStaffRecords(all);
  return newStaff;
}

export function getDepartmentStaffRoster(departmentName?: string, complaints: Complaint[] = []): DepartmentStaffMember[] {
  const allStaff = getAllServiceStaffRecords();
  const roster: DepartmentStaffMember[] = allStaff.map((s) => {
    const activeTasks = complaints.filter(
      (c) => (c.assigned_staff_id === s.id || c.assigned_staff_id === s.employee_id || (c.assigned_staff_email && c.assigned_staff_email.toLowerCase() === (s.email || '').toLowerCase()) || c.assigned_staff_name === s.name) && c.status !== 'Resolved' && c.status !== 'Rejected'
    ).length;
    return {
      id: s.id,
      name: s.name,
      employee_id: s.employee_id,
      department_name: s.department_name,
      active_workload_count: activeTasks,
      is_online: s.status === 'Available' || s.status === 'On Task' || s.status === 'Busy' || (s.status as string) === 'Active'
    };
  });

  if (!departmentName || departmentName === 'All') return roster;

  const dLower = String(departmentName || '').toLowerCase();
  return roster.filter((s) => {
    const sLower = String(s.department_name || '').toLowerCase();
    if (sLower.includes(dLower) || dLower.includes(sLower)) return true;

    // Department Codes & Names cross-mapping (DEPT-1 through DEPT-7)
    if ((dLower.includes('pwd') || dLower.includes('public works') || dLower.includes('road') || dLower.includes('dept-1')) &&
        (sLower.includes('pwd') || sLower.includes('public works') || sLower.includes('road'))) return true;

    if ((dLower.includes('san') || dLower.includes('sanitation') || dLower.includes('waste') || dLower.includes('dept-2')) &&
        (sLower.includes('san') || sLower.includes('sanitation') || sLower.includes('waste'))) return true;

    if ((dLower.includes('wtr') || dLower.includes('water') || dLower.includes('dept-3')) &&
        (sLower.includes('wtr') || sLower.includes('water'))) return true;

    if ((dLower.includes('drn') || dLower.includes('drain') || dLower.includes('sewag') || dLower.includes('dept-4')) &&
        (sLower.includes('drn') || sLower.includes('drain') || sLower.includes('sewag'))) return true;

    if ((dLower.includes('ele') || dLower.includes('electric') || dLower.includes('light') || dLower.includes('dept-5')) &&
        (sLower.includes('ele') || sLower.includes('electric') || sLower.includes('light'))) return true;

    if ((dLower.includes('trf') || dLower.includes('traffic') || dLower.includes('transport') || dLower.includes('dept-6')) &&
        (sLower.includes('trf') || sLower.includes('traffic') || sLower.includes('transport'))) return true;

    if ((dLower.includes('mnt') || dLower.includes('maint') || dLower.includes('dept-7')) &&
        (sLower.includes('mnt') || sLower.includes('maint'))) return true;

    return false;
  });
}

export function calculateAdminKPIStats(complaints: Complaint[]): AdminKPIStats {
  const now = new Date();

  const total = complaints.length;
  const newCount = complaints.filter((c) => c.status === 'Submitted').length;
  const pendingVerification = complaints.filter((c) => c.status === 'Verified' || c.status === 'Submitted').length;
  const approved = complaints.filter((c) => c.status === 'Approved' || c.status === 'Department Assigned').length;
  const inProgress = complaints.filter((c) => c.status === 'In Progress' || c.status === 'Staff Assigned' || c.status === 'Accepted' || c.status === 'On the Way').length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const reopened = complaints.filter((c) => c.status === 'Reopened').length;
  
  const overdue = complaints.filter((t) => {
    if (t.status === 'Resolved') return false;
    if (!t.sla_deadline) return false;
    return new Date(t.sla_deadline) < now;
  }).length;

  const critical = complaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved').length;

  return {
    total,
    newCount,
    pendingVerification,
    approved,
    inProgress,
    resolved,
    reopened,
    overdue,
    critical
  };
}

export function formatSlaRemainingTime(slaDeadline?: string): { text: string; isOverdue: boolean } {
  if (!slaDeadline) return { text: '24h SLA', isOverdue: false };
  const diffMs = new Date(slaDeadline).getTime() - Date.now();
  if (diffMs <= 0) {
    const overdueMins = Math.abs(Math.floor(diffMs / 60000));
    const hours = Math.floor(overdueMins / 60);
    return { text: `Overdue by ${hours}h ${overdueMins % 60}m`, isOverdue: true };
  }
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return { text: `${hours}h ${mins}m remaining`, isOverdue: false };
}

export async function verifyAndApproveComplaint(
  complaintId: string,
  priority: PriorityLevel,
  departmentName: string,
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          status: 'Approved',
          priority,
          department_name: departmentName,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${complaintId},complaint_number.eq.${complaintId}`);
    } catch (e) {}
  }

  logActivity(complaintId, adminName, 'Verified & Approved Complaint', 'Submitted', 'Approved', `Priority set to ${priority}, Department routed to ${departmentName}`);
  
  pushNotification({
    user_id: complaintId,
    role: 'citizen',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'approved',
    title: 'Complaint Verified & Approved',
    message: `Your complaint ${complaintId} has been verified and approved for ${departmentName} dispatch.`
  });

  broadcastComplaintChange(complaintId, 'Submitted', 'Approved', adminName, `Approved & routed to ${departmentName}`);
  return true;
}

export async function changeDepartmentRouting(
  complaintId: string,
  departmentName: string,
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          department_name: departmentName,
          status: 'Department Assigned',
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${complaintId},complaint_number.eq.${complaintId}`);
    } catch (e) {}
  }

  logActivity(complaintId, adminName, 'Re-routed Department', 'Submitted', 'Department Assigned', `Department updated to ${departmentName}`);
  
  pushNotification({
    user_id: complaintId,
    role: 'citizen',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'department_assigned',
    title: 'Department Assigned',
    message: `Complaint ${complaintId} routed to ${departmentName}.`
  });

  broadcastComplaintChange(complaintId, 'Submitted', 'Department Assigned', adminName, `Re-routed to ${departmentName}`);
  return true;
}

export async function assignStaffToTask(
  complaintId: string,
  staffId: string,
  staffName: string,
  slaHours: number = 24,
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  const slaDeadline = new Date(Date.now() + slaHours * 3600000).toISOString();

  // 1. Try Backend API (/api/department/assign then /api/officer/assign fallback)
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    let res = await fetch(`${getApiUrl()}/api/department/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ complaint_id: complaintId, staff_id: staffId })
    });
    if (!res.ok) {
      await fetch(`${getApiUrl()}/api/officer/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ complaint_id: complaintId, staff_id: staffId })
      });
    }
  } catch (e) {
    console.warn('Backend assignStaffToTask error fallback:', e);
  }

  // 2. Try Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          assigned_staff_id: staffId,
          assigned_staff_name: staffName,
          status: 'Staff Assigned',
          sla_deadline: slaDeadline,
          updated_at: new Date().toISOString()
        })
        .or(`id.eq.${complaintId},complaint_number.eq.${complaintId}`);
    } catch (e) {}
  }

  // 3. Activity log & notification
  logActivity(complaintId, adminName, 'Assigned Field Staff', 'Submitted', 'Staff Assigned', `Dispatched to ${staffName} with ${slaHours}h SLA deadline`);
  
  pushNotification({
    user_id: complaintId,
    role: 'citizen',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'staff_assigned',
    title: 'Field Officer Dispatched',
    message: `Field officer ${staffName} assigned to repair ${complaintId}.`
  });

  pushNotification({
    user_id: staffId,
    role: 'service_staff',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'staff_assigned',
    title: 'New Maintenance Task Dispatched',
    message: `Task ${complaintId} assigned to you with ${slaHours}h SLA deadline.`
  });

  broadcastComplaintChange(complaintId, 'Submitted', 'Staff Assigned', adminName, `Assigned to staff ${staffName}`);
  return true;
}

export async function escalateComplaint(
  complaintId: string,
  escalationTarget: string = 'Senior Department Officer',
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  logActivity(
    complaintId,
    adminName,
    `Escalated to ${escalationTarget}`,
    'In Progress',
    'Escalated',
    `SLA Breach Escalation: High priority notice dispatched to ${escalationTarget}`
  );

  pushNotification({
    user_id: 'admin-group',
    role: 'city_admin',
    complaint_id: complaintId,
    complaint_number: complaintId,
    type: 'sla_breached',
    title: `ESCALATION: ${complaintId}`,
    message: `Complaint ${complaintId} has been escalated to ${escalationTarget} due to SLA breach.`
  });

  broadcastComplaintChange(complaintId, 'In Progress', 'In Progress', adminName, `Escalated to ${escalationTarget}`);
  return true;
}

// In-memory activity logs cache (PostgreSQL complaint_status_history is authoritative)
let memoryActivityLogs: ComplaintActivityLog[] = [];

try {
  localStorage.removeItem(LOCAL_STORAGE_ACTIVITY_LOGS_KEY);
} catch (e) {}

export async function fetchComplaintActivityLogs(complaintId: string): Promise<ComplaintActivityLog[]> {
  if (!complaintId) return [];

  // 1. Try Backend API first (/api/complaints/:id/history)
  try {
    const token = localStorage.getItem('nagarsetu_token') || sessionStorage.getItem('nagarsetu_token');
    const res = await fetch(`${getApiUrl()}/api/complaints/${encodeURIComponent(complaintId)}/history`, {
      headers: getNoCacheHeaders(token ? { Authorization: `Bearer ${token}` } : {})
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.history)) {
        const mapped: ComplaintActivityLog[] = data.history.map((h: any) => ({
          id: String(h.id),
          complaint_id: String(h.complaint_id),
          actor_name: h.updated_by || 'System',
          action: h.remark || `Status: ${h.status}`,
          previous_status: undefined,
          new_status: h.status,
          notes: h.remark,
          created_at: h.created_at || new Date().toISOString()
        }));
        memoryActivityLogs = memoryActivityLogs.filter(l => l.complaint_id !== complaintId).concat(mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Backend fetchComplaintActivityLogs error:', err);
  }

  // 2. Try Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('complaint_status_history')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        const mapped: ComplaintActivityLog[] = data.map((h: any) => ({
          id: String(h.id),
          complaint_id: String(h.complaint_id),
          actor_name: h.updated_by || 'System',
          action: h.remark || `Status: ${h.status}`,
          previous_status: undefined,
          new_status: h.status,
          notes: h.remark,
          created_at: h.created_at || new Date().toISOString()
        }));
        memoryActivityLogs = memoryActivityLogs.filter(l => l.complaint_id !== complaintId).concat(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetch complaint history error:', err);
    }
  }

  return memoryActivityLogs.filter(l => l.complaint_id === complaintId);
}

export function getComplaintActivityLogs(complaintId: string): ComplaintActivityLog[] {
  return memoryActivityLogs.filter((l) => l.complaint_id === complaintId);
}

export function logActivity(
  complaintId: string,
  actorName: string,
  action: string,
  prevStatus: string | undefined,
  newStatus: any,
  notes?: string
) {
  const newLog: ComplaintActivityLog = {
    id: 'log-' + Date.now(),
    complaint_id: complaintId,
    actor_name: actorName,
    action,
    previous_status: prevStatus as any,
    new_status: newStatus,
    notes,
    created_at: new Date().toISOString()
  };
  memoryActivityLogs.unshift(newLog);
}

export interface DepartmentHeadSummary {
  deptId: string;
  deptName: string;
  deptCode: string;
  headId?: string;
  userId?: string;
  headName: string;
  headEmail: string;
  headPhone: string;
  employeeId: string;
  designation: string;
  status: 'Active' | 'Inactive';
  staffCount: number;
  openComplaints: number;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalComplaints: number;
  deptComplaints: Complaint[];
  assignedStaff: ServiceStaffMemberRecord[];
}

export async function fetchDepartmentHeadsFromSupabase(): Promise<DepartmentHeadSummary[]> {
  const now = new Date();

  // Fetch departments, heads, staff profiles, complaints from Supabase
  let departments: any[] = [];
  let deptHeads: any[] = [];
  let profiles: any[] = [];
  let complaints: Complaint[] = [];

  if (isSupabaseConfigured()) {
    try {
      const [deptRes, headRes, profRes, compRes] = await Promise.all([
        supabase.from('departments').select('*'),
        supabase.from('department_heads').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('complaints').select('*')
      ]);

      if (deptRes.data && deptRes.data.length > 0) departments = deptRes.data;
      if (headRes.data) deptHeads = headRes.data;
      if (profRes.data) profiles = profRes.data;
      if (compRes.data) complaints = compRes.data as Complaint[];
    } catch (e) {
      console.warn('Supabase fetch department heads error:', e);
    }
  }

  // Target 7 Municipal Departments
  const SEVEN_MUNICIPAL_TARGETS = [
    { code: 'PWD', name: 'Public Works Department', defaultHead: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', phone: '+91 98220 00001', empId: 'EMP-PWD-001' },
    { code: 'SAN', name: 'Sanitation & Waste Management', defaultHead: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', phone: '+91 98220 00002', empId: 'EMP-SAN-001' },
    { code: 'WTR', name: 'Water Supply & Sewerage Board', defaultHead: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', phone: '+91 98220 00003', empId: 'EMP-WTR-001' },
    { code: 'DRN', name: 'Drainage & Sewage Department', defaultHead: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', phone: '+91 98220 00004', empId: 'EMP-DRN-001' },
    { code: 'ELE', name: 'Electrical & Street Lighting', defaultHead: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', phone: '+91 98220 00005', empId: 'EMP-ELE-001' },
    { code: 'TRF', name: 'Traffic Management Department', defaultHead: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', phone: '+91 98220 00006', empId: 'EMP-TRF-001' },
    { code: 'MNT', name: 'Maintenance Department', defaultHead: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', phone: '+91 98220 00007', empId: 'EMP-MNT-001' }
  ];


  return SEVEN_MUNICIPAL_TARGETS.map((target) => {

    // Match department record by code or name
    const deptObj = departments.find(
      (d) => d.code === target.code || (d.name && d.name.toLowerCase().includes(target.code.toLowerCase()))
    );
    const deptId = deptObj?.id || `dept-${target.code.toLowerCase()}`;

    // Match active head record from department_heads or profiles
    const activeHeadRow = deptHeads.find(
      (h) => (h.department_id === deptId || h.email === target.email) && h.status === 'active'
    );
    const headProf = profiles.find(
      (p) => p.role === 'department_head' && (p.department_id === deptId || p.email === target.email || p.id === activeHeadRow?.user_id)
    );

    const headName = activeHeadRow?.name || headProf?.full_name || target.defaultHead;
    const headEmail = activeHeadRow?.email || headProf?.email || target.email;
    const headPhone = activeHeadRow?.phone || headProf?.mobile || target.phone;
    const employeeId = activeHeadRow?.employee_id || headProf?.employee_id || target.empId;
    const designation = activeHeadRow?.designation || 'Department Head';
    const status: 'Active' | 'Inactive' = (activeHeadRow?.status === 'inactive') ? 'Inactive' : 'Active';

    // Calculate Real Staff Count for department
    const deptStaff = profiles
      .filter((p) => p.role === 'service_staff' && (p.department_id === deptId || (p.department_name && p.department_name.toLowerCase().includes(target.code.toLowerCase()))))
      .map((p) => ({
        id: p.id,
        name: p.full_name || 'Staff Member',
        employee_id: p.employee_id || `STF-${String(p.id).slice(0, 4).toUpperCase()}`,
        department_name: target.name,
        role: 'Service Staff',
        status: p.status || 'Available',
        contact_number: p.mobile || '+91 98220 00000',
        email: p.email || 'staff@nagarsetu.gov.in',
        ward_area: p.address || 'Nashik',
        joined_date: p.created_at || new Date().toISOString(),
        created_at: p.created_at || new Date().toISOString()
      }));

    // Calculate Complaints Metrics for department using department_id & text match fallback
    const deptComplaints = complaints.filter((c) => {
      if (c.department_id === deptId) return true;
      const dName = (c.department_name || '').toLowerCase();
      const cCat = (c.category || '').toLowerCase();
      const tCode = target.code.toLowerCase();
      return dName.includes(tCode) || cCat.includes(tCode);
    });

    const openComplaints = deptComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const activeTasks = deptComplaints.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'Staff Assigned' || c.status === 'Department Assigned').length;
    const completedTasks = deptComplaints.filter((c) => c.status === 'Resolved').length;
    const overdueTasks = deptComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    return {
      deptId,
      deptName: target.name,
      deptCode: target.code,
      headId: activeHeadRow?.id,
      userId: activeHeadRow?.user_id || headProf?.id,
      headName,
      headEmail,
      headPhone,
      employeeId,
      designation,
      status,
      staffCount: deptStaff.length,
      openComplaints,
      activeTasks,
      completedTasks,
      overdueTasks,
      totalComplaints: deptComplaints.length,
      deptComplaints,
      assignedStaff: deptStaff
    };
  });
}

export async function saveOrReplaceDepartmentHeadInSupabase(payload: {
  fullName: string;
  email: string;
  phone?: string;
  employeeId: string;
  departmentId: string;
  designation?: string;
  password?: string;
  performedByUserId?: string;
}): Promise<boolean> {
  const cleanEmail = payload.email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      // 1. Check if Supabase Auth user exists for this email
      let userId: string | null = null;
      
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingUser?.id) {
        userId = existingUser.id;
      } else {
        if (!payload.password) {
          throw new Error('Password is required when creating a new department head account.');
        }
        // Sign up new user via Supabase Auth
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: payload.password,
          options: {
            data: {
              full_name: payload.fullName,
              role: 'department_head',
              department_id: payload.departmentId
            }
          }
        });

        if (signUpErr && !signUpData?.user) {
          console.warn('Supabase Auth signUp note:', signUpErr);
        }
        userId = signUpData?.user?.id || `user-dh-${Date.now()}`;
      }

      // 2. Call Supabase RPC create_or_change_department_head
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_or_change_department_head', {
        p_user_id: userId,
        p_department_id: payload.departmentId,
        p_name: payload.fullName,
        p_email: cleanEmail,
        p_phone: payload.phone || '+91 98220 00000',
        p_employee_id: payload.employeeId,
        p_designation: payload.designation || 'Department Head',
        p_performed_by: payload.performedByUserId || null
      });

      if (!rpcErr && rpcRes?.success) {
        return true;
      }

      // Fallback: Direct database updates if RPC not executed yet
      await supabase.from('department_heads').update({ status: 'inactive' }).eq('department_id', payload.departmentId);

      await supabase.from('profiles').upsert({
        id: userId,
        full_name: payload.fullName,
        email: cleanEmail,
        mobile: payload.phone || '+91 98220 00000',
        role: 'department_head',
        department_id: payload.departmentId,
        employee_id: payload.employeeId
      });

      await supabase.from('user_roles').upsert({
        user_id: userId,
        role: 'department_head'
      });

      await supabase.from('department_heads').upsert({
        user_id: userId,
        department_id: payload.departmentId,
        name: payload.fullName,
        email: cleanEmail,
        phone: payload.phone || '+91 98220 00000',
        employee_id: payload.employeeId,
        designation: payload.designation || 'Department Head',
        status: 'active'
      });

      return true;
    } catch (err: any) {
      console.error('Error saving department head in Supabase:', err);
      throw new Error(err.message || 'Failed to save Department Head in Supabase');
    }
  }

  return true;
}

export async function deactivateDepartmentHeadInSupabase(headId: string, performedByUserId?: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('deactivate_department_head', {
        p_head_id: headId,
        p_performed_by: performedByUserId || null
      });

      if (!rpcErr && rpcRes?.success) {
        return true;
      }

      // Fallback direct update
      await supabase.from('department_heads').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', headId);
      return true;
    } catch (e) {
      console.error('Error deactivating department head:', e);
      return false;
    }
  }
  return true;
}

export { deleteDepartmentHead } from './departmentService';


