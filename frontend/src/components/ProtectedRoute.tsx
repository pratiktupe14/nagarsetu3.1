import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/database.types';
import { Shield, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // 1. Wait for Auth Context initialization to complete before making access decisions
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="p-6 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm w-full text-center">
          <div className="relative">
            <Shield className="w-12 h-12 text-emerald-500 animate-pulse" />
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold font-outfit text-white">NAGARSETU 3.0</h3>
            <p className="text-xs text-slate-400 font-medium">Verifying secure session & profile permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Redirect to /login if user is unauthenticated
  if (!user || !user.role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Enforce Role Access Security: If user's role is not authorized for this route, redirect to their role portal
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'city_admin') return <Navigate to="/admin/portal" replace />;
    if (role === 'department_head') return <Navigate to="/department/portal" replace />;
    if (role === 'service_staff') return <Navigate to="/staff/portal" replace />;
    return <Navigate to="/citizen/portal" replace />;
  }

  return children;
};
