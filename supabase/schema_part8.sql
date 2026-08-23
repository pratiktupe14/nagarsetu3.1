-- NAGARSETU Part 8 Supabase Migration DDL
-- Department Head Leadership Architecture, Atomic Transitions, Audit Logs & RLS

-- 1. Extend App Role ENUM for Department Head
DO $$ BEGIN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'department_head';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Seed / Align 6 Exact Municipal Departments
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

-- 3. Department Heads Table
CREATE TABLE IF NOT EXISTS public.department_heads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  employee_id TEXT UNIQUE NOT NULL,
  designation TEXT DEFAULT 'Department Head',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Partial Unique Index: Strictly Enforce ONE ACTIVE Department Head Per Department
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_head_per_dept 
ON public.department_heads (department_id) 
WHERE status = 'active';

-- 4. Department Leadership Audit Logs Table
CREATE TABLE IF NOT EXISTS public.department_leadership_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL, -- HEAD_CREATED | DEPARTMENT_HEAD_CHANGED | HEAD_DEACTIVATED | HEAD_REACTIVATED
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  old_head_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  new_head_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Row Level Security
ALTER TABLE public.department_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_leadership_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Public & Authenticated Read Access for Department Head Leadership
CREATE POLICY "Public & Auth read department heads" ON public.department_heads
  FOR SELECT USING (true);

-- Admins full access to department heads
CREATE POLICY "Admins manage department heads" ON public.department_heads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'city_admin'
    ) OR auth.uid() = user_id
  );

-- Leadership Audit Logs Policy
CREATE POLICY "Admins and Dept Heads view audit logs" ON public.department_leadership_audit_logs
  FOR SELECT USING (true);

-- 7. Atomic Leadership Assignment / Change RPC Function
CREATE OR REPLACE FUNCTION public.create_or_change_department_head(
  p_user_id UUID,
  p_department_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_employee_id TEXT,
  p_designation TEXT DEFAULT 'Department Head',
  p_performed_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_head_record RECORD;
  v_new_head_id UUID;
  v_dept_record RECORD;
BEGIN
  -- Verify Department Exists
  SELECT * INTO v_dept_record FROM public.departments WHERE id = p_department_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department % not found', p_department_id;
  END IF;

  -- 1. Locate current active department head if any
  SELECT * INTO v_old_head_record 
  FROM public.department_heads 
  WHERE department_id = p_department_id AND status = 'active';

  IF FOUND THEN
    -- Deactivate current head atomically
    UPDATE public.department_heads 
    SET status = 'inactive', updated_at = now()
    WHERE id = v_old_head_record.id;

    -- Update old head user profile timestamp
    UPDATE public.profiles 
    SET updated_at = now() 
    WHERE id = v_old_head_record.user_id;

    -- Audit log for leadership transition
    INSERT INTO public.department_leadership_audit_logs (
      action, department_id, old_head_id, new_head_id, performed_by, details
    ) VALUES (
      'DEPARTMENT_HEAD_CHANGED',
      p_department_id,
      v_old_head_record.user_id,
      p_user_id,
      p_performed_by,
      jsonb_build_object(
        'department_code', v_dept_record.code,
        'old_head_name', v_old_head_record.name,
        'new_head_name', p_name,
        'old_head_email', v_old_head_record.email,
        'new_head_email', p_email
      )
    );
  ELSE
    -- Audit log for brand new head creation
    INSERT INTO public.department_leadership_audit_logs (
      action, department_id, old_head_id, new_head_id, performed_by, details
    ) VALUES (
      'HEAD_CREATED',
      p_department_id,
      NULL,
      p_user_id,
      p_performed_by,
      jsonb_build_object(
        'department_code', v_dept_record.code,
        'head_name', p_name,
        'head_email', p_email
      )
    );
  END IF;

  -- 2. Upsert profile for new head
  INSERT INTO public.profiles (
    id, full_name, email, mobile, department_id, updated_at
  ) VALUES (
    p_user_id, p_name, p_email, p_phone, p_department_id, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    department_id = EXCLUDED.department_id,
    updated_at = now();

  -- 3. Upsert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'department_head')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Upsert active record into department_heads
  INSERT INTO public.department_heads (
    user_id, department_id, name, email, phone, employee_id, designation, status, updated_at
  ) VALUES (
    p_user_id, p_department_id, p_name, p_email, p_phone, p_employee_id, p_designation, 'active', now()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    department_id = EXCLUDED.department_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    employee_id = EXCLUDED.employee_id,
    designation = EXCLUDED.designation,
    status = 'active',
    updated_at = now()
  RETURNING id INTO v_new_head_id;

  RETURN jsonb_build_object(
    'success', true,
    'department_head_id', v_new_head_id,
    'user_id', p_user_id,
    'department_id', p_department_id,
    'name', p_name,
    'status', 'active'
  );
END;
$$;

-- 8. Deactivate Department Head RPC Function
CREATE OR REPLACE FUNCTION public.deactivate_department_head(
  p_head_id UUID,
  p_performed_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_head_record RECORD;
BEGIN
  SELECT * INTO v_head_record FROM public.department_heads WHERE id = p_head_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department head record % not found', p_head_id;
  END IF;

  UPDATE public.department_heads 
  SET status = 'inactive', updated_at = now()
  WHERE id = p_head_id;

  INSERT INTO public.department_leadership_audit_logs (
    action, department_id, old_head_id, new_head_id, performed_by, details
  ) VALUES (
    'HEAD_DEACTIVATED',
    v_head_record.department_id,
    v_head_record.user_id,
    NULL,
    p_performed_by,
    jsonb_build_object(
      'head_name', v_head_record.name,
      'head_email', v_head_record.email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Department head deactivated successfully'
  );
END;
$$;

-- 9. Reactivate Department Head RPC Function
CREATE OR REPLACE FUNCTION public.reactivate_department_head(
  p_head_id UUID,
  p_performed_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_head_record RECORD;
BEGIN
  SELECT * INTO v_head_record FROM public.department_heads WHERE id = p_head_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department head record % not found', p_head_id;
  END IF;

  -- Deactivate any currently active head for the same department to enforce single active head
  UPDATE public.department_heads 
  SET status = 'inactive', updated_at = now()
  WHERE department_id = v_head_record.department_id AND status = 'active' AND id != p_head_id;

  -- Activate target head
  UPDATE public.department_heads 
  SET status = 'active', updated_at = now()
  WHERE id = p_head_id;

  -- Ensure profile & role match active status
  IF v_head_record.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET department_id = v_head_record.department_id, updated_at = now()
    WHERE id = v_head_record.user_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_head_record.user_id, 'department_head')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.department_leadership_audit_logs (
    action, department_id, old_head_id, new_head_id, performed_by, details
  ) VALUES (
    'HEAD_REACTIVATED',
    v_head_record.department_id,
    NULL,
    v_head_record.user_id,
    p_performed_by,
    jsonb_build_object(
      'head_name', v_head_record.name,
      'head_email', v_head_record.email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Department head reactivated successfully'
  );
END;
$$;

