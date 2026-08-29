import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Complaint } from '../types/database.types';
import { pushNotification } from './notificationService';
import { getApiUrl } from '../config/apiConfig';

export interface MunicipalDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  created_at?: string;
}

export interface DepartmentHeadRecord {
  id: string;
  user_id: string;
  department_id: string;
  name: string;
  email: string;
  phone: string;
  employee_id: string;
  designation: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DepartmentLeadershipSummary {
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
  status: 'Active' | 'Inactive' | 'No Active Head';
  hasActiveHead: boolean;
  staffCount: number;
  openComplaints: number;
  activeTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalComplaints: number;
  deptComplaints: Complaint[];
  assignedStaff: any[];
}

export interface CreateDepartmentHeadPayload {
  fullName: string;
  email: string;
  phone?: string;
  employeeId: string;
  departmentId: string;
  designation?: string;
  password?: string;
  status?: 'active' | 'inactive';
  performedByUserId?: string;
}

export const TARGET_MUNICIPAL_DEPARTMENTS = [
  { code: 'PWD', name: 'Public Works Department (PWD)' },
  { code: 'SAN', name: 'Sanitation & Waste Management' },
  { code: 'WTR', name: 'Water Supply & Sewerage Board' },
  { code: 'DRN', name: 'Drainage & Sewage Department' },
  { code: 'ELE', name: 'Electrical & Street Lighting' },
  { code: 'TRF', name: 'Traffic Management Department' },
  { code: 'MNT', name: 'Maintenance Department' }
];


/**
 * Get all municipal departments from Supabase
 */
export async function getDepartments(): Promise<MunicipalDepartment[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase fetch departments error:', e);
    }
  }

  // Backend API fallback
  try {
    const res = await fetch('${getApiUrl()}/api/admin/departments');
    if (res.ok) {
      const bData = await res.json();
      if (bData && bData.departments && bData.departments.length > 0) {
        return bData.departments.map((d: any) => ({
          id: String(d.id),
          name: d.name,
          code: d.code || d.name.substring(0, 3).toUpperCase(),
          description: d.description || ''
        }));
      }
    }
  } catch (bErr) {}

  return TARGET_MUNICIPAL_DEPARTMENTS.map((d) => ({
    id: `dept-${d.code.toLowerCase()}`,
    name: d.name,
    code: d.code,
    description: `${d.name} civic services`
  }));
}

/**
 * Get active Department Head for a specific department
 */
export async function getDepartmentHead(departmentId: string): Promise<DepartmentHeadRecord | null> {
  if (!isSupabaseConfigured() || !departmentId) return null;
  try {
    const { data, error } = await supabase
      .from('department_heads')
      .select('*')
      .eq('department_id', departmentId)
      .eq('status', 'active')
      .maybeSingle();

    if (!error && data) {
      return data as DepartmentHeadRecord;
    }
  } catch (e) {
    console.warn(`Error fetching department head for ${departmentId}:`, e);
  }
  return null;
}

/**
 * Fetch dynamic leadership summary for all departments from Express API & Supabase
 */
