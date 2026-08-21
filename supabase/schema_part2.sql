-- NAGARSETU Part 2 Supabase Migration DDL
-- Extended Complaints, Feedback, Notifications & Duplicate Support Tables

-- 1. Complaint Status Enum
DO $$ BEGIN
    CREATE TYPE complaint_status_type AS ENUM (
      'Submitted', 'Verified', 'Approved', 'Department Assigned', 
      'Staff Assigned', 'In Progress', 'Resolved', 'Reopened', 'Rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Priority Level Enum
DO $$ BEGIN
    CREATE TYPE priority_level_type AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number TEXT UNIQUE NOT NULL, -- e.g. NS-2026-000128
  citizen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_before_url TEXT NOT NULL,
  photo_after_url TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority priority_level_type DEFAULT 'Medium',
  status complaint_status_type DEFAULT 'Submitted',
  department_id UUID REFERENCES public.departments(id),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  location_source TEXT NOT NULL, -- live_gps, exif_gps, manual_pin
  location_address TEXT,
  duplicate_of_id UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
  support_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Complaint Feedback Table
CREATE TABLE IF NOT EXISTS public.complaint_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_resolved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
CREATE POLICY "Citizens can view own complaints" ON public.complaints 
  FOR SELECT USING (auth.uid() = citizen_id);

CREATE POLICY "Citizens can insert complaints" ON public.complaints 
  FOR INSERT WITH CHECK (auth.uid() = citizen_id);

CREATE POLICY "Citizens can update own complaints" ON public.complaints 
  FOR UPDATE USING (auth.uid() = citizen_id);

CREATE POLICY "Public insert feedback" ON public.complaint_feedback 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);
