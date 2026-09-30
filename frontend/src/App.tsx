import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// Public Landing Page (Eagerly loaded for instant First Contentful Paint)
import { LandingPage } from './pages/LandingPage';

// Lazy-loaded Public Pages
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));

// Lazy-loaded Citizen Pages
const CitizenPortal = React.lazy(() => import('./pages/citizen/CitizenPortal').then(m => ({ default: m.CitizenPortal })));
const MyComplaintsPage = React.lazy(() => import('./pages/citizen/MyComplaintsPage').then(m => ({ default: m.MyComplaintsPage })));
const NearbyIssuesPage = React.lazy(() => import('./pages/citizen/NearbyIssuesPage').then(m => ({ default: m.NearbyIssuesPage })));
const ReportIssuePage = React.lazy(() => import('./pages/citizen/ReportIssuePage').then(m => ({ default: m.ReportIssuePage })));
const SubmissionSuccessPage = React.lazy(() => import('./pages/citizen/SubmissionSuccessPage').then(m => ({ default: m.SubmissionSuccessPage })));
const ComplaintDetailPage = React.lazy(() => import('./pages/citizen/ComplaintDetailPage').then(m => ({ default: m.ComplaintDetailPage })));
const CitizenProfilePage = React.lazy(() => import('./pages/citizen/CitizenProfilePage').then(m => ({ default: m.CitizenProfilePage })));
const CitizenSettingsPage = React.lazy(() => import('./pages/citizen/CitizenSettingsPage').then(m => ({ default: m.CitizenSettingsPage })));
const CitizenNotificationsPage = React.lazy(() => import('./pages/citizen/CitizenNotificationsPage').then(m => ({ default: m.CitizenNotificationsPage })));
const AnnouncementDetailPage = React.lazy(() => import('./pages/citizen/AnnouncementDetailPage').then(m => ({ default: m.AnnouncementDetailPage })));
const CitizenWorkPage = React.lazy(() => import('./pages/citizen/CitizenWorkPage').then(m => ({ default: m.CitizenWorkPage })));
const MaintenanceDetailPage = React.lazy(() => import('./pages/citizen/MaintenanceDetailPage').then(m => ({ default: m.MaintenanceDetailPage })));
const TrackComplaintPage = React.lazy(() => import('./pages/citizen/TrackComplaintPage').then(m => ({ default: m.TrackComplaintPage })));

// Lazy-loaded Admin Pages
const AdminPortal = React.lazy(() => import('./pages/admin/AdminPortal').then(m => ({ default: m.AdminPortal })));
const AdminComplaintsPage = React.lazy(() => import('./pages/admin/AdminComplaintsPage').then(m => ({ default: m.AdminComplaintsPage })));
const AdminNewComplaintsPage = React.lazy(() => import('./pages/admin/AdminNewComplaintsPage').then(m => ({ default: m.AdminNewComplaintsPage })));
const AdminPendingComplaintsPage = React.lazy(() => import('./pages/admin/AdminPendingComplaintsPage').then(m => ({ default: m.AdminPendingComplaintsPage })));
const AdminInProgressComplaintsPage = React.lazy(() => import('./pages/admin/AdminInProgressComplaintsPage').then(m => ({ default: m.AdminInProgressComplaintsPage })));
const AdminResolvedComplaintsPage = React.lazy(() => import('./pages/admin/AdminResolvedComplaintsPage').then(m => ({ default: m.AdminResolvedComplaintsPage })));
const AdminOverdueComplaintsPage = React.lazy(() => import('./pages/admin/AdminOverdueComplaintsPage').then(m => ({ default: m.AdminOverdueComplaintsPage })));
const AdminDepartmentsPage = React.lazy(() => import('./pages/admin/AdminDepartmentsPage').then(m => ({ default: m.AdminDepartmentsPage })));
const AdminDepartmentHeadsPage = React.lazy(() => import('./pages/admin/AdminDepartmentHeadsPage').then(m => ({ default: m.AdminDepartmentHeadsPage })));
const AdminDepartmentDashboardPage = React.lazy(() => import('./pages/admin/AdminDepartmentDashboardPage').then(m => ({ default: m.AdminDepartmentDashboardPage })));
const AdminCityMapPage = React.lazy(() => import('./pages/admin/AdminCityMapPage').then(m => ({ default: m.AdminCityMapPage })));
const AdminAnalyticsPage = React.lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminReportsPage = React.lazy(() => import('./pages/admin/AdminReportsPage').then(m => ({ default: m.AdminReportsPage })));
const AdminNotificationsPage = React.lazy(() => import('./pages/admin/AdminNotificationsPage').then(m => ({ default: m.AdminNotificationsPage })));
const AdminSettingsPage = React.lazy(() => import('./pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));

// Lazy-loaded Staff Pages
const StaffPortal = React.lazy(() => import('./pages/staff/StaffPortal').then(m => ({ default: m.StaffPortal })));
const StaffNewTasksPage = React.lazy(() => import('./pages/staff/StaffNewTasksPage').then(m => ({ default: m.StaffNewTasksPage })));
const StaffInProgressTasksPage = React.lazy(() => import('./pages/staff/StaffInProgressTasksPage').then(m => ({ default: m.StaffInProgressTasksPage })));
const StaffOverdueTasksPage = React.lazy(() => import('./pages/staff/StaffOverdueTasksPage').then(m => ({ default: m.StaffOverdueTasksPage })));
const StaffCompletedTasksPage = React.lazy(() => import('./pages/staff/StaffCompletedTasksPage').then(m => ({ default: m.StaffCompletedTasksPage })));
const StaffTaskMapPage = React.lazy(() => import('./pages/staff/StaffTaskMapPage').then(m => ({ default: m.StaffTaskMapPage })));
const StaffNotificationsPage = React.lazy(() => import('./pages/staff/StaffNotificationsPage').then(m => ({ default: m.StaffNotificationsPage })));
const StaffSettingsPage = React.lazy(() => import('./pages/staff/StaffSettingsPage').then(m => ({ default: m.StaffSettingsPage })));

// Lazy-loaded Department Head & Announcements Pages
const DepartmentHeadPortal = React.lazy(() => import('./pages/departmentHead/DepartmentHeadPortal').then(m => ({ default: m.DepartmentHeadPortal })));
const AnnouncementsWorkspacePage = React.lazy(() => import('./pages/announcements/AnnouncementsWorkspacePage').then(m => ({ default: m.AnnouncementsWorkspacePage })));
const StaffManagementWorkspacePage = React.lazy(() => import('./pages/departmentHead/StaffManagementWorkspacePage').then(m => ({ default: m.StaffManagementWorkspacePage })));

// Lightweight Route Suspense Fallback
const PageFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
    <div className="p-6 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm w-full text-center">
      <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <div className="space-y-1">
        <h3 className="text-base font-extrabold font-outfit text-white">NAGARSETU</h3>
        <p className="text-xs text-slate-400 font-medium">Loading workspace...</p>
      </div>
    </div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
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
                  <CitizenNotificationsPage />
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
              '/admin/dashboard',
              '/admin/portal'
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
            {['/staff/portal', '/staff/dashboard', '/staff/tasks'].map((path) => (
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
            {['/staff/settings', '/staff/profile'].map((path) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allowedRoles={['service_staff']}>
                    <StaffSettingsPage />
                  </ProtectedRoute>
                }
              />
            ))}

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
              </Suspense>
            </BrowserRouter>
      </NotificationProvider>
    </LanguageProvider>
  </AuthProvider>
</ErrorBoundary>
  );
}
