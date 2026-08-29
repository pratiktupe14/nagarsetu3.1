import { Complaint, ComplaintActivityLog, DepartmentStaffMember, AdminKPIStats, PriorityLevel } from '../types/database.types';
import { getStoredComplaints, saveStoredComplaints } from './complaintService';
import { broadcastComplaintChange } from './realtimeService';
import { pushNotification } from './notificationService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl } from '../config/apiConfig';

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
    department_head: 'Er. Rajesh Sharma',
    contact_number: '+91 98220 11201',
    email: 'pwd.admin@nagarsetu.gov.in',
    description: 'Asphalt road repairs, pothole filling, sidewalk paving, and structural civic infrastructure maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-SAN',
    name: 'Sanitation & Waste Management',
    code: 'SAN-01',
    department_head: 'Dr. Anjali Patil',
    contact_number: '+91 98220 11202',
    email: 'sanitation@nagarsetu.gov.in',
    description: 'Solid waste collection, dumpster clearing, street sweeping, market sanitation, and public hygiene.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-WTR',
    name: 'Water Supply & Sewerage Board',
    code: 'WTR-01',
    department_head: 'Er. Vikram Deshmukh',
    contact_number: '+91 98220 11203',
    email: 'waterboard@nagarsetu.gov.in',
    description: 'Potable water mains, underground pipeline leakage sealing, valve control, and sewage network maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-ELE',
    name: 'Electrical & Lighting Dept',
    code: 'ELE-01',
    department_head: 'Er. Sunita Pawar',
    contact_number: '+91 98220 11204',
    email: 'electrical@nagarsetu.gov.in',
    description: 'LED streetlights, junction box repairs, feeder pillar cabinets, and municipal electrical grid maintenance.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-DRN',
    name: 'Drainage & Stormwater Dept',
    code: 'DRN-01',
    department_head: 'Er. Manoj Kadam',
    contact_number: '+91 98220 11205',
    email: 'drainage@nagarsetu.gov.in',
    description: 'Monsoon stormwater channels, drain de-silting, culvert clearing, and urban flood mitigation.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-TRF',
    name: 'Traffic Management Dept',
    code: 'TRF-01',
    department_head: 'Insp. Ganesh More',
    contact_number: '+91 98220 11206',
    email: 'traffic@nagarsetu.gov.in',
    description: 'Traffic light signals, road signage, speed breakers, zebra crossings, and junction traffic flow.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'dept-PRK',
    name: 'Parks & Environmental Services',
    code: 'PRK-01',
    department_head: 'Kavita Kulkarni',
    contact_number: '+91 98220 11207',
    email: 'parks@nagarsetu.gov.in',
    description: 'Municipal garden upkeep, public tree trimming, green belt maintenance, and urban forestry.',
    status: 'Active',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  }
];

export function getMunicipalDepartments(): MunicipalDepartmentRecord[] {
  const data = localStorage.getItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {}
  }
  localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(DEFAULT_MUNICIPAL_DEPARTMENTS));
  return DEFAULT_MUNICIPAL_DEPARTMENTS;
}

export function saveMunicipalDepartments(depts: MunicipalDepartmentRecord[]) {
  localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(depts));
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

const LOCAL_STORAGE_STAFF_KEY = 'nagarsetu_service_staff_v3';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('nagarsetu_token') || localStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
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
      return {
        staff: data.staff || [],
        summary: data.summary || { totalStaff: 0, activeStaff: 0, inactiveStaff: 0, activeTasks: 0 }
      };
    }
  } catch (err) {
    console.warn('Failed to fetch staff from API:', err);
  }
  return {
    staff: [],
    summary: { totalStaff: 0, activeStaff: 0, inactiveStaff: 0, activeTasks: 0 }
  };
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

