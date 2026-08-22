import { Complaint, ComplaintStatus, PriorityLevel, StaffPerformanceMetrics } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { broadcastComplaintChange } from './realtimeService';
import { pushNotification } from './notificationService';
import { geocodeComplaintsWithoutCoordinates, auditAndRepairComplaintLocations } from './locationService';

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

// Upload image to Supabase storage bucket
export async function uploadComplaintImage(file: File, bucketName: string = 'complaint-images'): Promise<string> {
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
    } catch (err) {
      console.warn('Supabase storage upload fallback:', err);
    }
  }

  // Fallback blob object URL
  return URL.createObjectURL(file);
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

// Fetch citizen complaints from Supabase
export async function getCitizenComplaints(citizenId: string): Promise<Complaint[]> {
  if (!citizenId || citizenId.trim() === '') return [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('citizen_id', citizenId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return (data as Complaint[]).filter((c) => !isDemoComplaint(c));
      }
    } catch (err) {
      console.warn('Supabase getCitizenComplaints fallback:', err);
    }
  }

  const all = getStoredComplaints();
  return all.filter((c) => c.citizen_id === citizenId && !isDemoComplaint(c));
}

// Fetch staff tasks from Supabase
export async function getStaffTasks(staffId?: string, departmentName?: string): Promise<Complaint[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('complaints').select('*');
      if (staffId) {
        query = query.eq('assigned_staff_id', staffId);
      } else if (departmentName && departmentName !== 'All') {
        const cleanDept = departmentName.split('(')[0].trim();
        query = query.ilike('department_name', `%${cleanDept}%`);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        return data as Complaint[];
      }
    } catch (err) {
      console.warn('Supabase getStaffTasks fallback:', err);
    }
  }

  const all = getStoredComplaints();
  return all.filter((c) => {
    if (staffId) {
      return c.assigned_staff_id === staffId;
    }
    if (departmentName && departmentName !== 'All') {
      const compDept = (c.department_name || '').toLowerCase();
      const targetDept = departmentName.split('(')[0].trim().toLowerCase();
      return compDept.includes(targetDept) || targetDept.includes(compDept);
    }
    return c.assigned_staff_id != null || c.status === 'Staff Assigned' || c.status === 'In Progress' || c.status === 'Accepted';
  });
}

// Fetch complaints belonging to a specific department from Supabase
export async function getDepartmentComplaints(departmentId?: string, departmentName?: string): Promise<Complaint[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('complaints').select('*');
      if (departmentId) {
        query = query.eq('department_id', departmentId);
      } else if (departmentName && departmentName !== 'All') {
        const cleanDept = departmentName.split('(')[0].trim();
        query = query.or(`department_name.ilike.%${cleanDept}%,category.ilike.%${cleanDept}%`);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        return data as Complaint[];
      }
    } catch (err) {
      console.warn('Supabase getDepartmentComplaints fallback:', err);
    }
  }

  const all = getStoredComplaints();
  const cleanHeadDept = (departmentName || '').split('(')[0].trim().toLowerCase();
  return all.filter((c) => {
    if (departmentId && c.department_id === departmentId) return true;
    const cDept = (c.department_name || '').toLowerCase();
    const cCat = (c.category || '').toLowerCase();
    return cDept.includes(cleanHeadDept) || cleanHeadDept.includes(cDept) || cCat.includes(cleanHeadDept);
  });
}

export async function getComplaintById(idOrNumber: string): Promise<Complaint | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .or(`id.eq.${idOrNumber},complaint_number.eq.${idOrNumber}`)
        .single();

      if (!error && data) {
        return data as Complaint;
      }
    } catch (err) {
      console.warn('Supabase getComplaintById fallback:', err);
    }
  }

  const all = getStoredComplaints();
  return all.find((c) => c.id === idOrNumber || c.complaint_number === idOrNumber) || null;
}

// Insert new complaint into Supabase
export async function createComplaint(payload: Omit<Complaint, 'id' | 'created_at' | 'updated_at'>): Promise<Complaint> {
  const newComplaintNumber = payload.complaint_number || generateComplaintNumber();
  const newComplaint: Complaint = {
    ...payload,
    complaint_number: newComplaintNumber,
    id: 'comp-' + Date.now(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    try {
      const dbPayload = {
        complaint_number: newComplaint.complaint_number,
        citizen_id: newComplaint.citizen_id,
        photo_before_url: newComplaint.photo_before_url,
        category: newComplaint.category,
        title: newComplaint.title,
        description: newComplaint.description,
        priority: newComplaint.priority || 'Medium',
        status: newComplaint.status || 'Submitted',
        latitude: newComplaint.latitude,
        longitude: newComplaint.longitude,
        location_source: newComplaint.location_source,
        location_address: newComplaint.location_address
      };

      const { data, error } = await supabase
        .from('complaints')
        .insert([dbPayload])
        .select()
        .single();

      if (!error && data) {
        newComplaint.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase createComplaint insert fallback:', err);
    }
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

    broadcastComplaintChange(comp.id, prevStatus, 'Accepted', comp.assigned_staff_name || 'Service Staff', 'Staff accepted field task');
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

    broadcastComplaintChange(comp.id, prevStatus, 'On the Way', comp.assigned_staff_name || 'Service Staff', 'En route to site');
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

    broadcastComplaintChange(comp.id, prevStatus, 'In Progress', comp.assigned_staff_name || 'Service Staff', 'Commenced site repair');
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
      message: `Maintenance team submitted repair proof for ${comp.complaint_number}. Under City Admin verification.`
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

    broadcastComplaintChange(comp.id, prevStatus, 'Resolution Submitted', comp.assigned_staff_name || 'Service Staff', 'Submitted repair proof & work notes');
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
        message: `City Admin verified repair proof for ${comp.complaint_number}. Please rate the repair quality!`
      });

      broadcastComplaintChange(comp.id, prevStatus, 'Resolved', 'City Admin', 'Approved resolution proof & closed issue');
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

      broadcastComplaintChange(comp.id, prevStatus, 'Reopened', 'City Admin', `Rejected resolution proof: ${rejectionReason}`);
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
  headDept: string
): Promise<boolean> {
  // CROSS-DEPARTMENT SECURITY CHECK
  const cleanStaffDept = (staffDept || '').split('(')[0].trim().toLowerCase();
  const cleanHeadDept = (headDept || '').split('(')[0].trim().toLowerCase();
  
  if (cleanStaffDept && cleanHeadDept && !cleanStaffDept.includes(cleanHeadDept) && !cleanHeadDept.includes(cleanStaffDept)) {
    throw new Error(`CROSS-DEPARTMENT ASSIGNMENT REJECTED: Department Head of '${headDept}' cannot assign staff belonging to '${staffDept}'.`);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('complaints')
        .update({
          assigned_staff_id: staffId,
          assigned_staff_name: staffName,
          assigned_by: headId,
          assigned_by_name: headName,
          status: 'Staff Assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', complaintId);
    } catch (e) {}
  }

  const all = getStoredComplaints();
  const comp = all.find((c) => c.id === complaintId);
  if (comp) {
    const prevStatus = comp.status;
    comp.assigned_staff_id = staffId;
    comp.assigned_staff_name = staffName;
    comp.assigned_by = headId;
    comp.assigned_by_name = headName;
    comp.status = 'Staff Assigned';
    comp.updated_at = new Date().toISOString();
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
  return false;
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
