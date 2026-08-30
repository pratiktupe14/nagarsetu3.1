import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types/database.types';
import { supabase } from '../lib/supabase';
import {
  Home, FileText, PlusCircle, MapPin, Bell, User, Settings, HelpCircle, Info,
  Building2, Users, Clock, Map, ChevronLeft, ChevronRight, X, Activity,
  CheckCircle2, AlertTriangle, LogOut, UserCheck, LayoutDashboard, Megaphone
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavGroup {
  title: string;
  items: {
    label: string;
    path: string;
    icon: React.ElementType;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  onMobileClose,
  isCollapsed,
  onToggleCollapse
}) => {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const activeRole: UserRole = role || user?.role || 'citizen';

  const citizenNav: NavGroup[] = [
    {
      title: t('mainMenu'),
      items: [
        { label: t('dashboard'), path: '/citizen/portal', icon: Home },
        { label: t('myComplaints'), path: '/citizen/complaints', icon: FileText },
        { label: t('trackComplaint'), path: '/citizen/track', icon: Activity },
        { label: t('reportComplaint'), path: '/citizen/report', icon: PlusCircle },
        { label: t('nearbyIssues'), path: '/citizen/nearby', icon: MapPin },
        { label: t('notifications'), path: '/citizen/notifications', icon: Bell }
      ]
    },
    {
      title: t('accountMenu'),
      items: [
        { label: t('announcements'), path: '/citizen/announcements', icon: Megaphone },
        { label: t('notifications'), path: '/citizen/notifications', icon: Bell },
        { label: t('profile'), path: '/citizen/profile', icon: User },
        { label: t('settings'), path: '/citizen/settings', icon: Settings }
      ]
    }
  ];

  const adminNav: NavGroup[] = [
    {
      title: t('overviewMenu'),
      items: [
        { label: t('dashboard'), path: '/admin/portal', icon: Home }
      ]
    },
    {
      title: t('complaintManagementMenu'),
      items: [
        { label: t('allComplaints'), path: '/admin/complaints', icon: FileText },
        { label: t('newComplaints'), path: '/admin/complaints/new', icon: PlusCircle },
        { label: t('pending'), path: '/admin/complaints/pending', icon: Clock },
        { label: t('inProgress'), path: '/admin/complaints/in-progress', icon: Activity },
        { label: t('resolved'), path: '/admin/complaints/resolved', icon: CheckCircle2 },
        { label: t('overdue'), path: '/admin/complaints/overdue', icon: AlertTriangle }
      ]
    },
    {
      title: t('departmentControlMenu'),
      items: [
        { label: t('departments'), path: '/admin/departments', icon: Building2 },
        { label: t('departmentHeads'), path: '/admin/department-heads', icon: UserCheck },
        { label: t('departmentDashboard'), path: '/admin/departments/dashboard', icon: LayoutDashboard },
        { label: t('serviceStaff'), path: '/admin/staff', icon: Users },
        { label: t('cityMap'), path: '/admin/map', icon: Map }
      ]
    },
    {
      title: t('analytics'),
      items: [
        { label: t('analytics'), path: '/admin/analytics', icon: FileText },
        { label: t('reports'), path: '/admin/reports', icon: FileText }
      ]
    },
    {
      title: t('administrationMenu'),
      items: [
        { label: t('announcements'), path: '/admin/announcements', icon: Megaphone },
        { label: t('notifications'), path: '/admin/notifications', icon: Bell },
        { label: t('settings'), path: '/admin/settings', icon: Settings }
      ]
    }
  ];

  const staffNav: NavGroup[] = [
    {
      title: t('mainMenu'),
      items: [
        { label: t('dashboard'), path: '/staff/portal', icon: Home },
        { label: t('myTasks'), path: '/staff/tasks', icon: FileText },
        { label: t('newAssignments'), path: '/staff/tasks/new', icon: PlusCircle },
        { label: t('inProgress'), path: '/staff/tasks/in-progress', icon: Activity },
        { label: t('overdue'), path: '/staff/tasks/overdue', icon: AlertTriangle },
        { label: t('completed'), path: '/staff/tasks/completed', icon: CheckCircle2 }
      ]
    },
    {
      title: t('cityMap'),
      items: [
        { label: t('taskMap'), path: '/staff/map', icon: Map }
      ]
    },
    {
      title: t('accountMenu'),
      items: [
        { label: t('announcements'), path: '/staff/announcements', icon: Megaphone },
        { label: t('notifications'), path: '/staff/notifications', icon: Bell },
        { label: t('profile'), path: '/staff/profile', icon: User },
        { label: t('settings'), path: '/staff/settings', icon: Settings }
      ]
    }
  ];

  const departmentHeadNav: NavGroup[] = [
    {
      title: t('overviewMenu'),
      items: [
        { label: t('dashboard'), path: '/department-head/portal', icon: Home }
      ]
    },
    {
      title: t('departmentControlMenu'),
      items: [
        { label: t('allComplaints'), path: '/department-head/complaints', icon: FileText },
        { label: t('staff'), path: '/department-head/staff', icon: Users },
        { label: t('taskAssignment'), path: '/department-head/tasks/assign', icon: PlusCircle },
        { label: t('inProgress'), path: '/department-head/tasks/in-progress', icon: Activity },
        { label: t('completed'), path: '/department-head/tasks/completed', icon: CheckCircle2 },
        { label: t('overdue'), path: '/department-head/tasks/overdue', icon: AlertTriangle },
        { label: t('departmentMap'), path: '/department-head/map', icon: Map }
      ]
    },
    {
      title: t('accountMenu'),
      items: [
        { label: t('announcements'), path: '/department-head/announcements', icon: Megaphone },
        { label: t('notifications'), path: '/department-head/notifications', icon: Bell },
        { label: t('profile'), path: '/department-head/profile', icon: User },
        { label: t('settings'), path: '/department-head/settings', icon: Settings }
      ]
    }
  ];

  const navGroups = activeRole === 'city_admin' 
    ? adminNav 
    : activeRole === 'department_head'
    ? departmentHeadNav
    : activeRole === 'service_staff' 
    ? staffNav 
    : citizenNav;

  const roleLabel = activeRole === 'city_admin' 
    ? 'CITY ADMINISTRATION' 
    : activeRole === 'department_head'
    ? 'DEPARTMENT HEAD'
    : activeRole === 'service_staff' 
    ? 'FIELD STAFF' 
    : 'CITIZEN';

  const roleBadgeStyle = activeRole === 'city_admin' 
    ? 'bg-blue-50 text-blue-700 border-blue-200' 
    : activeRole === 'department_head'
    ? 'bg-purple-50 text-purple-800 border-purple-200'
    : activeRole === 'service_staff' 
    ? 'bg-amber-50 text-amber-800 border-amber-200' 
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const handlePerformLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      if (supabase && supabase.auth) {
        await supabase.auth.signOut().catch(() => {});
      }
      logout();
      localStorage.removeItem('nagarsetu_user');
      onMobileClose();
      setShowLogoutConfirm(false);
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      setLogoutError('Unable to logout. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const renderNavContent = () => (
    <div className="flex flex-col justify-between h-full py-4 space-y-6 overflow-y-auto">
      
      <div className="space-y-6 px-3">
        {/* NAGARSETU LOGO & ROLE BADGE */}
        <div className="flex flex-col space-y-2 pb-4 border-b border-gray-100">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-emerald-700 transition-colors font-outfit shrink-0">
              NS
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-extrabold text-base text-gray-900 tracking-tight leading-none font-outfit truncate">
                  NAGARSETU
                </span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold font-mono">
                  Civic Platform 3.0
                </span>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold tracking-wider font-mono uppercase text-center ${roleBadgeStyle}`}>
              {roleLabel} PORTAL
            </div>
          )}
        </div>

        {/* NAVIGATION GROUPS */}
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed && (
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 px-3 py-1 font-outfit">
                {group.title}
              </h4>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path !== '/citizen/portal' && item.path !== '/admin/portal' && item.path !== '/staff/portal' && location.pathname.startsWith(item.path)) ||
                  (item.path === '/citizen/complaints' && location.pathname.startsWith('/citizen/complaint'));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onMobileClose}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 font-extrabold shadow-xs'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-700 font-medium'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM SECTION WITH LOGOUT */}
      <div className="px-3 pt-4 border-t border-gray-100 space-y-2 mt-auto">
        {!isCollapsed && (
          <div className="space-y-1 text-xs text-gray-500 pb-2 border-b border-gray-100">
            <a href="#help" className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help & Support</span>
            </a>
            <a href="#about" className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <Info className="w-3.5 h-3.5" />
              <span>About NAGARSETU</span>
            </a>
          </div>
        )}

        {/* LOGOUT BUTTON */}
        <button
          type="button"
          onClick={() => {
            setLogoutError(null);
            setShowLogoutConfirm(true);
          }}
          title={isCollapsed ? 'Logout' : undefined}
          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-rose-50 hover:text-rose-600 transition-all min-h-[44px] ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0 text-gray-500 hover:text-rose-600" />
          {!isCollapsed && <span>{t('logout')}</span>}
        </button>
      </div>

    </div>
  );

  return (
    <>
      {/* DESKTOP FIXED SIDEBAR */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 fixed top-0 left-0 bottom-0 z-30 transition-all duration-300 font-sans ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderNavContent()}

        {/* COLLAPSE TOGGLE BUTTON */}
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 text-gray-500 hover:text-emerald-600 shadow-sm transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* MOBILE DRAWER SIDEBAR */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs" onClick={onMobileClose} />

          <div className="relative flex-1 max-w-xs w-full bg-white h-full shadow-xl flex flex-col z-10 font-sans">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="font-extrabold text-sm text-gray-900 font-outfit">NAGARSETU Navigation</span>
              <button
                onClick={onMobileClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {renderNavContent()}
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION DIALOG MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-sm w-full bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit flex items-center space-x-2">
                <LogOut className="w-5 h-5 text-rose-600" />
                <span>Confirm Logout</span>
              </h3>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 font-medium">
              Are you sure you want to logout? You will be signed out of your NAGARSETU session.
            </p>

            {logoutError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {logoutError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformLogout}
                disabled={loggingOut}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase min-h-[44px]"
              >
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