export async function deactivateServiceStaffApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}/deactivate`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to deactivate staff:', err);
    return false;
  }
}

export async function activateServiceStaffApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to activate staff:', err);
    return false;
  }
}

export async function removeServiceStaffApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/department/staff/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to remove staff:', err);
    return false;
  }
}

export interface ServiceStaffMemberRecord {
  id: string;
  name: string;
  employee_id: string;
  department_name: string;
  role: string;
  status: 'Available' | 'On Task' | 'Offline' | 'On Leave' | 'Busy';
  contact_number: string;
  email: string;
  ward_area: string;
  joined_date: string;
  created_at: string;
}

export const DEMO_SERVICE_STAFF_RECORDS: ServiceStaffMemberRecord[] = [];

const DEFAULT_SERVICE_STAFF: ServiceStaffMemberRecord[] = [];

export function getAllServiceStaffRecords(): ServiceStaffMemberRecord[] {
  const data = localStorage.getItem(LOCAL_STORAGE_STAFF_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {}
  }
  return [];
}

export async function getDepartmentServiceStaff(departmentId?: string, departmentName?: string): Promise<ServiceStaffMemberRecord[]> {
  if (!departmentId && !departmentName) {
    return [];
  }
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'service_staff');
      if (departmentId) {
        query = query.eq('department_id', departmentId);
      } else if (departmentName) {
        const cleanDept = departmentName.split('(')[0].trim();
        query = query.ilike('department_name', `%${cleanDept}%`);
      }
      const { data, error } = await query;
      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.full_name || p.name || 'Staff Member',
          employee_id: p.employee_id || `STF-${p.id.slice(0, 4).toUpperCase()}`,
          department_name: p.department_name || departmentName || 'Municipal Department',
          role: 'Service Staff',
          status: p.status || 'Available',
          contact_number: p.phone_number || '+91 98220 00000',
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

  const all = getAllServiceStaffRecords();
  const cleanHeadDept = (departmentName || '').split('(')[0].trim().toLowerCase();
  return all.filter((s) => {
    const sDept = (s.department_name || '').toLowerCase();
    return sDept.includes(cleanHeadDept) || cleanHeadDept.includes(sDept);
  });
}

export async function getStaffMemberById(staffId: string): Promise<ServiceStaffMemberRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', staffId).single();
      if (!error && data) {
        return {
          id: data.id,
          name: data.full_name || data.name || 'Staff Member',
          employee_id: data.employee_id || `STF-${data.id.slice(0, 4).toUpperCase()}`,
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
  return all.find((s) => s.id === staffId || s.employee_id === staffId) || null;
}

export function saveServiceStaffRecords(staff: ServiceStaffMemberRecord[]) {
  localStorage.setItem(LOCAL_STORAGE_STAFF_KEY, JSON.stringify(staff));
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
      (c) => c.assigned_staff_id === s.id && c.status !== 'Resolved' && c.status !== 'Rejected'
    ).length;
    return {
      id: s.id,
      name: s.name,
      employee_id: s.employee_id,
      department_name: s.department_name,
      active_workload_count: activeTasks,
      is_online: s.status === 'Available' || s.status === 'On Task'
    };
  });

  if (!departmentName) return roster;

  const dLower = departmentName.toLowerCase();
  return roster.filter((s) => {
    const sLower = s.department_name.toLowerCase();
    return (
      sLower.includes(dLower) ||
      dLower.includes(sLower) ||
      (dLower.includes('pwd') && sLower.includes('pwd')) ||
      (dLower.includes('road') && sLower.includes('road')) ||
      (dLower.includes('sanitation') && sLower.includes('sanitation')) ||
      (dLower.includes('water') && sLower.includes('water')) ||
      (dLower.includes('drainage') && sLower.includes('drainage')) ||
      (dLower.includes('electric') && sLower.includes('electric')) ||
      (dLower.includes('traffic') && sLower.includes('traffic')) ||
      (dLower.includes('park') && sLower.includes('park')) ||
      (dLower.includes('waste') && sLower.includes('waste')) ||
      (dLower.includes('health') && sLower.includes('health')) ||
      (dLower.includes('emergency') && sLower.includes('emergency'))
    );
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
  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.status = 'Approved';
    comp.priority = priority;
    comp.department_name = departmentName;
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    logActivity(complaintId, adminName, 'Verified & Approved Complaint', prevStatus, 'Approved', `Priority set to ${priority}, Department routed to ${departmentName}`);
    
    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'approved',
      title: 'Complaint Verified & Approved',
      message: `Your complaint ${comp.complaint_number} has been verified and approved for ${departmentName} dispatch.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Approved', adminName, `Approved & routed to ${departmentName}`);
    return true;
  }
  return false;
}

