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
  login: (identifier: string, password: string, role?: UserRole) => Promise<boolean>;
  loginWithOtp: (mobile: string, otp: string) => Promise<boolean>;
  registerCitizen: (fullName: string, mobile: string, email: string, password?: string) => Promise<boolean>;
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SEED_DEPARTMENT_HEADS = [
  { id: '1', name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', department_id: '1', department_name: 'Public Works Department (PWD)', department_code: 'PWD', employee_id: 'EMP-PWD-001' },
  { id: '2', name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', department_id: '2', department_name: 'Sanitation & Waste Management', department_code: 'SAN', employee_id: 'EMP-SAN-001' },
  { id: '3', name: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', department_id: '3', department_name: 'Water Supply & Sewerage Board', department_code: 'WTR', employee_id: 'EMP-WTR-001' },
  { id: '4', name: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', department_id: '4', department_name: 'Drainage & Sewage Department', department_code: 'DRN', employee_id: 'EMP-DRN-001' },
  { id: '5', name: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', department_id: '5', department_name: 'Electrical & Street Lighting', department_code: 'ELE', employee_id: 'EMP-ELE-001' },
  { id: '6', name: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', department_id: '6', department_name: 'Traffic Management Department', department_code: 'TRF', employee_id: 'EMP-TRF-001' },
  { id: '7', name: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', department_id: '7', department_name: 'Maintenance Department', department_code: 'MNT', employee_id: 'EMP-MNT-001' }
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
    id: 'citizen-user-id',
    full_name: 'Citizen User',
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
    name: 'Rahul Kumar',
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

export function getRoleFromPath(pathname: string): UserRole | null {
  if (!pathname) return null;
  if (pathname.startsWith('/admin')) return 'city_admin';
  if (pathname.startsWith('/department') || pathname.startsWith('/department-head')) return 'department_head';
  if (pathname.startsWith('/staff')) return 'service_staff';
  if (pathname.startsWith('/citizen')) return 'citizen';
  return null;
}

export function getDemoTokenForRole(role: UserRole): string {
  if (role === 'city_admin') return 'demo-token-city-admin';
  if (role === 'department_head') return 'demo-token-dept-head';
  if (role === 'service_staff') return 'demo-token-service-staff';
  return 'demo-token-citizen';
}

export function getPortalForRole(role: UserRole): string {
  if (role === 'city_admin') return '/admin/dashboard';
  if (role === 'department_head') return '/department/portal';
  if (role === 'service_staff') return '/staff/portal';
  return '/citizen/portal';
}

function resolveInitialUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  const currentPath = window.location.pathname;
  const pathRole = getRoleFromPath(currentPath);

  // 1. Check tab's sessionStorage first
  const sessionUserRaw = sessionStorage.getItem('nagarsetu_user');
  if (sessionUserRaw) {
    try {
      const parsed = JSON.parse(sessionUserRaw);
      if (parsed && parsed.role && parsed.id) {
        if (!pathRole || parsed.role === pathRole) {
          if (parsed.role === 'department_head' && (!parsed.department_id || !parsed.department_name)) {
            parsed.department_id = parsed.department_id || '1';
            parsed.department_name = parsed.department_name || 'Public Works Department (PWD)';
            parsed.department_code = parsed.department_code || 'PWD';
            parsed.name = parsed.name || parsed.full_name || 'Rahul Kumar';
            parsed.full_name = parsed.full_name || parsed.name || 'Rahul Kumar';
            sessionStorage.setItem('nagarsetu_user', JSON.stringify(parsed));
          }
          return parsed;
        }
      }
    } catch (e) {}
  }

  // 2. If visiting a role-specific portal (or sessionStorage was empty / mismatched):
  if (pathRole) {
    const roleSavedRaw = localStorage.getItem(`nagarsetu_user_${pathRole}`);
    if (roleSavedRaw) {
      try {
        const parsed = JSON.parse(roleSavedRaw);
        if (parsed && parsed.role === pathRole) {
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(parsed));
          const savedToken = localStorage.getItem(`nagarsetu_token_${pathRole}`);
          if (savedToken) {
            sessionStorage.setItem('nagarsetu_token', savedToken);
          } else {
            sessionStorage.setItem('nagarsetu_token', getDemoTokenForRole(pathRole));
          }
          return parsed;
        }
      } catch (e) {}
    }

    const generalUserRaw = localStorage.getItem('nagarsetu_user');
    if (generalUserRaw) {
      try {
        const parsed = JSON.parse(generalUserRaw);
        if (parsed && parsed.role === pathRole) {
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(parsed));
          const genToken = localStorage.getItem('nagarsetu_token') || getDemoTokenForRole(pathRole);
          sessionStorage.setItem('nagarsetu_token', genToken);
          return parsed;
        }
      } catch (e) {}
    }

    const defaultUser = DEFAULT_ROLE_USERS[pathRole];
    if (defaultUser) {
      sessionStorage.setItem('nagarsetu_user', JSON.stringify(defaultUser));
      sessionStorage.setItem('nagarsetu_token', getDemoTokenForRole(pathRole));
      return defaultUser;
    }
  }

  // 3. For public / non-role pages, check general localStorage
  const generalUserRaw = localStorage.getItem('nagarsetu_user');
  if (generalUserRaw) {
    try {
      const parsed = JSON.parse(generalUserRaw);
      if (parsed && parsed.role && parsed.id) {
        sessionStorage.setItem('nagarsetu_user', JSON.stringify(parsed));
        return parsed;
      }
    } catch (e) {}
  }

  return null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    return resolveInitialUser();
  });

  const [loading, setLoading] = useState<boolean>(() => {
    return !resolveInitialUser();
  });

  // Sync Supabase Auth state changes safely
  useEffect(() => {
    let isMounted = true;

    // Safety timeout guard: Force loading to false after 3.5s so app NEVER locks on loading screen
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 3500);

    async function checkCurrentSession() {
      // 1. Authoritative Backend Database Session Check
      const storedToken = sessionStorage.getItem('nagarsetu_token') || localStorage.getItem('nagarsetu_token');
      if (storedToken) {
        try {
          const res = await fetch(`${getApiUrl()}/api/auth/me`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'Authorization': `Bearer ${storedToken}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.user && isMounted) {
              const u = data.user;
              const authenticatedUser: UserProfile = {
                id: String(u.id),
                full_name: u.name,
                email: u.email || '',
                mobile: u.mobile || '',
                role: (u.role === 'admin' ? 'city_admin' : (u.role === 'staff' ? 'service_staff' : u.role)) as UserRole,
                department_id: u.department_id ? String(u.department_id) : undefined,
                department_name: u.department_name || undefined,
                department_code: u.department_code || undefined,
                employee_id: u.employee_id || undefined,
                language_pref: u.language_pref || 'en'
              };
              setUser(authenticatedUser);
              sessionStorage.setItem('nagarsetu_user', JSON.stringify(authenticatedUser));
              sessionStorage.setItem('nagarsetu_token', storedToken);
              localStorage.setItem('nagarsetu_user', JSON.stringify(authenticatedUser));
              localStorage.setItem(`nagarsetu_user_${authenticatedUser.role}`, JSON.stringify(authenticatedUser));
              localStorage.setItem(`nagarsetu_token_${authenticatedUser.role}`, storedToken);
              if (isMounted) setLoading(false);
              clearTimeout(safetyTimer);
              return;
            }
          } else if (res.status === 401 || res.status === 403 || res.status === 404) {
            if (!isSupabaseConfigured()) {
              sessionStorage.removeItem('nagarsetu_token');
              sessionStorage.removeItem('nagarsetu_user');
              localStorage.removeItem('nagarsetu_token');
              localStorage.removeItem('nagarsetu_user');
              if (isMounted) setUser(null);
            }
          }
        } catch (backendErr) {
          console.warn('Authoritative backend /api/auth/me check note:', backendErr);
        }
      }

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
          const userRole = roleRes.data?.role || profile?.role || authUser.user_metadata?.role || (userEmail.toLowerCase().includes('admin') ? 'city_admin' : undefined);
          const deptHead = headRes.data;

          if (isMounted) {
            let role: UserRole = (userRole as UserRole) || (userEmail.toLowerCase().includes('admin') ? 'city_admin' : 'citizen');
            let deptId = profile?.department_id || deptHead?.department_id;
            let deptName = profile?.department_name || deptHead?.departments?.name;

            if (deptHead) {
              role = 'department_head';
              deptId = deptHead.department_id;
              deptName = deptHead.departments?.name || deptName;
            } else if (profile?.role === 'city_admin' || profile?.role === 'admin' || userEmail.toLowerCase().includes('admin')) {
              role = 'city_admin';
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
            if (session.access_token) {
              sessionStorage.setItem('nagarsetu_token', session.access_token);
              localStorage.setItem('nagarsetu_token', session.access_token);
              localStorage.setItem(`nagarsetu_token_${fetchedUser.role}`, session.access_token);
            }
            sessionStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
            localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
            localStorage.setItem(`nagarsetu_user_${fetchedUser.role}`, JSON.stringify(fetchedUser));
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
          const userRole = roleRes.data?.role || profile?.role || authUser.user_metadata?.role || (userEmail.toLowerCase().includes('admin') ? 'city_admin' : undefined);
          const deptHead = headRes.data;

          let role: UserRole = (userRole as UserRole) || (userEmail.toLowerCase().includes('admin') ? 'city_admin' : 'citizen');
          let deptId = profile?.department_id || deptHead?.department_id;
          let deptName = profile?.department_name || deptHead?.departments?.name;

          if (deptHead) {
            role = 'department_head';
            deptId = deptHead.department_id;
            deptName = deptHead.departments?.name || deptName;
          } else if (profile?.role === 'city_admin' || profile?.role === 'admin' || userEmail.toLowerCase().includes('admin')) {
            role = 'city_admin';
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
          if (session?.access_token) {
            sessionStorage.setItem('nagarsetu_token', session.access_token);
            localStorage.setItem('nagarsetu_token', session.access_token);
            localStorage.setItem(`nagarsetu_token_${updatedUser.role}`, session.access_token);
          }
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
          localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
          localStorage.setItem(`nagarsetu_user_${updatedUser.role}`, JSON.stringify(updatedUser));
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
    const roleSavedRaw = localStorage.getItem(`nagarsetu_user_${newRole}`);
    if (roleSavedRaw) {
      try {
        const parsed = JSON.parse(roleSavedRaw);
        if (parsed && parsed.role === newRole) roleUser = parsed;
      } catch (e) {}
    }
    if (newRole === 'service_staff' && user && user.email) {
      const resolved = findServiceStaffByIdentifier(user.email);
      if (resolved) roleUser = resolved;
    }
    if (newRole === 'department_head' && user && user.email) {
      const resolvedHead = findDepartmentHeadByIdentifier(user.email);
      if (resolvedHead) roleUser = resolvedHead;
    }

    setUser(roleUser);
    sessionStorage.setItem('nagarsetu_user', JSON.stringify(roleUser));
    const token = localStorage.getItem(`nagarsetu_token_${newRole}`) || getDemoTokenForRole(newRole);
    sessionStorage.setItem('nagarsetu_token', token);
  };

  const login = async (identifier: string, password: string, _targetRole?: UserRole): Promise<boolean> => {
    try {
      const cleanIdentifier = identifier.trim();

      // Clear any prior stale session before authenticating
      localStorage.removeItem('nagarsetu_token');
      localStorage.removeItem('nagarsetu_user');
      sessionStorage.removeItem('nagarsetu_token');
      sessionStorage.removeItem('nagarsetu_user');
      setUser(null);

      // 1. Try Local Express Backend API authentication first
      try {
        let response: Response;
        try {
          response = await fetch(`${getApiUrl()}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileOrEmail: cleanIdentifier, password })
          });
        } catch (fetchErr: any) {
          console.warn(`Backend API login connection note (${getApiUrl()}):`, fetchErr.message);

          if (!isSupabaseConfigured()) {
            throw new Error(`Unable to connect to NagarSetu backend server (${getApiUrl()}). Please make sure your backend API server is running.`);
          }
          throw fetchErr;
        }

        if (response.ok) {
          const data = await response.json();
          if (data.token && data.user) {
            const serverRole = data.user.role;
            const mappedRole: UserRole = (serverRole === 'admin' || serverRole === 'city_admin')
              ? 'city_admin'
              : (serverRole === 'department_head')
                ? 'department_head'
                : (serverRole === 'field_staff' || serverRole === 'staff' || serverRole === 'service_staff')
                  ? 'service_staff'
                  : 'citizen';

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
              department_id: data.user.department_id ? String(data.user.department_id) : (mappedRole === 'citizen' ? undefined : resDept.id),
              department_name: data.user.department_name || staffMatch?.department_name || (mappedRole === 'citizen' ? undefined : (resDept.fullName || resDept.name)),
              department_code: data.user.department_code || (mappedRole === 'citizen' ? undefined : resDept.code),
              employee_id: data.user.employee_id || staffMatch?.employee_id || undefined,
              language_pref: data.user.language_pref || 'en',
              must_change_password: Boolean(data.user.must_change_password)
            };
            setUser(authenticatedUser);
            sessionStorage.setItem('nagarsetu_token', data.token);
            sessionStorage.setItem('nagarsetu_user', JSON.stringify(authenticatedUser));
            localStorage.setItem('nagarsetu_token', data.token);
            localStorage.setItem('nagarsetu_user', JSON.stringify(authenticatedUser));
            localStorage.setItem(`nagarsetu_token_${authenticatedUser.role}`, data.token);
            localStorage.setItem(`nagarsetu_user_${authenticatedUser.role}`, JSON.stringify(authenticatedUser));
            return true;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.message || errData.error || (response.status === 401 ? 'Invalid login credentials' : 'Authentication failed');
          console.warn('Express Backend API returned error:', errMsg);
          
          if (!isSupabaseConfigured()) {
            throw new Error(errMsg);
          }
        }
      } catch (backendErr: any) {
        if (backendErr && backendErr.message && !backendErr.message.includes('fetch') && !backendErr.message.includes('Failed to fetch')) {
          throw backendErr;
        }
      }

      let cleanEmail = cleanIdentifier.includes('@')
        ? cleanIdentifier.toLowerCase()
        : (cleanIdentifier.replace(/\D/g, '').endsWith('9876543213') || cleanIdentifier.toLowerCase() === 'admin')
          ? 'admin@nagarsetu.gov.in'
          : `${cleanIdentifier.toLowerCase()}@nagarsetu.gov.in`;

      if (isSupabaseConfigured() && !cleanIdentifier.includes('@') && cleanEmail !== 'admin@nagarsetu.gov.in') {
        const rawDigits = cleanIdentifier.replace(/\D/g, '');
        const norm = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
        try {
          const { data: matchedProfile } = await supabase
            .from('profiles')
            .select('email')
            .or(`mobile.eq.${cleanIdentifier},mobile.eq.${norm}`)
            .maybeSingle();
          if (matchedProfile?.email) {
            cleanEmail = matchedProfile.email.toLowerCase();
          }
        } catch (e) {
          // Keep default cleanEmail on lookup error
        }
      }

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
          password: password
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
          const resolvedRole: UserRole = deptHead
            ? 'department_head'
            : (roleRes.data?.role as UserRole) || (profile?.role as UserRole) || (cleanEmail.toLowerCase().includes('admin') ? 'city_admin' : 'citizen');
          const staffMatch = resolvedRole === 'service_staff' ? findServiceStaffByIdentifier(cleanEmail || cleanIdentifier) : null;
          const rawDeptId = deptHead?.department_id || profile?.department_id || staffMatch?.department_id;
          const rawDeptName = deptHead?.departments?.name || profile?.department_name || staffMatch?.department_name;
          const rawDeptCode = deptHead?.departments?.code;
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
          if (data.session?.access_token) {
            sessionStorage.setItem('nagarsetu_token', data.session.access_token);
            localStorage.setItem('nagarsetu_token', data.session.access_token);
            localStorage.setItem(`nagarsetu_token_${resolvedRole}`, data.session.access_token);
          }
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          localStorage.setItem(`nagarsetu_user_${resolvedRole}`, JSON.stringify(fetchedUser));
          return true;
        }

        if (error) {
          console.warn('Supabase signInWithPassword note:', error);
          const isDemoPass = ['head@123', 'admin@123', 'staff@123', 'password123', 'nagarsetu@123', '8788562103', 'head123', 'staff123', 'admin123', 'NagarSetu@Admin2026!'].includes((password || '').trim());
          const isDemoEmailOrMobile = cleanEmail.includes('nagarsetu.gov.in') || cleanIdentifier.replace(/\D/g, '').endsWith('9876543213') || cleanIdentifier.includes('8788562103');
          if (!isDemoPass && !isDemoEmailOrMobile) {
            throw new Error(error.message || 'Authentication failed. Please check your credentials.');
          }
        }
      }

      // Query Supabase for active department head record matching cleanEmail
      if (isSupabaseConfigured()) {
        try {
          const { data: dhRow } = await supabase
            .from('department_heads')
            .select('*, departments(*)')
            .eq('email', cleanEmail)
            .eq('status', 'active')
            .maybeSingle();

          if (dhRow) {
            const dhUser: UserProfile = {
              id: dhRow.user_id || `dh-${String(dhRow.id).slice(0, 8)}`,
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
            const tok = 'demo-token-dept-head';
            sessionStorage.setItem('nagarsetu_token', tok);
            sessionStorage.setItem('nagarsetu_user', JSON.stringify(dhUser));
            localStorage.setItem('nagarsetu_token', tok);
            localStorage.setItem('nagarsetu_user', JSON.stringify(dhUser));
            localStorage.setItem('nagarsetu_token_department_head', tok);
            localStorage.setItem('nagarsetu_user_department_head', JSON.stringify(dhUser));
            return true;
          }
        } catch (e) {
          console.warn('Supabase department_heads lookup note:', e);
        }
      }

      // Demo & Client Fallback Authentication
      const fetchDemoToken = async (role: string, fallback: string): Promise<string> => {
        try {
          const res = await fetch(`${getApiUrl()}/api/auth/demo-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
          });
          if (res.ok) {
            const d = await res.json();
            if (d?.token) return d.token;
          }
        } catch (e) {}
        return fallback;
      };

      const cleanPhoneDigits = cleanIdentifier.replace(/\D/g, '');
      const isAdminIdentifier = cleanEmail === 'admin@nagarsetu.gov.in' || cleanPhoneDigits.endsWith('9876543213') || cleanIdentifier.toLowerCase() === 'admin';
      if (isAdminIdentifier) {
        const validAdminPass = ['NagarSetu@Admin2026!', 'admin123', 'Admin@123'].includes((password || '').trim());
        if (!validAdminPass) {
          throw new Error('Invalid login credentials. Please check your admin password.');
        }
        const adminUser: UserProfile = {
          id: '4',
          full_name: 'Municipal Admin',
          email: 'admin@nagarsetu.gov.in',
          mobile: '9876543213',
          role: 'city_admin',
          language_pref: 'en'
        };
        setUser(adminUser);
        const tok = await fetchDemoToken('city_admin', 'demo-token-city-admin');
        sessionStorage.setItem('nagarsetu_token', tok);
        sessionStorage.setItem('nagarsetu_user', JSON.stringify(adminUser));
        localStorage.setItem('nagarsetu_token', tok);
        localStorage.setItem('nagarsetu_user', JSON.stringify(adminUser));
        localStorage.setItem('nagarsetu_token_city_admin', tok);
        localStorage.setItem('nagarsetu_user_city_admin', JSON.stringify(adminUser));
        return true;
      }

      const isDeptHeadIdentifier = cleanEmail.includes('kumar') || cleanEmail.includes('sharma') || cleanPhoneDigits.endsWith('9822000001');
      if (isDeptHeadIdentifier) {
        const validHeadPass = ['head123', 'head@123'].includes((password || '').trim());
        if (!validHeadPass) {
          throw new Error('Invalid login credentials. Please check your department head password.');
        }
        const dhMatch = findDepartmentHeadByIdentifier(cleanIdentifier) || findDepartmentHeadByIdentifier(cleanEmail);
        if (dhMatch) {
          setUser(dhMatch);
          const tok = await fetchDemoToken('department_head', 'demo-token-dept-head');
          sessionStorage.setItem('nagarsetu_token', tok);
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(dhMatch));
          localStorage.setItem('nagarsetu_token', tok);
          localStorage.setItem('nagarsetu_user', JSON.stringify(dhMatch));
          localStorage.setItem('nagarsetu_token_department_head', tok);
          localStorage.setItem('nagarsetu_user_department_head', JSON.stringify(dhMatch));
          return true;
        }
      }

      const isStaffIdentifier = cleanEmail.includes('staff') || cleanPhoneDigits.endsWith('9822010001') || cleanPhoneDigits.endsWith('9876543212');
      if (isStaffIdentifier) {
        const validStaffPass = ['staff123', 'staff@123'].includes((password || '').trim());
        if (!validStaffPass) {
          throw new Error('Invalid login credentials. Please check your staff password.');
        }
        const staffUser = findServiceStaffByIdentifier(cleanIdentifier) || findServiceStaffByIdentifier(cleanEmail);
        if (staffUser) {
          setUser(staffUser);
          const tok = await fetchDemoToken('service_staff', 'demo-token-service-staff');
          sessionStorage.setItem('nagarsetu_token', tok);
          sessionStorage.setItem('nagarsetu_user', JSON.stringify(staffUser));
          localStorage.setItem('nagarsetu_token', tok);
          localStorage.setItem('nagarsetu_user', JSON.stringify(staffUser));
          localStorage.setItem('nagarsetu_token_service_staff', tok);
          localStorage.setItem('nagarsetu_user_service_staff', JSON.stringify(staffUser));
          return true;
        }
      }

      const isCitizenIdentifier = cleanPhoneDigits.includes('8788562103') || cleanPhoneDigits.endsWith('9876543210') || cleanEmail.includes('citizen') || cleanEmail.includes('tupe');
      if (isCitizenIdentifier) {
        const validCitizenPass = ['password123', 'citizen123', 'nagarsetu@123', '8788562103'].includes((password || '').trim());
        if (!validCitizenPass) {
          throw new Error('Invalid login credentials. Please check your citizen password.');
        }
        const citizenUser: UserProfile = {
          id: 'e2a4338c-5d49-4ae3-b766-40d99fb26f87',
          full_name: 'Pratik Dilip Tupe',
          email: 'citizen8788@nagarsetu.gov.in',
          mobile: '8788562103',
          role: 'citizen',
          language_pref: 'en'
        };
        setUser(citizenUser);
        const tok = await fetchDemoToken('citizen', 'demo-token-citizen');
        sessionStorage.setItem('nagarsetu_token', tok);
        sessionStorage.setItem('nagarsetu_user', JSON.stringify(citizenUser));
        localStorage.setItem('nagarsetu_token', tok);
        localStorage.setItem('nagarsetu_user', JSON.stringify(citizenUser));
        localStorage.setItem('nagarsetu_token_citizen', tok);
        localStorage.setItem('nagarsetu_user_citizen', JSON.stringify(citizenUser));
        return true;
      }

      throw new Error("Invalid login credentials. Please check your username/email and password.");
    } catch (e: any) {
      console.warn('Supabase Auth Login error:', e);
      throw e;
    }
  };

  const loginWithOtp = async (mobile: string, otp: string = '123456'): Promise<boolean> => {
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/otp-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.trim(), otp: otp.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token && data.user) {
        const citizenUser: UserProfile = {
          id: String(data.user.id),
          full_name: data.user.name || 'Citizen User',
          mobile: data.user.mobile || mobile,
          email: data.user.email || `${mobile}@citizen.nagarsetu.gov.in`,
          role: 'citizen',
          language_pref: data.user.language_pref || 'en'
        };
        setUser(citizenUser);
        sessionStorage.setItem('nagarsetu_token', data.token);
        sessionStorage.setItem('nagarsetu_user', JSON.stringify(citizenUser));
        localStorage.setItem('nagarsetu_token', data.token);
        localStorage.setItem('nagarsetu_user', JSON.stringify(citizenUser));
        localStorage.setItem('nagarsetu_token_citizen', data.token);
        localStorage.setItem('nagarsetu_user_citizen', JSON.stringify(citizenUser));
        return true;
      }
      throw new Error(data.error || 'Invalid OTP code');
    } catch (e: any) {
      console.warn('Backend OTP verification error:', e.message);
      throw e;
    }
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
        let response: Response;
        try {
          response = await fetch(`${getApiUrl()}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fullName.trim(),
              mobile: mobile.trim(),
              email: email && email.trim() !== '' ? email.trim() : undefined,
              password: password ? password.trim() : undefined,
              role: 'citizen'
            })
          });
        } catch (fetchErr: any) {
          console.warn(`Backend API registration note (${getApiUrl()}):`, fetchErr.message);
          if (!isSupabaseConfigured()) {
            throw new Error(`Unable to connect to NagarSetu backend service (${getApiUrl()}). Please verify the backend API server is running and accessible.`);
          }
          throw fetchErr;
        }

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
            sessionStorage.setItem('nagarsetu_token', data.token);
            sessionStorage.setItem('nagarsetu_user', JSON.stringify(registeredUser));
            localStorage.setItem('nagarsetu_token', data.token);
            localStorage.setItem('nagarsetu_user', JSON.stringify(registeredUser));
            localStorage.setItem('nagarsetu_token_citizen', data.token);
            localStorage.setItem('nagarsetu_user_citizen', JSON.stringify(registeredUser));
            return true;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.message || errData.error || 'Registration failed. Please check your details.';
          throw new Error(errMsg);
        }
      } catch (backendErr: any) {
        if (backendErr && backendErr.message && !backendErr.message.includes('fetch')) {
          throw backendErr;
        }
        if (!isSupabaseConfigured()) {
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
    sessionStorage.removeItem('nagarsetu_user');
    sessionStorage.removeItem('nagarsetu_token');
    setUser(null);
  };

  const updateUserProfile = async (payload: Partial<UserProfile>): Promise<UserProfile> => {
    try {
      const token = localStorage.getItem('nagarsetu_token');
      const response = await fetch(`${getApiUrl()}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: payload.full_name || payload.name,
          mobile: payload.mobile,
          email: payload.email,
          language_pref: payload.language_pref,
          address: payload.address
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update profile');
      }

      const resData = await response.json();
      const updatedUser: UserProfile = {
        ...(user || ({} as UserProfile)),
        ...resData.user,
        full_name: resData.user?.name || resData.user?.full_name || payload.full_name || payload.name || user?.full_name || '',
        name: resData.user?.name || resData.user?.full_name || payload.name || payload.full_name || user?.name || ''
      };

      setUser(updatedUser);
      sessionStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
      localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
      localStorage.setItem(`nagarsetu_user_${updatedUser.role}`, JSON.stringify(updatedUser));

      if (isSupabaseConfigured() && user?.id) {
        try {
          await supabase.from('profiles').update({
            full_name: updatedUser.full_name,
            mobile: updatedUser.mobile,
            email: updatedUser.email,
            language_pref: updatedUser.language_pref
          }).eq('id', user.id);
        } catch (sErr) {
          console.warn('[SUPABASE_PROFILE_SYNC_NOTE]:', sErr);
        }
      }

      return updatedUser;
    } catch (err: any) {
      console.error('updateUserProfile error:', err);
      throw err;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('nagarsetu_token');
    const response = await fetch(`${getApiUrl()}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to update password');
    }

    const resData = await response.json();
    if (resData.token) {
      localStorage.setItem('nagarsetu_token', resData.token);
    }
    if (user) {
      const updatedUser: UserProfile = {
        ...user,
        ...(resData.user || {}),
        must_change_password: false
      };
      setUser(updatedUser);
      localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
    }
  };

  const refreshSession = async (): Promise<UserProfile | null> => {
    try {
      const token = localStorage.getItem('nagarsetu_token');
      if (!token) return user;

      const response = await fetch(`${getApiUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return user;

      const resData = await response.json();
      if (resData.token) {
        localStorage.setItem('nagarsetu_token', resData.token);
      }
      if (resData.user) {
        const refreshed: UserProfile = {
          ...(user || ({} as UserProfile)),
          ...resData.user,
          full_name: resData.user.name || resData.user.full_name || user?.full_name || '',
          name: resData.user.name || resData.user.full_name || user?.name || ''
        };
        setUser(refreshed);
        localStorage.setItem('nagarsetu_user', JSON.stringify(refreshed));
        return refreshed;
      }
      return user;
    } catch (e) {
      console.warn('refreshSession error:', e);
      return user;
    }
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
        role: user ? user.role : ((typeof window !== 'undefined' ? getRoleFromPath(window.location.pathname) : null) || 'citizen'),
        loading,
        login,
        loginWithOtp,
        registerCitizen,
        switchRole,
        logout,
        updateUserProfile,
        changePassword,
        refreshSession
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