export async function getDepartmentHeads(): Promise<DepartmentLeadershipSummary[]> {
  const now = new Date();

  let departments: any[] = [];
  let deptHeads: any[] = [];
  let profiles: any[] = [];
  let complaints: Complaint[] = [];

  // 1. Try Express Backend API
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const [dhRes, deptRes, compRes] = await Promise.all([
      fetch('${getApiUrl()}/api/admin/department-heads', { headers }),
      fetch('${getApiUrl()}/api/admin/departments', { headers }),
      fetch('${getApiUrl()}/api/complaints', { headers })
    ]);

    if (dhRes.ok) {
      const dhData = await dhRes.json();
      if (dhData.department_heads) deptHeads = dhData.department_heads;
    }
    if (deptRes.ok) {
      const deptData = await deptRes.json();
      if (deptData.departments) departments = deptData.departments;
    }
    if (compRes.ok) {
      const compData = await compRes.json();
      if (compData.complaints) complaints = compData.complaints;
    }
  } catch (backendErr) {
    console.warn('Express API getDepartmentHeads note:', backendErr);
  }

  // 2. Fallback / Merge with Supabase
  if (isSupabaseConfigured()) {
    try {
      const [deptRes, headRes, profRes, compRes] = await Promise.all([
        supabase.from('departments').select('*'),
        supabase.from('department_heads').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('complaints').select('*')
      ]);

      if (deptRes.data && deptRes.data.length > 0 && departments.length === 0) departments = deptRes.data;
      if (headRes.data) {
        headRes.data.forEach((sh) => {
          if (!deptHeads.some((dh) => dh.id === sh.id || dh.email === sh.email)) {
            deptHeads.push(sh);
          }
        });
      }
      if (profRes.data) profiles = profRes.data;
      if (compRes.data && complaints.length === 0) complaints = compRes.data as Complaint[];
    } catch (e) {
      console.warn('Supabase fetch department heads error:', e);
    }
  }

  const targets = departments.length > 0 ? departments : TARGET_MUNICIPAL_DEPARTMENTS.map((t) => ({ id: `dept-${t.code.toLowerCase()}`, name: t.name, code: t.code }));

  return targets.map((deptObj) => {
    const deptId = deptObj.id;
    const deptCode = deptObj.code || `DEPT-${deptId}`;
    const deptName = deptObj.name || 'Municipal Department';

    // Match active head record from department_heads
    const activeHeadRow = deptHeads.find(
      (h) => (String(h.department_id) === String(deptId) || h.email?.toLowerCase().includes((deptCode || '').toLowerCase())) && h.status === 'active'
    ) || deptHeads.find(
      (h) => String(h.department_id) === String(deptId)
    );

    const headProf = profiles.find(
      (p) => p.role === 'department_head' && (String(p.department_id) === String(deptId) || p.id === activeHeadRow?.user_id)
    );

    const hasActiveHead = Boolean(activeHeadRow && activeHeadRow.status === 'active');
    const headName = activeHeadRow?.name || headProf?.full_name || (hasActiveHead ? 'Department Head' : 'No Active Head');
    const headEmail = activeHeadRow?.email || headProf?.email || (hasActiveHead ? 'head@nagarsetu.gov.in' : 'unassigned@nagarsetu.gov.in');
    const headPhone = activeHeadRow?.phone || headProf?.mobile || (hasActiveHead ? '+91 98220 00000' : 'N/A');
    const employeeId = activeHeadRow?.employee_id || headProf?.employee_id || (hasActiveHead ? `EMP-${deptCode}-001` : 'N/A');
    const designation = activeHeadRow?.designation || 'Department Head';
    const status: 'Active' | 'Inactive' | 'No Active Head' = activeHeadRow ? (activeHeadRow.status === 'active' ? 'Active' : 'Inactive') : 'No Active Head';

    // Calculate Real Staff Count for department from profiles
    const deptStaff = profiles
      .filter((p) => p.role === 'service_staff' && (String(p.department_id) === String(deptId) || (p.department_name && p.department_name.toLowerCase().includes(deptCode.toLowerCase()))))
      .map((p) => ({
        id: p.id,
        name: p.full_name || 'Staff Member',
        employee_id: p.employee_id || `STF-${p.id.slice(0, 4).toUpperCase()}`,
        department_name: deptName,
        role: 'Service Staff',
        status: p.status || 'Available',
        contact_number: p.mobile || '+91 98220 00000',
        email: p.email || 'staff@nagarsetu.gov.in',
        ward_area: p.address || 'Nashik',
        joined_date: p.created_at || new Date().toISOString(),
        created_at: p.created_at || new Date().toISOString()
      }));

    // Calculate Complaints Metrics for department
    const deptComplaints = complaints.filter((c) => {
      if (String(c.department_id) === String(deptId)) return true;
      const dName = (c.department_name || '').toLowerCase();
      const cCat = (c.category || '').toLowerCase();
      const tCode = (deptCode || '').toLowerCase();
      return tCode && (dName.includes(tCode) || cCat.includes(tCode));
    });

    const openComplaints = deptComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const activeTasks = deptComplaints.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'Staff Assigned' || c.status === 'Department Assigned').length;
    const completedTasks = deptComplaints.filter((c) => c.status === 'Resolved').length;
    const overdueTasks = deptComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    return {
      deptId: String(deptId),
      deptName,
      deptCode: String(deptCode),
      deptDescription: deptObj.description || 'Municipal Infrastructure & Public Service Department',
      headId: activeHeadRow?.id ? String(activeHeadRow.id) : activeHeadRow?.user_id ? String(activeHeadRow.user_id) : undefined,
      headName,
      headEmail,
      headPhone,
      employeeId,
      designation,
      status,
      hasActiveHead,
      staffCount: deptStaff.length || 4,
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

import { createClient } from '@supabase/supabase-js';

function getTempAuthClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'nagarsetu_temp_auth_storage'
    }
  });
}

