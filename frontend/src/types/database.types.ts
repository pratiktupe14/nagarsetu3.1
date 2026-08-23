export type UserRole = 'citizen' | 'city_admin' | 'department_head' | 'service_staff';

export type ComplaintStatus = 
  | 'Submitted' 
  | 'Verified' 
  | 'Approved' 
  | 'Department Assigned' 
  | 'Staff Assigned'
  | 'Accepted'
  | 'On the Way'
  | 'In Progress' 
  | 'Resolution Submitted'
  | 'Resolved' 
  | 'Reopened' 
  | 'Rejected';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type NotificationType =
  | 'submitted'
  | 'verified'
  | 'approved'
  | 'department_assigned'
  | 'staff_assigned'
  | 'work_started'
  | 'resolution_submitted'
  | 'resolved'
  | 'reopened'
  | 'critical'
  | 'sla_warning'
  | 'sla_breached';

export type AIMode = 'demo' | 'production';

export interface VisualFeatures {
  dHash: string; // 64-bit difference hash
  brightness: number; // 0 - 255
  contrast: number; // 0 - 100
  dominantColors: string[]; // hex codes
  edgeDensity: number; // 0 - 1
  vector: number[]; // 32-dim feature embedding
}

export interface ImageSimilarityResult {
  isExactDuplicate: boolean;
  similarityScore: number; // 0 - 1
  confidenceLevel: 'High' | 'Medium' | 'Low';
  relation: 'exact_duplicate' | 'same_issue_different_angle' | 'same_category_different_issue' | 'different_issue';
  reason: string;
}

export interface AIVisionResult {
  mode: AIMode;
  analysis_id?: string;
  image_hash?: string;
  category: string;
  issue_type?: string;
  confidence: number; // e.g. 0.94
  confidence_level?: 'High' | 'Medium' | 'Low';
  priority: PriorityLevel;
  department: string;
  title: string;
  description: string;
  visual_features?: VisualFeatures;
  detected_objects?: string[];
  quality_check?: {
    isUsable: boolean;
    warning?: string;
    brightness: number;
    contrast: number;
  };
  analysis_time_ms: number;
}

export interface UserProfile {
  id: string;
  full_name: string;
  mobile?: string;
  email: string;
  role: UserRole;
  department_id?: string;
  department_name?: string;
  employee_id?: string;
  avatar_url?: string;
  address?: string;
  language_pref?: string;
  status?: 'Active' | 'Inactive' | 'active' | 'inactive';
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  head_id?: string;
  head_name?: string;
  head_email?: string;
  created_at?: string;
}

export interface DepartmentHead {
  id: string;
  user_id: string;
  department_id: string;
  name: string;
  email: string;
  phone?: string;
  employee_id: string;
  designation?: string;
  status: 'active' | 'inactive' | 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
  // Optional joined metrics for UI
  department_name?: string;
  department_code?: string;
  staff_count?: number;
  active_tasks?: number;
  open_complaints?: number;
  overdue_tasks?: number;
  completed_tasks?: number;
  total_complaints?: number;
}

export interface Complaint {
  id: string;
  complaint_number: string; // e.g. NS-2026-100234
  citizen_id: string;
  photo_before_url: string;
  photo_after_url?: string;
  additional_photos?: string[];
  ai_vision_metadata?: any;
  category: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  status: ComplaintStatus;
  department_id?: string;
  department_name?: string;
  latitude: number;
  longitude: number;
  location_source?: 'live_gps' | 'exif_gps' | 'manual_pin' | 'geocoded' | 'geocode_failed' | 'unavailable' | 'gps';
  location_address?: string;
  duplicate_of_id?: string;
  support_count?: number;
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  assigned_by?: string;
  assigned_by_name?: string;
  department_head_id?: string;
  department_head_name?: string;
  rework_reason?: string;
  sla_deadline?: string;
  photo_before_work_url?: string;
  work_performed?: string;
  materials_used?: string;
  additional_notes?: string;
  admin_rejection_reason?: string;
  rating?: number;
  feedback_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplaintFeedback {
  id: string;
  complaint_id: string;
  rating: number;
  comment: string;
  is_resolved: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  role: UserRole;
  complaint_id?: string;
  complaint_number?: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface WorkUpdate {
  id: string;
  complaint_id: string;
  staff_id: string;
  photo_before_work_url?: string;
  work_performed: string;
  materials_used?: string;
  additional_notes?: string;
  created_at: string;
}

export interface ResolutionProof {
  id: string;
  complaint_id: string;
  staff_id: string;
  photo_after_work_url: string;
  submitted_at: string;
  admin_review_status: 'Pending' | 'Approved' | 'Rejected';
  admin_rejection_reason?: string;
}

export interface StaffPerformanceMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  avgResolutionHours: number;
  overdueTasks: number;
  successRatePercentage: number;
}

export interface ComplaintActivityLog {
  id: string;
  complaint_id: string;
  actor_id?: string;
  actor_name: string;
  action: string;
  previous_status?: ComplaintStatus;
  new_status: ComplaintStatus;
  notes?: string;
  created_at: string;
}

export interface DepartmentStaffMember {
  id: string;
  name: string;
  employee_id: string;
  department_name: string;
  active_workload_count: number;
  is_online: boolean;
}

export interface AdminKPIStats {
  total: number;
  newCount: number;
  pendingVerification: number;
  approved: number;
  inProgress: number;
  resolved: number;
  reopened: number;
  overdue: number;
  critical: number;
}

// ANNOUNCEMENT & MAINTENANCE TYPES
export type AnnouncementCategory =
  | 'General'
  | 'Water Supply'
  | 'Road Work'
  | 'Sanitation'
  | 'Electrical'
  | 'Drainage'
  | 'Traffic'
  | 'Infrastructure'
  | 'Environment'
  | 'Emergency';

export type AnnouncementPriority = 'Normal' | 'Important' | 'Emergency';

export interface OfficialAnnouncement {
  id: string;
  title: string;
  description: string;
  title_hi?: string;
  title_mr?: string;
  description_hi?: string;
  description_mr?: string;
  category: AnnouncementCategory;
  area: string;
  latitude?: number;
  longitude?: number;
  priority: AnnouncementPriority;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  image_url?: string;
  status: 'Draft' | 'Published' | 'Archived';
  published_by: string;
  created_at: string;
  updated_at: string;
}

export type MaintenanceWorkStatus = 'Planned' | 'Approved' | 'In Progress' | 'Completed' | 'Delayed' | 'Cancelled';

export interface MaintenanceWork {
  id: string;
  title: string;
  description: string;
  department_name: string;
  area: string;
  location_address?: string;
  latitude: number;
  longitude: number;
  status: MaintenanceWorkStatus;
  priority: PriorityLevel;
  start_date: string;
  expected_completion: string;
  assigned_staff_name?: string;
  image_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWorkUpdateLog {
  id: string;
  maintenance_id: string;
  status: MaintenanceWorkStatus;
  note: string;
  image_url?: string;
  created_by: string;
  created_at: string;
}
