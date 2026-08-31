-- ============================================================
-- NAGARSETU 3.1: SUPABASE RLS SECURITY SETUP FOR FIELD_STAFF
-- ============================================================

-- 1. Create field_staff table if not exists (Standalone compatible)
CREATE TABLE IF NOT EXISTS public.field_staff (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  department_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  employee_id TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'field_staff',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Populate / Seed all 36 Field Staff records idempotently
INSERT INTO public.field_staff (department_id, name, email, phone, employee_id, role, status) VALUES
  -- 1. PWD (Public Works Department - Dept ID 1) - 6 Staff
  (1, 'Ramesh Kumar', 'staff@nagarsetu.gov.in', '9876543212', 'STF-001', 'field_staff', 'active'),
  (1, 'Amit Patil', 'amit.patil@nagarsetu.gov.in', '9822010001', 'PWD-STF-001', 'field_staff', 'active'),
  (1, 'Sagar Jadhav', 'sagar.jadhav@nagarsetu.gov.in', '9822010002', 'PWD-STF-002', 'field_staff', 'active'),
  (1, 'Nikhil Shinde', 'nikhil.shinde@nagarsetu.gov.in', '9822010003', 'PWD-STF-003', 'field_staff', 'active'),
  (1, 'Rohit More', 'rohit.more@nagarsetu.gov.in', '9822010004', 'PWD-STF-004', 'field_staff', 'active'),
  (1, 'Akash Pawar', 'akash.pawar@nagarsetu.gov.in', '9822010005', 'PWD-STF-005', 'field_staff', 'active'),

  -- 2. SAN (Sanitation & Waste Management - Dept ID 2) - 5 Staff
  (2, 'Prashant Mane', 'prashant.mane@nagarsetu.gov.in', '9822010006', 'SAN-STF-001', 'field_staff', 'active'),
  (2, 'Ganesh Chavan', 'ganesh.chavan@nagarsetu.gov.in', '9822010007', 'SAN-STF-002', 'field_staff', 'active'),
  (2, 'Mahesh Kadam', 'mahesh.kadam@nagarsetu.gov.in', '9822010008', 'SAN-STF-003', 'field_staff', 'active'),
  (2, 'Swapnil Bhosale', 'swapnil.bhosale@nagarsetu.gov.in', '9822010009', 'SAN-STF-004', 'field_staff', 'active'),
  (2, 'Deepak Wagh', 'deepak.wagh@nagarsetu.gov.in', '9822010010', 'SAN-STF-005', 'field_staff', 'active'),

  -- 3. WTR (Water Supply & Sewerage Board - Dept ID 3) - 5 Staff
  (3, 'Kiran Patil', 'kiran.patil@nagarsetu.gov.in', '9822010011', 'WTR-STF-001', 'field_staff', 'active'),
  (3, 'Manoj Shinde', 'manoj.shinde@nagarsetu.gov.in', '9822010012', 'WTR-STF-002', 'field_staff', 'active'),
  (3, 'Sachin More', 'sachin.more@nagarsetu.gov.in', '9822010013', 'WTR-STF-003', 'field_staff', 'active'),
  (3, 'Ajay Jadhav', 'ajay.jadhav@nagarsetu.gov.in', '9822010014', 'WTR-STF-004', 'field_staff', 'active'),
  (3, 'Vivek Pawar', 'vivek.pawar@nagarsetu.gov.in', '9822010015', 'WTR-STF-005', 'field_staff', 'active'),

  -- 4. DRN (Drainage & Sewage Department - Dept ID 4) - 5 Staff
  (4, 'Sunil Patil', 'sunil.patil@nagarsetu.gov.in', '9822010016', 'DRN-STF-001', 'field_staff', 'active'),
  (4, 'Ramesh More', 'ramesh.more@nagarsetu.gov.in', '9822010017', 'DRN-STF-002', 'field_staff', 'active'),
  (4, 'Santosh Jadhav', 'santosh.jadhav@nagarsetu.gov.in', '9822010018', 'DRN-STF-003', 'field_staff', 'active'),
  (4, 'Dinesh Shinde', 'dinesh.shinde@nagarsetu.gov.in', '9822010019', 'DRN-STF-004', 'field_staff', 'active'),
  (4, 'Pravin Pawar', 'pravin.pawar@nagarsetu.gov.in', '9822010020', 'DRN-STF-005', 'field_staff', 'active'),

  -- 5. ELE (Electrical & Street Lighting - Dept ID 5) - 5 Staff
  (5, 'Rahul Joshi', 'rahul.joshi@nagarsetu.gov.in', '9822010021', 'ELE-STF-001', 'field_staff', 'active'),
  (5, 'Sameer Kulkarni', 'sameer.kulkarni@nagarsetu.gov.in', '9822010022', 'ELE-STF-002', 'field_staff', 'active'),
  (5, 'Tejas Deshmukh', 'tejas.deshmukh@nagarsetu.gov.in', '9822010023', 'ELE-STF-003', 'field_staff', 'active'),
  (5, 'Omkar Patil', 'omkar.patil@nagarsetu.gov.in', '9822010024', 'ELE-STF-004', 'field_staff', 'active'),
  (5, 'Harshad More', 'harshad.more@nagarsetu.gov.in', '9822010025', 'ELE-STF-005', 'field_staff', 'active'),

  -- 6. TRF (Traffic Management Department - Dept ID 6) - 5 Staff
  (6, 'Rohan Patil', 'rohan.patil@nagarsetu.gov.in', '9822010026', 'TRF-STF-001', 'field_staff', 'active'),
  (6, 'Vishal Jadhav', 'vishal.jadhav@nagarsetu.gov.in', '9822010027', 'TRF-STF-002', 'field_staff', 'active'),
  (6, 'Tushar More', 'tushar.more@nagarsetu.gov.in', '9822010028', 'TRF-STF-003', 'field_staff', 'active'),
  (6, 'Nitin Shinde', 'nitin.shinde@nagarsetu.gov.in', '9822010029', 'TRF-STF-004', 'field_staff', 'active'),
  (6, 'Amol Pawar', 'amol.pawar@nagarsetu.gov.in', '9822010030', 'TRF-STF-005', 'field_staff', 'active'),

  -- 7. MNT (Maintenance Department - Dept ID 7) - 5 Staff
  (7, 'Kunal Patil', 'kunal.patil@nagarsetu.gov.in', '9822010031', 'MNT-STF-001', 'field_staff', 'active'),
  (7, 'Ganesh More', 'ganesh.more@nagarsetu.gov.in', '9822010032', 'MNT-STF-002', 'field_staff', 'active'),
  (7, 'Mayur Jadhav', 'mayur.jadhav@nagarsetu.gov.in', '9822010033', 'MNT-STF-003', 'field_staff', 'active'),
  (7, 'Sachin Pawar', 'sachin.pawar@nagarsetu.gov.in', '9822010034', 'MNT-STF-004', 'field_staff', 'active'),
  (7, 'Yogesh Shinde', 'yogesh.shinde@nagarsetu.gov.in', '9822010035', 'MNT-STF-005', 'field_staff', 'active')
ON CONFLICT (email) DO UPDATE SET
  department_id = EXCLUDED.department_id,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  employee_id = EXCLUDED.employee_id,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.field_staff ENABLE ROW LEVEL SECURITY;

-- 4. NON-RECURSIVE SECURITY DEFINER HELPER FUNCTIONS WITH TEXT CASTING
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role::text IN ('admin', 'city_admin')
    UNION
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role::text IN ('admin', 'city_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_department_head_of(p_user_id UUID, p_dept_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_heads dh
    WHERE dh.user_id = p_user_id
      AND dh.status = 'active'
      AND (CAST(dh.department_id AS TEXT) = CAST(p_dept_id AS TEXT))
    UNION
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role::text = 'department_head'
      AND (CAST(p.department_id AS TEXT) = CAST(p_dept_id AS TEXT))
  );
$$;

-- 5. CLEANUP PREVIOUS POLICIES
DROP POLICY IF EXISTS "Allow public read access to field_staff" ON public.field_staff;
DROP POLICY IF EXISTS "Allow admin and department head write access to field_staff" ON public.field_staff;
DROP POLICY IF EXISTS "Select field_staff policy" ON public.field_staff;
DROP POLICY IF EXISTS "Insert field_staff policy" ON public.field_staff;
DROP POLICY IF EXISTS "Update field_staff policy" ON public.field_staff;
DROP POLICY IF EXISTS "Delete field_staff policy" ON public.field_staff;

-- 6. STRICT RLS POLICIES FOR FIELD_STAFF

CREATE POLICY "Select field_staff policy" ON public.field_staff
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR public.is_department_head_of(auth.uid(), CAST(department_id AS TEXT))
    OR (
      auth.uid() IS NOT NULL AND (
        CAST(user_id AS TEXT) = CAST(auth.uid() AS TEXT)
        OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
      )
    )
  );

CREATE POLICY "Insert field_staff policy" ON public.field_staff
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
  );

CREATE POLICY "Update field_staff policy" ON public.field_staff
  FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR public.is_department_head_of(auth.uid(), CAST(department_id AS TEXT))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.is_department_head_of(auth.uid(), CAST(department_id AS TEXT))
  );

CREATE POLICY "Delete field_staff policy" ON public.field_staff
  FOR DELETE
  USING (
    public.is_admin(auth.uid())
  );