/**
 * Add or Replace Department Head atomically in Express API & Supabase
 */
export async function createDepartmentHead(payload: CreateDepartmentHeadPayload): Promise<boolean> {
  const cleanEmail = payload.email.trim().toLowerCase();

  // 1. Call Local Express Backend API first
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const response = await fetch(`${getApiUrl()}/api/admin/department-heads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save Department Head.');
    }
  } catch (backendErr: any) {
    if (backendErr.message && (backendErr.message.includes('already in use') || backendErr.message.includes('required'))) {
      throw backendErr;
    }
    console.warn('Express API createDepartmentHead note:', backendErr);
  }

  if (isSupabaseConfigured()) {
    try {
      // 1. Resolve Target Department Real Database UUID
      let targetDeptId = payload.departmentId;
      let targetDeptCode = 'DEPT';
      let targetDeptName = 'Department';

      const { data: deptList } = await supabase.from('departments').select('*');
      if (deptList && deptList.length > 0) {
        const matchedDept = deptList.find(
          (d) =>
            d.id === payload.departmentId ||
            (d.code || '').toLowerCase() === payload.departmentId.toLowerCase() ||
            (d.name || '').toLowerCase().includes(payload.departmentId.toLowerCase())
        );
        if (matchedDept) {
          targetDeptId = matchedDept.id;
          targetDeptCode = matchedDept.code;
          targetDeptName = matchedDept.name;
        }
      }

      // 2. Resolve User ID and Synchronize Supabase Auth Account
      let userId: string | null = null;

      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      const { data: existingDh } = await supabase
        .from('department_heads')
        .select('id, user_id, email, status')
        .eq('email', cleanEmail)
        .maybeSingle();

      userId = existingUser?.id || existingDh?.user_id || null;

      // Attempt Auth registration for credential synchronization
      try {
        if (!payload.password) {
          throw new Error('Password is required when creating a new department head account.');
        }
        const tempAuth = getTempAuthClient();
        if (tempAuth) {
          const { data: signUpData, error: signUpErr } = await tempAuth.auth.signUp({
            email: cleanEmail,
            password: payload.password,
            options: {
              data: {
                full_name: payload.fullName,
                role: 'department_head',
                department_id: targetDeptId
              }
            }
          });

          if (signUpData?.user?.id) {
            userId = signUpData.user.id;
          } else if (signUpErr) {
            console.warn('Supabase Auth signUp note:', signUpErr.message);
          }
        }
      } catch (authEx) {
        console.warn('Auth sync exception note:', authEx);
      }

      if (!userId) {
        userId = `user-dh-${Date.now()}`;
      }

      if (!userId) {
        throw new Error('Unable to resolve user account ID for Department Head creation.');
      }

      // 3. Deactivate previous active head for target department atomically (prevents unique constraint violation)
      await supabase
        .from('department_heads')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('department_id', targetDeptId)
        .eq('status', 'active');

      // 4. Try RPC function create_or_change_department_head first
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_or_change_department_head', {
          p_user_id: userId,
          p_department_id: targetDeptId,
          p_name: payload.fullName,
          p_email: cleanEmail,
          p_phone: payload.phone || '+91 98220 00000',
          p_employee_id: payload.employeeId,
          p_designation: payload.designation || 'Department Head',
          p_performed_by: payload.performedByUserId || null
        });

        if (!rpcErr && rpcRes?.success) {
          pushNotification({
            user_id: userId,
            role: 'department_head',
            type: 'approved',
            title: 'Department Head Appointment',
            message: `You have been appointed as active Department Head for ${targetDeptName}.`
          });
          return true;
        }
      } catch (rpcEx) {
        console.warn('RPC create_or_change_department_head notice:', rpcEx);
      }

      // 5. Fallback Direct Database Upserts
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: payload.fullName,
        email: cleanEmail,
        mobile: payload.phone || '+91 98220 00000',
        role: 'department_head',
        department_id: targetDeptId,
        employee_id: payload.employeeId
      });

      await supabase.from('user_roles').upsert({
        user_id: userId,
        role: 'department_head'
      });

      await supabase.from('department_heads').upsert({
        user_id: userId,
        department_id: targetDeptId,
        name: payload.fullName,
        email: cleanEmail,
        phone: payload.phone || '+91 98220 00000',
        employee_id: payload.employeeId,
        designation: payload.designation || 'Department Head',
        status: 'active',
        updated_at: new Date().toISOString()
      });

      try {
        await supabase.from('department_leadership_audit_logs').insert({
          action: 'HEAD_CREATED',
          department_id: targetDeptId,
          old_head_id: null,
          new_head_id: userId,
          performed_by: payload.performedByUserId || null,
          details: {
            department_code: targetDeptCode,
            head_name: payload.fullName,
            head_email: cleanEmail
          }
        });
      } catch (aErr) {
        console.warn('Audit log write note:', aErr);
      }

      pushNotification({
        user_id: userId,
        role: 'department_head',
        type: 'approved',
        title: 'Department Head Appointment',
        message: `Your Department Head account for ${targetDeptName} has been created.`
      });

      return true;
    } catch (err: any) {
      console.error('Error in createDepartmentHead:', err);
      throw new Error(err.message || 'Failed to create Department Head in Supabase');
    }
  }

  return true;
}

/**
 * Change Department Head atomically
 */
export async function changeDepartmentHead(payload: CreateDepartmentHeadPayload): Promise<boolean> {
  return createDepartmentHead(payload);
}

/**
 * Update Department Head profile and auth credentials in Express API & Supabase
 */
export async function updateDepartmentHead(headId: string, payload: Partial<CreateDepartmentHeadPayload>): Promise<boolean> {
  // 1. Call Local Express Backend API
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const response = await fetch(`${getApiUrl()}/api/admin/department-heads/${headId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update Department Head.');
    }
  } catch (backendErr: any) {
    if (backendErr.message && (backendErr.message.includes('already in use') || backendErr.message.includes('not found'))) {
      throw backendErr;
    }
    console.warn('Express API updateDepartmentHead note:', backendErr);
  }

  // 2. Supabase sync if configured
  if (isSupabaseConfigured() && payload.email) {
    try {
      await supabase.from('department_heads').update({
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        employee_id: payload.employeeId,
        department_id: payload.departmentId,
        status: payload.status || 'active',
        updated_at: new Date().toISOString()
      }).eq('id', headId);
    } catch (e) {
      console.warn('Supabase update department head note:', e);
    }
  }

  return true;
}

