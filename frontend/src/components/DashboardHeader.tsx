import React from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';
import { UserRole } from '../types/database.types';
import {
  Menu, Search, User, Building2, Wrench, ChevronDown, ShieldCheck, Zap
} from 'lucide-react';

interface DashboardHeaderProps {
  title?: string;
  onMobileMenuOpen: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = 'Dashboard',
  onMobileMenuOpen
}) => {
  const { user, role, switchRole } = useAuth();
  const activeRole: UserRole = role || user?.role || 'citizen';

  const handleRoleSwitch = (targetRole: UserRole) => {
    switchRole(targetRole);
    if (targetRole === 'citizen') window.location.href = '/citizen/portal';
    if (targetRole === 'city_admin') window.location.href = '/admin/portal';
    if (targetRole === 'service_staff') window.location.href = '/staff/portal';
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* LEFT: MOBILE HAMBURGER & PAGE TITLE */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 font-outfit tracking-tight">
          {title}
        </h1>
      </div>

      {/* RIGHT: LANGUAGE SELECTOR, NOTIFICATIONS & USER ROLE SWITCHER */}
      <div className="flex items-center space-x-2.5">
        
        {/* COMPACT LANGUAGE SELECTOR */}
        <LanguageSelector variant="compact" />

        {/* DEMO ROLE SWITCHER DROPDOWN */}
        {activeRole !== 'department_head' && (
          <div className="relative group">
            <button aria-label="Switch User Role" className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center space-x-1.5 min-h-[44px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="capitalize">{activeRole.replace('_', ' ')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>

            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-gray-200 shadow-lg py-1 hidden group-hover:block z-50 text-xs font-medium">
              <button
                onClick={() => handleRoleSwitch('citizen')}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-gray-800"
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Citizen View</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('city_admin')}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-gray-800"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>City Administration View</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('service_staff')}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-gray-800"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>Field Staff View</span>
              </button>
            </div>
          </div>
        )}

        {/* NOTIFICATION CENTER */}
        <NotificationCenter />

        {/* USER PROFILE BADGE */}
        <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-gray-200 text-right">
          <div>
            <span className="text-xs font-bold text-gray-900 block leading-tight">
              {activeRole === 'citizen' 
                ? (user?.full_name && user.full_name !== 'Demo Citizen' && user.full_name !== 'Citizen User' ? user.full_name : 'Pratik Dilip Tupe')
                : (user?.full_name && user.full_name !== 'Department Head' ? user.full_name : 'Rahul Kumar')}
            </span>
            <span className="text-[10px] text-gray-500 font-medium block capitalize">
              {activeRole === 'citizen' || user?.department_name === 'Unassigned Department' || !user?.department_name
                ? 'Citizen'
                : user.department_name.split('(')[0].trim()}
            </span>
          </div>
        </div>

      </div>

    </header>
  );
};
