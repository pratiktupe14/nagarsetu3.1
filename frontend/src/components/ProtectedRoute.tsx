import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/database.types';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { role, switchRole } = useAuth();
  const rolesKey = allowedRoles ? allowedRoles.join(',') : '';

  useEffect(() => {
    if (allowedRoles && allowedRoles.length > 0) {
      const requiredRole = allowedRoles[0];
      if (role !== requiredRole && (requiredRole === 'citizen' || requiredRole === 'city_admin' || requiredRole === 'department_head' || requiredRole === 'service_staff')) {
        switchRole(requiredRole);
      }
    }
  }, [rolesKey, role, switchRole]);

  return children;
};