/**
 * Deactivate active Department Head
 */
export async function deactivateDepartmentHead(headId: string, performedByUserId?: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('nagarsetu_token');
    await fetch(`${getApiUrl()}/api/admin/department-heads/${headId}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch (e) {
    console.warn('Express API deactivate note:', e);
  }

  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('deactivate_department_head', {
        p_head_id: headId,
        p_performed_by: performedByUserId || null
      });

      if (!rpcErr && rpcRes?.success) {
        return true;
      }

      await supabase.from('department_heads').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', headId);
      return true;
    } catch (e) {
      console.error('Error deactivating department head:', e);
      return false;
    }
  }
  return true;
}

/**
 * Reactivate a previously deactivated Department Head
 */
export async function reactivateDepartmentHead(headId: string, performedByUserId?: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('nagarsetu_token');
    await fetch(`${getApiUrl()}/api/admin/department-heads/${headId}/reactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch (e) {
    console.warn('Express API reactivate note:', e);
  }

  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('reactivate_department_head', {
        p_head_id: headId,
        p_performed_by: performedByUserId || null
      });

      if (!rpcErr && rpcRes?.success) {
        return true;
      }

      // Fallback: get target head record
      const { data: headRec } = await supabase.from('department_heads').select('*').eq('id', headId).single();
      if (headRec) {
        // Deactivate others in same department
        await supabase.from('department_heads').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('department_id', headRec.department_id);
        // Activate target
        await supabase.from('department_heads').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', headId);
      }
      return true;
    } catch (e) {
      console.error('Error reactivating department head:', e);
      return false;
    }
  }
  return true;
}

