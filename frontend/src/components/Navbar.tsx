import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { NotificationCenter } from './NotificationCenter';
import { LanguageSelector } from './LanguageSelector';
import { User, LogOut, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeRole = role || user?.role || 'citizen';

  const isPublicPage = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-24 py-1.5 sm:py-2">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group py-1 shrink">
            <img
              src="/logo.png"
              alt="NAGARSETU Civic Platform"
              className="h-10 sm:h-16 md:h-20 w-auto object-contain transition-transform group-hover:scale-105 max-w-[160px] sm:max-w-[340px] md:max-w-[440px]"
            />
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
                  to="/admin/dashboard"
                  className={`transition-colors ${
                    location.pathname === '/admin/dashboard' || location.pathname === '/admin/portal'
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

          {/* Right Actions - Desktop */}
          <div className="hidden md:flex items-center space-x-3">
            
            {/* Language Selector */}
            <LanguageSelector variant="compact" />

            {/* NOTIFICATION CENTER DROPDOWN */}
            {!isPublicPage && <NotificationCenter />}

            {/* User Profile / Logout */}
            {user && !isPublicPage ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-gray-200">
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-900 block leading-tight">
                    {activeRole === 'citizen'
                      ? (user.full_name || (user as any).name || 'Citizen')
                      : (user.full_name || (user as any).name || 'Officer')}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium block capitalize">
                    {activeRole === 'citizen' || user.department_name === 'Unassigned Department' || !user.department_name
                      ? 'Citizen'
                      : user.department_name.split('(')[0].trim()}
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

          {/* Right Actions - Mobile */}
          <div className="flex md:hidden items-center space-x-1.5">
            <LanguageSelector variant="dropdown" />
            {!isPublicPage && <NotificationCenter />}
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4 text-xs font-semibold shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-gray-500 font-bold">Select Language</span>
            <LanguageSelector variant="compact" />
          </div>

          {!user && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold text-center flex items-center justify-center min-h-[44px]"
              >
                {t('login')}
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-center flex items-center justify-center min-h-[44px]"
              >
                {t('register')}
              </Link>
            </div>
          )}

          {user && (
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
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
