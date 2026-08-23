import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserRole } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { RefreshCw, Sparkles } from 'lucide-react';

interface AuthContextType {
  user: UserProfile;
  role: UserRole;
  loading: boolean;
  login: (identifier: string, password: string, role: UserRole) => Promise<boolean>;
  loginWithOtp: (mobile: string, otp: string) => Promise<boolean>;
  registerCitizen: (fullName: string, mobile: string, email: string, password?: string) => Promise<boolean>;
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    id: 'demo-staff-id-303',
    full_name: 'Rahul Patil',
    mobile: '9823044101',
    email: 'staff@nagarsetu.gov.in',
    role: 'service_staff',
    language_pref: 'en'
  },
  department_head: {
    id: 'demo-head-id-404',
    full_name: 'Department Head',
    email: 'dept.head@nagarsetu.gov.in',
    role: 'department_head',
    department_name: 'Public Works Department (PWD)',
    department_id: 'dept-pwd',
    language_pref: 'en'
  }
};

export const DEMO_USERS = DEFAULT_ROLE_USERS;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    const cached = localStorage.getItem('nagarsetu_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.role) return parsed;
      } catch (e) {}
    }
    return DEFAULT_ROLE_USERS.citizen;
  });

  const [loading, setLoading] = useState(true);

  // Sync Supabase Auth state changes safely
  useEffect(() => {
    let isMounted = true;

    async function checkCurrentSession() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setLoading(false);
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
            setUser(fetchedUser);
            localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          }
        }
      } catch (err) {
        console.warn('Supabase Auth Session Check:', err);
      } finally {
        if (isMounted) setLoading(false);
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
          setUser(updatedUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(updatedUser));
        }
      });
      authSubscription = res?.data?.subscription;
    } catch (e) {
      console.warn('onAuthStateChange setup note:', e);
    }

    return () => {
      isMounted = false;
      if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
        try {
          authSubscription.unsubscribe();
        } catch (e) {}
      }
    };
  }, []);

  const switchRole = (newRole: UserRole) => {
    const roleUser = DEFAULT_ROLE_USERS[newRole] || DEFAULT_ROLE_USERS.citizen;
    setUser(roleUser);
    localStorage.setItem('nagarsetu_user', JSON.stringify(roleUser));
  };

  const login = async (identifier: string, password: string, targetRole: UserRole): Promise<boolean> => {
    setLoading(true);
    try {
      const cleanEmail = identifier.includes('@') ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase()}@nagarsetu.gov.in`;

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
          throw new Error("Your Department Head access has been deactivated. Please contact City Administration.");
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

          const fetchedUser: UserProfile = {
            id: authUser.id,
            full_name: deptHead?.name || profile?.full_name || authUser.email?.split('@')[0] || 'Authenticated User',
            email: authUser.email || cleanEmail,
            mobile: deptHead?.phone || profile?.mobile || '',
            role: resolvedRole,
            department_id: deptHead?.department_id || profile?.department_id,
            department_name: deptHead?.departments?.name || profile?.department_name,
            employee_id: deptHead?.employee_id || profile?.employee_id,
            language_pref: profile?.language_pref || 'en'
          };
          setUser(fetchedUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(fetchedUser));
          return true;
        }

        if (error) {
          console.warn('Supabase signInWithPassword note:', error);
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
            employee_id: dhRow.employee_id,
            language_pref: 'en'
          };
          setUser(dhUser);
          localStorage.setItem('nagarsetu_user', JSON.stringify(dhUser));
          return true;
        }
      }

      switchRole(targetRole);
      return true;
    } catch (e: any) {
      console.warn('Supabase Auth Login error:', e);
      throw e;
    } finally {
      setLoading(false);
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
    setLoading(true);
    try {
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

      const newCitizen: UserProfile = {
        id: 'citizen-' + Date.now(),
        full_name: fullName || 'Registered Citizen',
        mobile,
        email,
        role: 'citizen'
      };
      setUser(newCitizen);
      localStorage.setItem('nagarsetu_user', JSON.stringify(newCitizen));
      return true;
    } catch (e) {
      console.error('Registration Error:', e);
      return false;
    } finally {
      setLoading(false);
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
    switchRole('citizen');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col justify-center items-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md animate-pulse font-outfit">
          NS
        </div>
        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          <span>NAGARSETU 3.0 — Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
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