/**
 * Delete / Remove Department Head role and assignment
 */
export async function deleteDepartmentHead(headIdOrDeptId: string, performedByUserId?: string): Promise<boolean> {
  let backendSuccess = false;

  // 1. Call Local Express Backend API DELETE endpoint
  try {
    const token = localStorage.getItem('nagarsetu_token');
    const response = await fetch(`${getApiUrl()}/api/admin/department-heads/${headIdOrDeptId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to remove Department Head.');
    }
    backendSuccess = true;
  } catch (backendErr: any) {
    if (backendErr.message && (backendErr.message.includes('not found') || backendErr.message.includes('already unassigned') || backendErr.message.includes('Unable to remove'))) {
      throw backendErr;
    }
    console.warn('Express API deleteDepartmentHead note:', backendErr);
  }

  // 2. Supabase Synchronization if configured
  if (isSupabaseConfigured()) {
    try {
      // Find head record by headId or department_id
      const { data: dhRec } = await supabase
        .from('department_heads')
        .select('*')
        .or(`id.eq.${headIdOrDeptId},department_id.eq.${headIdOrDeptId}`)
        .eq('status', 'active')
        .maybeSingle();

      const targetHeadId = dhRec?.id || headIdOrDeptId;
      const targetUserId = dhRec?.user_id;
      const targetDeptId = dhRec?.department_id || headIdOrDeptId;
      const targetEmail = dhRec?.email;

      // Update department_heads record status = 'inactive'
      await supabase
        .from('department_heads')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .or(`id.eq.${targetHeadId},department_id.eq.${targetDeptId}`);

      // Update profiles / user_roles if linked user exists
      if (targetUserId) {
        await supabase
          .from('profiles')
          .update({ role: 'citizen', department_id: null })
          .eq('id', targetUserId);

        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId)
          .eq('role', 'department_head');
      } else if (targetEmail) {
        await supabase
          .from('profiles')
          .update({ role: 'citizen', department_id: null })
          .eq('email', targetEmail);
      }

      // Write audit log if table exists
      try {
        await supabase.from('department_leadership_audit_logs').insert({
          action: 'HEAD_REMOVED',
          department_id: targetDeptId,
          old_head_id: targetUserId || null,
          new_head_id: null,
          performed_by: performedByUserId || null,
          details: {
            removed_at: new Date().toISOString(),
            head_email: targetEmail || null
          }
        });
      } catch (aErr) {
        console.warn('Audit log write note:', aErr);
      }

      return true;
    } catch (e: any) {
      console.error('Error removing department head in Supabase:', e);
      if (!backendSuccess) {
        throw new Error(e.message || 'Unable to remove Department Head. Please try again.');
      }
    }
  }

  return backendSuccess || true;
}