export async function changeDepartmentRouting(
  complaintId: string,
  departmentName: string,
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.department_name = departmentName;
    comp.status = 'Department Assigned';
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    logActivity(complaintId, adminName, 'Re-routed Department', prevStatus, 'Department Assigned', `Department updated to ${departmentName}`);
    
    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'department_assigned',
      title: 'Department Assigned',
      message: `Complaint ${comp.complaint_number} routed to ${departmentName}.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Department Assigned', adminName, `Re-routed to ${departmentName}`);
    return true;
  }
  return false;
}

export async function assignStaffToTask(
  complaintId: string,
  staffId: string,
  staffName: string,
  slaHours: number = 24,
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.assigned_staff_id = staffId;
    comp.assigned_staff_name = staffName;
    comp.status = 'Staff Assigned';
    comp.sla_deadline = new Date(Date.now() + slaHours * 3600000).toISOString();
    comp.updated_at = new Date().toISOString();
    saveStoredComplaints(all);

    logActivity(complaintId, adminName, 'Assigned Field Staff', prevStatus, 'Staff Assigned', `Dispatched to ${staffName} with ${slaHours}h SLA deadline`);
    
    pushNotification({
      user_id: comp.citizen_id,
      role: 'citizen',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'staff_assigned',
      title: 'Field Officer Dispatched',
      message: `Field officer ${staffName} assigned to repair ${comp.complaint_number}.`
    });

    pushNotification({
      user_id: staffId,
      role: 'service_staff',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'staff_assigned',
      title: 'New Maintenance Task Dispatched',
      message: `Task ${comp.complaint_number} assigned to you with ${slaHours}h SLA deadline.`
    });

    broadcastComplaintChange(comp.id, prevStatus, 'Staff Assigned', adminName, `Assigned to staff ${staffName}`);
    return true;
  }
  return false;
}

export async function escalateComplaint(
  complaintId: string,
  escalationTarget: string = 'Senior Department Officer',
  adminName: string = 'City Admin Officer'
): Promise<boolean> {
  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    logActivity(
      complaintId,
      adminName,
      `Escalated to ${escalationTarget}`,
      comp.status,
      comp.status,
      `SLA Breach Escalation: High priority notice dispatched to ${escalationTarget}`
    );

    pushNotification({
      user_id: comp.assigned_staff_id || 'admin-group',
      role: comp.assigned_staff_id ? 'service_staff' : 'city_admin',
      complaint_id: comp.id,
      complaint_number: comp.complaint_number,
      type: 'sla_breached',
      title: `ESCALATION: ${comp.complaint_number}`,
      message: `Complaint ${comp.complaint_number} has been escalated to ${escalationTarget} due to SLA breach.`
    });

    broadcastComplaintChange(comp.id, comp.status, comp.status, adminName, `Escalated to ${escalationTarget}`);
    return true;
  }
  return false;
}

export function getComplaintActivityLogs(complaintId: string): ComplaintActivityLog[] {
  const data = localStorage.getItem(LOCAL_STORAGE_ACTIVITY_LOGS_KEY);
  if (data) {
    try {
      const all: ComplaintActivityLog[] = JSON.parse(data);
      return all.filter((l) => l.complaint_id === complaintId);
    } catch (e) {}
  }
  return [];
}

export function logActivity(
  complaintId: string,
  actorName: string,
  action: string,
  prevStatus: string | undefined,
  newStatus: any,
  notes?: string
) {
  const data = localStorage.getItem(LOCAL_STORAGE_ACTIVITY_LOGS_KEY);
  const all: ComplaintActivityLog[] = data ? JSON.parse(data) : [];
  all.unshift({
    id: 'log-' + Date.now(),
    complaint_id: complaintId,
    actor_name: actorName,
    action,
    previous_status: prevStatus as any,
    new_status: newStatus,
    notes,
    created_at: new Date().toISOString()
  });
  localStorage.setItem(LOCAL_STORAGE_ACTIVITY_LOGS_KEY, JSON.stringify(all));
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
        employee_id: p.employee_id || `STF-${p.id.slice(0, 4).toUpperCase()}`,
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


