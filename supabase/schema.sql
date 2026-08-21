-- NAGARSETU Supabase Database Architecture
-- Schema Migration DDL with Row Level Security (RLS)

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Roles Enum
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('citizen', 'city_admin', 'service_staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
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

-- 5. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Default Departments
INSERT INTO public.departments (name, code, description) VALUES
('Public Works Department (PWD)', 'PWD', 'Road repairs, asphalt degradation, and structural infrastructure'),
('Sanitation & Waste Management', 'SAN', 'Solid waste collection, garbage dump clearance, and hygiene'),
('Water Supply & Sewerage Board', 'WSSB', 'Pipeline leakages, drainage overflows, and water distribution'),
('Electrical & Lighting Dept', 'ELEC', 'Streetlight maintenance, electrical poles, and public illumination'),
('Traffic Management Dept', 'TRAF', 'Traffic light junctions, signal repairs, and road signage')
ON CONFLICT (code) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Profiles: Users can view & edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- User Roles: Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Departments: Public read access for department routing
CREATE POLICY "Public read departments" ON public.departments
  FOR SELECT USING (true);
