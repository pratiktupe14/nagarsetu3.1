import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl } from '../config/apiConfig';
import { resolveDepartmentInfo } from '../services/departmentService';
import { getAllServiceStaffRecords } from '../services/adminService';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  loading: boolean;
  login: (identifier: string, password: string, role: UserRole) => Promise<boolean>;
  loginWithOtp: (mobile: string, otp: string) => Promise<boolean>;
  registerCitizen: (fullName: string, mobile: string, email: string, password?: string) => Promise<boolean>;
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SEED_DEPARTMENT_HEADS = [
  { id: '1', name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', department_id: '1', department_name: 'Public Works Department (PWD)', department_code: 'PWD', employee_id: 'DH-PWD-001' },
  { id: '2', name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', department_id: '2', department_name: 'Sanitation & Waste Management', department_code: 'SAN', employee_id: 'DH-SAN-001' },
  { id: '3', name: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', department_id: '3', department_name: 'Water Supply & Sewerage Board', department_code: 'WTR', employee_id: 'DH-WTR-001' },
  { id: '4', name: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', department_id: '4', department_name: 'Drainage & Sewage Department', department_code: 'DRN', employee_id: 'DH-DRN-001' },
  { id: '5', name: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', department_id: '5', department_name: 'Electrical & Street Lighting', department_code: 'ELE', employee_id: 'DH-ELE-001' },
  { id: '6', name: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', department_id: '6', department_name: 'Traffic Management Department', department_code: 'TRF', employee_id: 'DH-TRF-001' },
  { id: '7', name: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', department_id: '7', department_name: 'Maintenance Department', department_code: 'MNT', employee_id: 'DH-MNT-001' }
];

export function findDepartmentHeadByIdentifier(identifier: string): UserProfile | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;

  const exact = SEED_DEPARTMENT_HEADS.find((dh) => {
    const e = (dh.email || '').toLowerCase();
    const emp = (dh.employee_id || '').toLowerCase();
    const id = (dh.id || '').toLowerCase();
    const name = (dh.name || '').toLowerCase();
    return e === clean || emp === clean || id === clean || (name && name.includes(clean));
  });

  if (exact) {
    return {
      id: exact.id,
      full_name: exact.name,
      email: exact.email,
      role: 'department_head',
      department_id: exact.department_id,
      department_name: exact.department_name,
      department_code: exact.department_code,
      employee_id: exact.employee_id,
      language_pref: 'en'
    };
  }

  const resDept = resolveDepartmentInfo(undefined, undefined, clean);
  if (resDept && resDept.code !== 'UNASSIGNED') {
    const seedMatch = SEED_DEPARTMENT_HEADS.find((dh) => dh.department_code === resDept.code);
    return {
      id: seedMatch?.id || `dh-${resDept.code.toLowerCase()}-01`,
      full_name: seedMatch?.name || `${resDept.name} Head`,
      email: seedMatch?.email || (clean.includes('@') ? clean : `${clean}@nagarsetu.gov.in`),
      role: 'department_head',
      department_id: resDept.id,
      department_name: resDept.fullName || resDept.name,
      department_code: resDept.code,
      employee_id: seedMatch?.employee_id || `DH-${resDept.code}-001`,
      language_pref: 'en'
    };
  }

  return null;
}

export function findServiceStaffByIdentifier(identifier: string): UserProfile | null {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;

  try {
    const allStaff = getAllServiceStaffRecords();

    // 1. Exact match on email, employee_id, id, or contact_number
    const exact = allStaff.find((s) => {
      const sEmail = (s.email || '').toLowerCase();
      const sEmpId = (s.employee_id || '').toLowerCase();
      const sId = (s.id || '').toLowerCase();
      const sPhone = (s.contact_number || '').replace(/\D/g, '');
      const cleanPhone = clean.replace(/\D/g, '');

      return (
        sEmail === clean ||
        sEmpId === clean ||
        sId === clean ||
        (cleanPhone.length >= 7 && sPhone.endsWith(cleanPhone))
      );
    });

    if (exact) {
      const resDept = resolveDepartmentInfo(undefined, exact.department_name);
      return {
        id: exact.id,
        full_name: exact.name,
        email: exact.email || clean,
        mobile: exact.contact_number || '',
        role: 'service_staff',
        department_id: resDept.id,
        department_name: resDept.fullName || resDept.name,
        employee_id: exact.employee_id,
        language_pref: 'en'
      };
    }

    // 2. Partial match on email, employee_id, or name
    const partial = allStaff.find((s) => {
      const sEmail = (s.email || '').toLowerCase();
      const sEmpId = (s.employee_id || '').toLowerCase();
      const sName = (s.name || '').toLowerCase();
      return (
        (sEmail && sEmail.includes(clean)) ||
        (sEmpId && sEmpId.includes(clean)) ||
        (sName && sName.includes(clean))
      );
    });

    if (partial) {
      const resDept = resolveDepartmentInfo(undefined, partial.department_name);
      return {
        id: partial.id,
        full_name: partial.name,
        email: partial.email || clean,
        mobile: partial.contact_number || '',
        role: 'service_staff',
        department_id: resDept.id,
        department_name: resDept.fullName || resDept.name,
        employee_id: partial.employee_id,
        language_pref: 'en'
      };
    }

    // 3. Keyword-based department match from identifier (e.g. ele.staff@nagarsetu.gov.in, ELE-001)
    if (
      clean.includes('ele') || clean.includes('electric') || clean.includes('light') ||
      clean.includes('san') || clean.includes('waste') || clean.includes('garbage') ||
      clean.includes('wtr') || clean.includes('water') || clean.includes('pipe') ||
      clean.includes('drn') || clean.includes('drain') || clean.includes('sewage') ||
      clean.includes('trf') || clean.includes('traffic') || clean.includes('signal') ||
      clean.includes('mnt') || clean.includes('mainten') ||
      clean.includes('pwd') || clean.includes('road') || clean.includes('pothole')
    ) {
      const resDept = resolveDepartmentInfo(undefined, undefined, clean);
      const matchedDeptStaff = allStaff.find((s) => {
        const dInfo = resolveDepartmentInfo(undefined, s.department_name);
        return dInfo.code === resDept.code;
      });

      return {
        id: matchedDeptStaff?.id || `stf-${resDept.code.toLowerCase()}-01`,
        full_name: matchedDeptStaff?.name || `${resDept.name} Field Officer`,
        email: matchedDeptStaff?.email || (clean.includes('@') ? clean : `${clean}@nagarsetu.gov.in`),
        mobile: matchedDeptStaff?.contact_number || '',
        role: 'service_staff',
        department_id: resDept.id,
        department_name: resDept.fullName || resDept.name,
        employee_id: matchedDeptStaff?.employee_id || `${resDept.code}-STF-001`,
        language_pref: 'en'
      };
    }
  } catch (e) {
    console.warn('findServiceStaffByIdentifier error:', e);
  }

  return null;
}

export const DEFAULT_ROLE_USERS: Record<UserRole, UserProfile> = {
  citizen: {
    id: 'demo-citizen-id-101',
    full_name: 'Rahul Sharma',
    mobile: '9876543210',
    email: 'citizen@nagarsetu.gov.in',
    role: 'citizen',
    language_pref: 'en'
  },
  city_admin: {
    id: 'demo-admin-id-202',
    full_name: 'Priya Deshmukh (Admin)',
    email: 'admin@nagarsetu.gov.in',
    role: 'city_admin',
    language_pref: 'en'
  },
  service_staff: {
    id: 'stf-pwd-01',
    full_name: 'Amit Patil',
    mobile: '+91 98220 10001',
    email: 'staff@nagarsetu.gov.in',
    role: 'service_staff',
    department_id: '1',
    department_name: 'Public Works Department (PWD)',
    employee_id: 'PWD-STF-001',
    language_pref: 'en'
  },
  department_head: {
    id: 'demo-head-id-404',
    full_name: 'Rahul Kumar',
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_name: 'Public Works Department (PWD)',
    department_id: '1',
    department_code: 'PWD',
    employee_id: 'DH-PWD-001',
    language_pref: 'en'
  }
};

export const DEMO_USERS = DEFAULT_ROLE_USERS;

export function getPortalForRole(role: UserRole): string {
  if (role === 'city_admin') return '/admin/portal';
  if (role === 'department_head') return '/department/portal';
  if (role === 'service_staff') return '/staff/portal';
  return '/citizen/portal';
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('nagarsetu_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.role && parsed.id) {
          if (parsed.role === 'service_staff' && (!parsed.department_id || !parsed.department_name)) {
            const resolved = findServiceStaffByIdentifier(parsed.email || parsed.employee_id || parsed.id || '');
            if (resolved) {
              localStorage.setItem('nagarsetu_user', JSON.stringify(resolved));
              return resolved;
            }
          }
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });

  const [loading, setLoading] = useState(true);

  // Sync Supabase Auth state changes safely
  useEffect(() => {
    let isMounted = true;

    // Safety timeout guard: Force loading to false after 3.5s so app NEVER locks on loading screen
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3500);

    async function checkCurrentSession() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setLoading(false);
        clearTimeout(safetyTimer);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session && session.user) {
          const authUser = session.user;
          const userEmail = authUser.email || '';

          const [profRes, roleRes, headRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
            supabase.from('department_heads').select('*, departments(*)').or(`user_id.eq.${authUser.id},email.eq.${userEmail}`).eq('status', 'active').maybeSingle()
          ]);

          const profile = profRes.data;
          const userRole = roleRes.data?.role || authUser.user_metadata?.role;
          const deptHead = headRes.data;

          if (isMounted) {
            let role: UserRole = (userRole as UserRole) || 'citizen';
            let deptId = profile?.department_id || deptHead?.department_id;
            let deptName = profile?.department_name || deptHead?.departments?.name;

            if (deptHead) {
              role = 'department_head';
              deptId = deptHead.department_id;
              deptName = deptHead.departments?.name || deptName;
            }

            if (role === 'service_staff' && (!deptId || !deptName)) {
              const staffMatch = findServiceStaffByIdentifier(userEmail || authUser.id);
              if (staffMatch) {
                deptId = staffMatch.department_id;
                deptName = staffMatch.department_name;
              }
            }

            if (deptId || deptName) {
              const resDept = resolveDepartmentInfo(deptId, deptName);
              deptId = deptId ? String(deptId) : resDept.id;
              deptName = resDept.fullName || resDept.name;
            }

            const fetchedUser: UserProfile = {
              id: authUser.id,
              full_name: deptHead?.name || profile?.full_name || authUser.email?.split('@')[0] || 'User',
              email: userEmail,
              mobile: deptHead?.phone || profile?.mobile || '',
              role: role,
              department_id: deptId,
              department_name: deptName,
              employee_id: deptHead?.employee_id || profile?.employee_id,
              avatar_url: profile?.avatar_url,
              language_pref: profile?.language_pref || 'en'
            };
            setUser((prevUser) => {
              if (
                prevUser &&
                prevUser.id === fetchedUser.id &&
                prevUser.role === fetchedUser.role &&
                prevUser.email === fetchedUser.email &&
                prevUser.full_name === fetchedUser.full_name &&
                prevUser.department_id === fetchedUser.department_id
              ) {
                return prevUser;
              }
              return fetchedUser;
            });
            localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          }
        }
      } catch (err) {
        console.warn('Supabase Auth Session Check:', err);
      } finally {
        if (isMounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    }

    checkCurrentSession();

    let authSubscription: any = null;
    try {
      const res = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session && session.user) {
          const authUser = session.user;
          const userEmail = authUser.email || '';

          const [profRes, roleRes, headRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
            supabase.from('department_heads').select('*, departments(*)').or(`user_id.eq.${authUser.id},email.eq.${userEmail}`).eq('status', 'active').maybeSingle()
          ]);

          const profile = profRes.data;
          const userRole = roleRes.data?.role || authUser.user_metadata?.role;
          const deptHead = headRes.data;

          let role: UserRole = (userRole as UserRole) || 'citizen';
          let deptId = profile?.department_id || deptHead?.department_id;
          let deptName = profile?.department_name || deptHead?.departments?.name;

          if (deptHead) {
            role = 'department_head';
            deptId = deptHead.department_id;
            deptName = deptHead.departments?.name || deptName;
          }

          if (role === 'service_staff' && (!deptId || !deptName)) {
            const staffMatch = findServiceStaffByIdentifier(userEmail || authUser.id);
            if (staffMatch) {
              deptId = staffMatch.department_id;
              deptName = staffMatch.department_name;
            }
          }

          if (deptId || deptName) {
            const resDept = resolveDepartmentInfo(deptId, deptName);
            deptId = deptId ? String(deptId) : resDept.id;
            deptName = resDept.fullName || resDept.name;
          }

          const updatedUser: UserProfile = {
            id: authUser.id,
            full_name: deptHead?.name || profile?.full_name || 'User',
            email: userEmail,
            mobile: deptHead?.phone || profile?.mobile || '',
            role: role,
            department_id: deptId,
            department_name: deptName,
            employee_id: deptHead?.employee_id || profile?.employee_id,
            language_pref: profile?.language_pref || 'en'
          };
          setUser((prevUser) => {
            if (
              prevUser &&
              prevUser.id === updatedUser.id &&
              prevUser.role === updatedUser.role &&
              prevUser.email === updatedUser.email &&
              prevUser.full_name === updatedUser.full_name &&
              prevUser.department_id === updatedUser.department_id
            ) {
              return prevUser;
            }
            return updatedUser;
          });
          localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
        }
      });
      authSubscription = res?.data?.subscription;
    } catch (e) {
      console.warn('onAuthStateChange setup note:', e);
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
        try {
          authSubscription.unsubscribe();
        } catch (e) {}
      }
    };
  }, []);

  const switchRole = async (newRole: UserRole) => {
    let roleUser = DEFAULT_ROLE_USERS[newRole] || DEFAULT_ROLE_USERS.citizen;
    if (newRole === 'service_staff' && user && user.email) {
      const resolved = findServiceStaffByIdentifier(user.email);
      if (resolved) roleUser = resolved;
    }
    if (newRole === 'department_head' && user && user.email) {
      const resolvedHead = findDepartmentHeadByIdentifier(user.email);
      if (resolvedHead) roleUser = resolvedHead;
    }
    setUser(roleUser);
    localStorage.setItem('nagarsetu_user', JSON.stringify(roleUser));

    // Ensure valid JWT token is fetched and cached in localStorage for API routes
    if (!localStorage.getItem('nagarsetu_token')) {
      try {
        const loginId = user?.email || (newRole === 'city_admin' ? '9876543213' : '9876543210');
        const loginPass = newRole === 'city_admin' ? 'NagarSetu@Admin2026!' : 'password123';
        const res = await fetch(`${getApiUrl()}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileOrEmail: loginId, password: loginPass })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            localStorage.setItem('nagarsetu_token', data.token);
          }
        }
      } catch (e) {}
    }
  };

  const login = async (identifier: string, password: string, targetRole: UserRole): Promise<boolean> => {
    try {
      const cleanIdentifier = identifier.trim();

      // 1. Try Local Express Backend API authentication first
      try {
        const response = await fetch(`${getApiUrl()}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileOrEmail: cleanIdentifier, password })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.token && data.user) {
            const mappedRole: UserRole = data.user.role === 'admin' ? 'city_admin' : (data.user.role as UserRole);
            const staffMatch = mappedRole === 'service_staff' ? findServiceStaffByIdentifier(cleanIdentifier) : null;
            const resDept = resolveDepartmentInfo(
              data.user.department_id || staffMatch?.department_id,
              data.user.department_name || staffMatch?.department_name,
              cleanIdentifier
            );

            if ((mappedRole === 'department_head' || mappedRole === 'service_staff') && (!resDept.id || resDept.code === 'UNASSIGNED')) {
              throw new Error("Department assignment could not be resolved. Please contact City Administration.");
            }

            const authenticatedUser: UserProfile = {
              id: String(data.user.id || staffMatch?.id || 'staff-101'),
              full_name: data.user.name || staffMatch?.full_name || 'Municipal User',
              email: data.user.email || cleanIdentifier,
              mobile: data.user.mobile || staffMatch?.mobile || '',
              role: mappedRole,
              department_id: data.user.department_id ? String(data.user.department_id) : resDept.id,
              department_name: data.user.department_name || staffMatch?.department_name || resDept.fullName || resDept.name,
              department_code: data.user.department_code || resDept.code,
              employee_id: data.user.employee_id || staffMatch?.employee_id || undefined,
              language_pref: data.user.language_pref || 'en'
            };
            setUser(authenticatedUser);
            localStorage.setItem('nagarsetu_token', data.token);
            localStorage.setItem('nagarsetu_user', JSON.stringify(authenticatedUser));
            return true;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (errData.error) {
            throw new Error(errData.error);
          }
        }
      } catch (backendErr: any) {
        if (backendErr && backendErr.message) {
          if (backendErr.message === 'Failed to fetch' || backendErr.name === 'TypeError' || backendErr.message.toLowerCase().includes('failed to fetch')) {
            throw new Error("Unable to connect to NagarSetu backend service. Please verify the backend API server is running on http://localhost:5000.");
          }
          throw backendErr;
        }
        console.warn('Backend API login note:', backendErr);
      }

      const cleanEmail = cleanIdentifier.includes('@') ? cleanIdentifier.toLowerCase() : `${cleanIdentifier.toLowerCase()}@nagarsetu.gov.in`;

      if (isSupabaseConfigured()) {
        // Check if user has an inactive department_head assignment with no active assignment
        const { data: inactiveHead } = await supabase
          .from('department_heads')
          .select('*, departments(*)')
          .eq('email', cleanEmail)
          .eq('status', 'inactive')
          .maybeSingle();

        const { data: activeHead } = await supabase
          .from('department_heads')
          .select('*, departments(*)')
          .eq('email', cleanEmail)
          .eq('status', 'active')
          .maybeSingle();

        if (inactiveHead && !activeHead) {
          throw new Error("Department assignment could not be resolved. Please contact City Administration.");
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password || 'nagarsetu123'
        });

        if (!error && data?.user) {
          const authUser = data.user;
          const [profRes, roleRes, headRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
            supabase.from('department_heads').select('*, departments(*)').or(`user_id.eq.${authUser.id},email.eq.${cleanEmail}`).eq('status', 'active').maybeSingle()
          ]);

          const profile = profRes.data;
          const deptHead = headRes.data;
          const resolvedRole: UserRole = deptHead ? 'department_head' : (roleRes.data?.role as UserRole) || targetRole;
          const staffMatch = resolvedRole === 'service_staff' ? findServiceStaffByIdentifier(cleanEmail || cleanIdentifier) : null;
          let rawDeptId = deptHead?.department_id || profile?.department_id || staffMatch?.department_id;
          let rawDeptName = deptHead?.departments?.name || profile?.department_name || staffMatch?.department_name;
          let rawDeptCode = deptHead?.departments?.code;
          const resDept = resolveDepartmentInfo(rawDeptId, rawDeptName, cleanEmail);

          if (resolvedRole === 'department_head' && (!resDept.id || resDept.code === 'UNASSIGNED')) {
            throw new Error("Department assignment could not be resolved. Please contact City Administration.");
          }

          const fetchedUser: UserProfile = {
            id: authUser.id || staffMatch?.id || 'staff-101',
            full_name: deptHead?.name || profile?.full_name || staffMatch?.full_name || authUser.email?.split('@')[0] || 'Authenticated User',
            email: authUser.email || cleanEmail,
            mobile: deptHead?.phone || profile?.mobile || staffMatch?.mobile || '',
            role: resolvedRole,
            department_id: rawDeptId ? String(rawDeptId) : resDept.id,
            department_name: rawDeptName || resDept.fullName || resDept.name,
            department_code: rawDeptCode || resDept.code,
            employee_id: deptHead?.employee_id || profile?.employee_id || staffMatch?.employee_id,
            language_pref: profile?.language_pref || 'en'
          };
          setUser(fetchedUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          return true;
        }

        if (error) {
          console.warn('Supabase signInWithPassword note:', error);
          const demoAdminPass = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
          const demoUserPass = import.meta.env.VITE_DEMO_USER_PASSWORD || 'password123';
          const demoHeadPass = import.meta.env.VITE_DEMO_HEAD_PASSWORD || 'head123';
          const demoStaffPass = import.meta.env.VITE_DEMO_STAFF_PASSWORD || 'staff123';

          if (
            cleanEmail === 'admin@nagarsetu.gov.in' ||
            cleanEmail.includes('admin') ||
            targetRole === 'city_admin' ||
            password === demoAdminPass ||
            password === demoUserPass ||
            password === demoHeadPass ||
            password === demoStaffPass
          ) {
            console.info('Supabase auth failed for demo account, using demo session fallback.');
            if (targetRole === 'service_staff') {
              const staffUser = findServiceStaffByIdentifier(cleanIdentifier) || findServiceStaffByIdentifier(cleanEmail) || DEFAULT_ROLE_USERS.service_staff;
              setUser(staffUser);
              localStorage.setItem('nagarsetu_user', JSON.stringify(staffUser));
              return true;
            }
            if (targetRole === 'department_head') {
              const dhMatch = findDepartmentHeadByIdentifier(cleanIdentifier) || findDepartmentHeadByIdentifier(cleanEmail);
              if (dhMatch) {
                setUser(dhMatch);
                localStorage.setItem('nagarsetu_user', JSON.stringify(dhMatch));
                return true;
              }
              throw new Error("Department assignment could not be resolved. Please contact City Administration.");
            }
            switchRole(targetRole || 'city_admin');
            return true;
          }
          throw new Error(error.message || 'Authentication failed. Please check your credentials.');
        }
      }

      // Query Supabase for active department head record matching cleanEmail
      if (isSupabaseConfigured()) {
        const { data: dhRow } = await supabase
          .from('department_heads')
          .select('*, departments(*)')
          .eq('email', cleanEmail)
          .eq('status', 'active')
          .maybeSingle();

        if (dhRow) {
          const dhUser: UserProfile = {
            id: dhRow.user_id || `dh-${dhRow.id.slice(0, 8)}`,
            full_name: dhRow.name,
            email: cleanEmail,
            mobile: dhRow.phone || '',
            role: 'department_head',
            department_id: dhRow.department_id,
            department_name: dhRow.departments?.name || 'Municipal Department',
            department_code: dhRow.departments?.code,
            employee_id: dhRow.employee_id,
            language_pref: 'en'
          };
          setUser(dhUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(dhUser));
          return true;
        }
      }

      if (targetRole === 'department_head') {
        const dhMatch = findDepartmentHeadByIdentifier(cleanIdentifier) || findDepartmentHeadByIdentifier(cleanEmail);
        if (dhMatch) {
          setUser(dhMatch);
          localStorage.setItem('nagarsetu_user', JSON.stringify(dhMatch));
          return true;
        }
        throw new Error("Department assignment could not be resolved. Please contact City Administration.");
      }

      if (targetRole === 'service_staff') {
        const staffUser = findServiceStaffByIdentifier(cleanIdentifier) || findServiceStaffByIdentifier(cleanEmail);
        if (staffUser) {
          setUser(staffUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(staffUser));
          return true;
        }
      }

      throw new Error("Invalid login credentials. Please check your username/email and password.");
    } catch (e: any) {
      console.warn('Supabase Auth Login error:', e);
      throw e;
    }
  };

  const loginWithOtp = async (mobile: string): Promise<boolean> => {
    const citizenUser: UserProfile = {
      id: 'citizen-' + mobile.slice(-4),
      full_name: 'Citizen User',
      mobile,
      email: `${mobile}@citizen.nagarsetu.gov.in`,
      role: 'citizen'
    };
    setUser(citizenUser);
    localStorage.setItem('nagarsetu_user', JSON.stringify(citizenUser));
    return true;
  };

  const registerCitizen = async (
    fullName: string,
    mobile: string,
    email: string,
    password?: string
  ): Promise<boolean> => {
    try {
      // 1. Try local Express backend API registration first
      try {
        const response = await fetch(`${getApiUrl()}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullName.trim(),
            mobile: mobile.trim(),
            email: email && email.trim() !== '' ? email.trim() : undefined,
            password: password || 'password123',
            role: 'citizen'
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.token && data.user) {
            const registeredUser: UserProfile = {
              id: String(data.user.id),
              full_name: data.user.name || fullName,
              mobile: data.user.mobile || mobile,
              email: data.user.email || email,
              role: 'citizen',
              language_pref: data.user.language_pref || 'en'
            };
            setUser(registeredUser);
            localStorage.setItem('nagarsetu_token', data.token);
            localStorage.setItem('nagarsetu_user', JSON.stringify(registeredUser));
            return true;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (errData.error) {
            throw new Error(errData.error);
          }
        }
      } catch (backendErr: any) {
        if (backendErr && backendErr.message) {
          if (backendErr.message === 'Failed to fetch' || backendErr.name === 'TypeError' || backendErr.message.toLowerCase().includes('failed to fetch')) {
            throw new Error("Unable to connect to NagarSetu backend service. Please verify the backend API server is running on http://localhost:5000.");
          }
          throw backendErr;
        }
      }

      if (isSupabaseConfigured() && email && password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              mobile,
              role: 'citizen'
            }
          }
        });

        if (!error && data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            mobile,
            email
          });

          await supabase.from('user_roles').upsert({
            user_id: data.user.id,
            role: 'citizen'
          });

          const newCitizen: UserProfile = {
            id: data.user.id,
            full_name: fullName,
            mobile,
            email,
            role: 'citizen'
          };
          setUser(newCitizen);
          localStorage.setItem('nagarsetu_user', JSON.stringify(newCitizen));
          return true;
        }
      }

      throw new Error("Registration failed. Please check details or try again.");
    } catch (e: any) {
      console.error('Registration Error:', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Logout signOut error:', e);
    }
    localStorage.removeItem('nagarsetu_user');
    localStorage.removeItem('nagarsetu_token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-center items-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md animate-pulse font-outfit">
          NS
        </div>
        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          <span>NAGARSETU — Loading workspace...</span>
        </div>
        <button
          onClick={() => setLoading(false)}
          className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-[11px] rounded-lg transition-colors border border-gray-300"
        >
          Proceed to Portal
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : 'citizen',
        loading,
        login,
        loginWithOtp,
        registerCitizen,
        switchRole,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
