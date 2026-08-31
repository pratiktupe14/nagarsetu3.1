import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

import { CitizenPortal } from './pages/citizen/CitizenPortal';
import { MyComplaintsPage } from './pages/citizen/MyComplaintsPage';
import { NearbyIssuesPage } from './pages/citizen/NearbyIssuesPage';
import { ReportIssuePage } from './pages/citizen/ReportIssuePage';
import { SubmissionSuccessPage } from './pages/citizen/SubmissionSuccessPage';
import { ComplaintDetailPage } from './pages/citizen/ComplaintDetailPage';
import { CitizenProfilePage } from './pages/citizen/CitizenProfilePage';
import { CitizenSettingsPage } from './pages/citizen/CitizenSettingsPage';
import { CitizenAnnouncementsPage } from './pages/citizen/CitizenAnnouncementsPage';
import { AnnouncementDetailPage } from './pages/citizen/AnnouncementDetailPage';
import { CitizenWorkPage } from './pages/citizen/CitizenWorkPage';
import { MaintenanceDetailPage } from './pages/citizen/MaintenanceDetailPage';
import { TrackComplaintPage } from './pages/citizen/TrackComplaintPage';

import { AdminPortal } from './pages/admin/AdminPortal';
import { AdminComplaintsPage } from './pages/admin/AdminComplaintsPage';
import { AdminNewComplaintsPage } from './pages/admin/AdminNewComplaintsPage';
import { AdminPendingComplaintsPage } from './pages/admin/AdminPendingComplaintsPage';
import { AdminInProgressComplaintsPage } from './pages/admin/AdminInProgressComplaintsPage';
import { AdminResolvedComplaintsPage } from './pages/admin/AdminResolvedComplaintsPage';
import { AdminOverdueComplaintsPage } from './pages/admin/AdminOverdueComplaintsPage';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage';
import { AdminDepartmentHeadsPage } from './pages/admin/AdminDepartmentHeadsPage';
import { AdminDepartmentDashboardPage } from './pages/admin/AdminDepartmentDashboardPage';
import { AdminCityMapPage } from './pages/admin/AdminCityMapPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { StaffPortal } from './pages/staff/StaffPortal';
import { StaffNewTasksPage } from './pages/staff/StaffNewTasksPage';
import { StaffInProgressTasksPage } from './pages/staff/StaffInProgressTasksPage';
import { StaffOverdueTasksPage } from './pages/staff/StaffOverdueTasksPage';
import { StaffCompletedTasksPage } from './pages/staff/StaffCompletedTasksPage';
import { StaffTaskMapPage } from './pages/staff/StaffTaskMapPage';
import { StaffNotificationsPage } from './pages/staff/StaffNotificationsPage';
import { StaffSettingsPage } from './pages/staff/StaffSettingsPage';
import { DepartmentHeadPortal } from './pages/departmentHead/DepartmentHeadPortal';
import { AnnouncementsWorkspacePage } from './pages/announcements/AnnouncementsWorkspacePage';
import { StaffManagementWorkspacePage } from './pages/departmentHead/StaffManagementWorkspacePage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
          <Routes>
            {/* Public Landing & Auth Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Citizen Protected Routes */}
            <Route
              path="/citizen/portal"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaints"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <MyComplaintsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/nearby"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <NearbyIssuesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'city_admin', 'department_head', 'service_staff']}>
                  <AnnouncementsWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/announcements"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'city_admin', 'department_head', 'service_staff']}>
                  <AnnouncementsWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/department-head/announcements"
              element={
                <ProtectedRoute allowedRoles={['department_head', 'city_admin']}>
                  <AnnouncementsWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/announcements"
              element={
                <ProtectedRoute allowedRoles={['service_staff', 'city_admin']}>
                  <AnnouncementsWorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/announcements/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'city_admin', 'department_head', 'service_staff']}>
                  <AnnouncementDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/work"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenWorkPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/work/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <MaintenanceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/notifications"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenPortal />
                </ProtectedRoute>
              }
            />

            <Route
              path="/citizen/report"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <ReportIssuePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/citizen/success"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <SubmissionSuccessPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/citizen/complaint/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'city_admin', 'service_staff']}>
                  <ComplaintDetailPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/citizen/track"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <TrackComplaintPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/track/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <TrackComplaintPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/citizen/profile"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/settings"
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* City Admin Protected Portal & Navigation Sub-routes */}
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AnnouncementsWorkspacePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints/new"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminNewComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints/pending"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminPendingComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints/in-progress"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminInProgressComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints/resolved"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminResolvedComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints/overdue"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminOverdueComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminComplaintsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/departments"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminDepartmentsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/department-heads"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminDepartmentHeadsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/departments/dashboard"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminDepartmentDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <StaffManagementWorkspacePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/map"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminCityMapPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminNotificationsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['city_admin']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Citizen Protected Portal Aliases */}
            {[
              '/citizen/portal',
              '/citizen/dashboard'
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={['citizen']}>
                    <CitizenPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            {/* City Admin Protected Portal Aliases */}
            {[
              '/admin/portal',
              '/admin/dashboard'
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={['city_admin']}>
                    <AdminPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            {/* Service Staff Protected Routes */}
            {['/staff/portal', '/staff/dashboard', '/staff/tasks', '/staff/profile'].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={['service_staff']}>
                    <StaffPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            <Route
              path="/staff/tasks/new"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffNewTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/tasks/in-progress"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffInProgressTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/tasks/overdue"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffOverdueTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/tasks/completed"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffCompletedTasksPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/map"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffTaskMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/tasks/map"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffTaskMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/notifications"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffNotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/settings"
              element={
                <ProtectedRoute allowedRoles={['service_staff']}>
                  <StaffSettingsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/department-head/staff"
              element={
                <ProtectedRoute allowedRoles={['department_head']}>
                  <StaffManagementWorkspacePage />
                </ProtectedRoute>
              }
            />

            {/* Department Head Protected Portal & Navigation Sub-routes */}
            {[
              '/department/portal',
              '/department-head/portal',
              '/department/tasks',
              '/department/tasks/in-progress',
              '/department-head/complaints',
              '/department-head/tasks/assign',
              '/department-head/tasks/in-progress',
              '/department-head/tasks/completed',
              '/department-head/tasks/overdue',
              '/department/tasks/overdue',
              '/department-head/staff/:staffId',
              '/department-head/map',
              '/department/map',
              '/department-head/notifications',
              '/department-head/profile',
              '/department-head/settings'
            ].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={['department_head']}>
                    <DepartmentHeadPortal />
                  </ProtectedRoute>
                }
              />
            ))}

            {/* Catch-all redirect to Landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}
