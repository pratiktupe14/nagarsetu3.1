import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';
import { UserRole } from '../types/database.types';
import { Menu, LogOut } from 'lucide-react';

interface DashboardHeaderProps {
  title?: string;
  onMobileMenuOpen: () => void;
  isMobileMenuOpen?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title = 'Dashboard',
  onMobileMenuOpen,
  isMobileMenuOpen = false
}) => {
  const { user, role, logout } = useAuth();
  const { t, translateRole, translateDepartment } = useLanguage();
  const navigate = useNavigate();
  const activeRole: UserRole = role || user?.role || 'citizen';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* LEFT: MOBILE HAMBURGER & PAGE TITLE */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onMobileMenuOpen}
          className="md:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Open Menu"
          aria-label="Open navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 font-outfit tracking-tight">
          {title}
        </h1>
      </div>

      {/* RIGHT: LANGUAGE SELECTOR, NOTIFICATIONS, USER PROFILE & LOGOUT */}
      <div className="flex items-center space-x-3">
        
        {/* COMPACT LANGUAGE SELECTOR */}
        <LanguageSelector variant="compact" />

        {/* NOTIFICATION CENTER */}
        <NotificationCenter />

        {/* USER PROFILE BADGE & LOGOUT BUTTON */}
        <div className="hidden sm:flex items-center space-x-3 pl-2 border-l border-gray-200 text-right">
          <div>
            <span className="text-xs font-bold text-gray-900 block leading-tight">
              {user?.full_name || (user as any)?.name || translateRole(activeRole)}
            </span>
            <span className="text-[10px] text-gray-500 font-medium block capitalize">
              {activeRole === 'city_admin'
                ? t('roleAdmin')
                : activeRole === 'department_head'
                  ? (user?.department_name ? `${translateDepartment(user.department_name)} - ${t('roleDeptHead')}` : t('roleDeptHead'))
                  : activeRole === 'service_staff'
                    ? (user?.department_name ? `${translateDepartment(user.department_name)} - ${t('roleStaff')}` : t('roleStaff'))
                    : t('roleCitizen')}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center space-x-1.5"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <LogOut className="w-4 h-4 text-gray-500 hover:text-rose-600" />
            <span className="hidden lg:inline text-xs font-bold text-gray-600 hover:text-rose-600">{t('logout')}</span>
          </button>
        </div>

        {/* MOBILE LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          className="flex sm:hidden p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] items-center justify-center"
          title={t('logout')}
          aria-label={t('logout')}
        >
          <LogOut className="w-4 h-4 text-gray-500" />
        </button>

      </div>

    </header>
  );
};
