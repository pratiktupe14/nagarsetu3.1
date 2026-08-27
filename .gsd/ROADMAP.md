# NAGARSETU 3.0 — Repair & Localization Overhaul Roadmap

## Phase 1: Localization Foundation & Comprehensive Dictionary Extension
- [ ] Expand `utils/i18n.ts` with complete civic translation keys for `en`, `hi`, and `mr`
- [ ] Add dynamic translators for all complaint categories, statuses, departments, priorities, and system messages
- [ ] Ensure `LanguageContext.tsx` provides reliable state, persistence, and profile sync

## Phase 2: Navigation & Shell Localization
- [ ] Update `Navbar.tsx`, `Sidebar.tsx`, `LanguageSelector.tsx`, `NotificationCenter.tsx` with `t(...)`
- [ ] Update `StatusBadge.tsx` and `PriorityBadge.tsx` with dynamic translators

## Phase 3: Citizen Portal Localization
- [ ] Update `LandingPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`
- [ ] Update `CitizenPortal.tsx`, `ReportIssuePage.tsx`, `MyComplaintsPage.tsx`, `ComplaintDetailPage.tsx`, `NearbyIssuesPage.tsx`, `TrackComplaintPage.tsx`, `CitizenProfilePage.tsx`, `CitizenSettingsPage.tsx`, `CitizenWorkPage.tsx`, `CitizenAnnouncementsPage.tsx`

## Phase 4: Department Head & Staff Portal Localization
- [ ] Update `DepartmentHeadPortal.tsx` (Department Workload, Task Assignment, Staff List)
- [ ] Update `StaffPortal.tsx`, `StaffTaskMapPage.tsx`, `StaffNotificationsPage.tsx`, `StaffSettingsPage.tsx`

## Phase 5: City Admin Portal Localization
- [ ] Update `AdminPortal.tsx`, `AdminComplaintsPage.tsx`, `AdminStaffPage.tsx`, `AdminDepartmentsPage.tsx`, `AdminDepartmentHeadsPage.tsx`, `AdminDepartmentDashboardPage.tsx`, `AdminAnalyticsPage.tsx`, `AdminCityMapPage.tsx`, `AdminOverdueComplaintsPage.tsx`, `AdminNewComplaintsPage.tsx`, `AdminPendingComplaintsPage.tsx`, `AdminInProgressComplaintsPage.tsx`, `AdminResolvedComplaintsPage.tsx`, `AdminReportsPage.tsx`, `AdminSettingsPage.tsx`, `AdminAnnouncementsPage.tsx`, `AdminNotificationsPage.tsx`

## Phase 6: System Reliability & Verification
- [ ] Run `tsc && vite build` to ensure 0 TypeScript errors
- [ ] Run E2E test verification across English, Hindi, and Marathi
- [ ] Verify persistence across refresh & navigation
