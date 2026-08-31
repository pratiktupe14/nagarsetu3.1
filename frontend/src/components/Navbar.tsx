import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';
import { User, LogOut, Menu, X, Building2, Wrench, ChevronDown } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout, switchRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeRole = role || user?.role || 'citizen';

  const isPublicPage = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRoleSwitch = (targetRole: 'citizen' | 'city_admin' | 'service_staff') => {
    switchRole(targetRole);
    if (targetRole === 'citizen') navigate('/citizen/portal');
    if (targetRole === 'city_admin') navigate('/admin/portal');
    if (targetRole === 'service_staff') navigate('/staff/portal');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-emerald-700 transition-colors font-outfit">
              NS
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg text-gray-900 tracking-tight leading-none font-outfit">
                NAGARSETU
              </span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold font-mono hidden sm:block">
                Civic Platform
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          {!isPublicPage && (
            <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold">
              {activeRole === 'citizen' && (
                <>
                  <Link
                    to="/citizen/portal"
                    className={`transition-colors ${
                      location.pathname === '/citizen/portal'
                        ? 'text-emerald-700 font-extrabold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('dashboard')}
                  </Link>
                  <Link
                    to="/citizen/report"
                    className={`transition-colors ${
                      location.pathname === '/citizen/report'
                        ? 'text-emerald-700 font-extrabold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t('reportComplaint')}
                  </Link>
                </>
              )}

              {activeRole === 'city_admin' && (
                <Link
                  to="/admin/portal"
                  className={`transition-colors ${
                    location.pathname === '/admin/portal'
                      ? 'text-emerald-700 font-extrabold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t('officerDashboardTitle')}
                </Link>
              )}

              {activeRole === 'service_staff' && (
                <Link
                  to="/staff/portal"
                  className={`transition-colors ${
                    location.pathname === '/staff/portal'
                      ? 'text-emerald-700 font-extrabold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t('serviceStaffPortal')}
                </Link>
              )}
            </nav>
          )}

          {/* Right Actions */}
          <div className="hidden md:flex items-center space-x-3">
            
            {/* Language Selector */}
            <LanguageSelector variant="compact" />

            {/* Demo Role Selector */}
            {!isPublicPage && (
              <div className="relative group">
                <button className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-100 flex items-center space-x-1.5 min-h-[44px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="capitalize">{activeRole ? activeRole.replace('_', ' ') : 'Switch Role'}</span>
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

            {/* NOTIFICATION CENTER DROPDOWN */}
            <NotificationCenter />

            {/* User Profile / Logout */}
            {user && !isPublicPage ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-gray-200">
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-900 block leading-tight">
                    {user.full_name && user.full_name !== 'Department Head' ? user.full_name : 'Rahul Kumar'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium block">
                    {user.department_name ? user.department_name.split('(')[0].trim() : (activeRole || 'citizen').replace('_', ' ')}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  {t('login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs"
                >
                  {t('register')}
                </Link>
              </div>
            )}

          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            <NotificationCenter />
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4 text-xs font-semibold">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <span className="text-gray-500 font-bold">Language</span>
            <LanguageSelector variant="compact" />
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { handleRoleSwitch('citizen'); setMobileMenuOpen(false); }}
              className="w-full text-left p-2.5 rounded-xl bg-gray-50 text-gray-800 font-bold"
            >
              Citizen View
            </button>
            <button
              onClick={() => { handleRoleSwitch('city_admin'); setMobileMenuOpen(false); }}
              className="w-full text-left p-2.5 rounded-xl bg-gray-50 text-gray-800 font-bold"
            >
               City Administration View
            </button>
            <button
              onClick={() => { handleRoleSwitch('service_staff'); setMobileMenuOpen(false); }}
              className="w-full text-left p-2.5 rounded-xl bg-gray-50 text-gray-800 font-bold"
            >
               Field Staff View
            </button>
          </div>

          {user && (
            <button
              onClick={handleLogout}
              className="w-full p-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-left flex items-center space-x-2 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
