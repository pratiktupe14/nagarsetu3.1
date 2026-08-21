-- NAGARSETU Part 4 Supabase Migration DDL
-- Extended Status ENUM, Task Assignments, Work Updates & Resolution Proofs

-- 1. Extend Status ENUM values
ALTER TYPE complaint_status_type ADD VALUE IF NOT EXISTS 'Accepted';
ALTER TYPE complaint_status_type ADD VALUE IF NOT EXISTS 'On the Way';
ALTER TYPE complaint_status_type ADD VALUE IF NOT EXISTS 'Resolution Submitted';

-- 2. Task Assignments Table
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Assigned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Work Updates Table (Before Photo & Notes)
CREATE TABLE IF NOT EXISTS public.work_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_before_work_url TEXT,
  work_performed TEXT NOT NULL,
  materials_used TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Resolution Proofs Table (After Photo & Admin Review)
CREATE TABLE IF NOT EXISTS public.resolution_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_after_work_url TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  admin_review_status TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
  admin_reviewed_by UUID REFERENCES public.profiles(id),
  admin_rejection_reason TEXT
);

-- 5. Row Level Security
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_proofs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Staff can view assigned tasks" ON public.task_assignments
  FOR SELECT USING (auth.uid() = staff_id);

CREATE POLICY "Staff can insert work updates" ON public.work_updates
  FOR INSERT WITH CHECK (auth.uid() = staff_id);

CREATE POLICY "Staff can insert resolution proofs" ON public.resolution_proofs
  FOR INSERT WITH CHECK (auth.uid() = staff_id);

CREATE POLICY "Admins can view all resolution proofs" ON public.resolution_proofs
  FOR SELECT USING (true);
