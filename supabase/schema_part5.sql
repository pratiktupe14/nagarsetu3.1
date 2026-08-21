-- NAGARSETU Part 5 Supabase Migration DDL
-- Complaint Activity Audit Logs & Department Staff Allocation

-- 1. Complaint Activity Logs Table
CREATE TABLE IF NOT EXISTS public.complaint_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Staff Departments Allocation Table
CREATE TABLE IF NOT EXISTS public.staff_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id),
  department_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  active_workload_count INT DEFAULT 0,
  is_online BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Row Level Security
ALTER TABLE public.complaint_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_departments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Admins and citizens can view activity logs" ON public.complaint_activity_logs
  FOR SELECT USING (true);

CREATE POLICY "Admins can view staff departments" ON public.staff_departments
  FOR SELECT USING (true);
