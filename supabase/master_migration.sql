-- NAGARSETU Master Supabase PostgreSQL Schema Migration DDL

-- 1. Enable UUID Extension & Types
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('citizen', 'city_admin', 'service_staff', 'department_head');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE complaint_status_type AS ENUM (
      'Submitted', 'Verified', 'Approved', 'Department Assigned', 
      'Staff Assigned', 'In Progress', 'Accepted', 'On the Way',
      'Resolution Submitted', 'Resolved', 'Reopened', 'Rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_level_type AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Initial 5 Municipal Departments
INSERT INTO public.departments (name, code, description) VALUES
  ('Public Works Department (PWD)', 'PWD', 'Potholes, asphalt repairs, road damage, public infrastructure'),
  ('Sanitation & Waste Management', 'SAN', 'Garbage collection, overflowing dustbins, street sweeping, solid waste'),
  ('Water Supply & Sewerage Board', 'WTR', 'Water leakage, pipelines, water supply, sewage board'),
  ('Drainage & Sewage Department', 'DRN', 'Drainage blockage, sewage overflow, open drains, monsoon channels'),
  ('Electrical & Street Lighting', 'ELE', 'Streetlights, electrical poles, junction boxes, civic lighting'),
  ('Traffic Management Department', 'TRF', 'Traffic signals, traffic infrastructure, road signage, junctions')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 3. Profiles / Users Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'citizen',
  department_id UUID REFERENCES public.departments(id),
  employee_id TEXT,
  status TEXT DEFAULT 'active',
  language_pref TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, role)
);

-- 5. Department Heads Table
CREATE TABLE IF NOT EXISTS public.department_heads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  employee_id TEXT,
  designation TEXT DEFAULT 'Department Head',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number TEXT UNIQUE NOT NULL,
  citizen_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_before_url TEXT NOT NULL,
  photo_after_url TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority priority_level_type DEFAULT 'Medium',
  status complaint_status_type DEFAULT 'Submitted',
  department_id UUID REFERENCES public.departments(id),
  latitude NUMERIC(10, 7) NOT NULL DEFAULT 0,
  longitude NUMERIC(10, 7) NOT NULL DEFAULT 0,
  location_source TEXT NOT NULL DEFAULT 'manual_pin',
  location_address TEXT,
  duplicate_of_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  support_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Task Assignments Table
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  sla_deadline TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Assigned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Complaint Feedback Table
CREATE TABLE IF NOT EXISTS public.complaint_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_resolved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'citizen',
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  complaint_number TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Complaint Status History Table
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  remark TEXT,
  department TEXT,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Department Leadership Audit Logs Table
CREATE TABLE IF NOT EXISTS public.department_leadership_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  old_head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  new_head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Enable Row Level Security (RLS) & Public Policies
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_leadership_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow Public/Authenticated Select Operations for App Features
CREATE POLICY IF NOT EXISTS "Public select departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select user_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select department_heads" ON public.department_heads FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select complaints" ON public.complaints FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select task_assignments" ON public.task_assignments FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select complaint_feedback" ON public.complaint_feedback FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public select status_history" ON public.complaint_status_history FOR SELECT USING (true);

-- Enable Realtime for Tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.department_heads;
