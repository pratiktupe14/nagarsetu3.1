# NAGARSETU 3.1 — PHASE 1 GIT CHANGE FORENSICS REPORT

## Recent Commit Overview (Last 10 Commits)

- `97e9179` — `backend/src/routes/department.routes.js`: Department staff filtering and normalization refactoring.
- `79df02d` — `backend/src/routes/auth.routes.js`, `seedDemoDepartmentHeads.js`, `Sidebar.tsx`, `AuthContext.tsx`, `LoginPage.tsx`, `adminService.ts`: Department head authentication & staff resolution updates.
- `09bf181` — `backend/src/routes/auth.routes.js`, `frontend/src/context/AuthContext.tsx`: Auth refresh & user payload synchronization.
- `97f3951` — `seedDemoDepartmentHeads.js`, `LoginPage.tsx`: Demo password alignment and login error hints.
- `2567a95` — `frontend/src/services/departmentService.ts`: Staff password change matrix updates.
- `70092e6` — Major credential management refactoring across `db.js`, `auth.js`, `auth.routes.js`, `department.routes.js`, `seedDemoDepartmentHeads.js`, `seedServiceStaff.js`, `ForcePasswordChangeModal.tsx`, `AuthContext.tsx`, `StaffManagementWorkspacePage.tsx`, `departmentService.ts`.
- `7ee31fa` — CORS, AI routes, upload middleware, and static asset routing tweaks.
- `89aa216` — Location service fallback, auth context state sync, complaint submission location fixes.
- `547b02f` — AuthContext session restoration fixes.
- `f72b6b8` — `fix(complaints)`: Citizen profile UUID auto-creation on complaint submission.

---

## Detailed Audit of Modified Application Files

### 1. `backend/src/routes/department.routes.js`
- **What changed**: Added `normalizeDepartmentInfo` helper; updated `resolveUserDepartment` to return normalized dept metadata; refactored `GET /api/department/staff`, active tasks summary query, and `GET /api/department/staff/assignable` to match staff via `CAST(fs.department_id AS TEXT) IN ($1, $2)`, `employee_id LIKE $3`, or `d.code = $2`.
- **Why it changed**: Fix bug where Department Head portal returned 0 active staff members due to rigid string checks `['1', 'PWD'].includes(String(userDeptId))` when department IDs were strings like `'DEPT-1'`, `'DEPT-PWD'`, or `'Public Works Department'`.
- **Replaces old logic?**: Yes, replaces hardcoded array check `isPwd`, `isSan`, etc. with dynamic `normalizeDepartmentInfo`.
- **Does old logic exist elsewhere?**: Local `normDept` helpers were previously defined in 3 separate inline route handlers (`/assign`, `/task/status`, `/task/resolve`).
- **Conflict Risk**: Low to medium. The new `normalizeDepartmentInfo` resolves string aliases consistently, but local `normDept` functions inside specific route handlers still exist and may diverge if updated separately.

### 2. `backend/src/routes/auth.routes.js`
- **What changed**: Added fallback queries for login matching `department_heads` and `field_staff` by phone/email/employee_id; enforced `must_change_password` check; populated `department_id`, `department_name`, and `department_code` in login payload.
- **Why it changed**: Prevent login failures when users were created in `department_heads` or `field_staff` but missing direct `department_id` in the `users` table.
- **Replaces old logic?**: Augments standard `users` table query with multi-table fallback queries.
- **Does old logic exist elsewhere?**: Duplicate user resolution logic exists in `middleware/auth.js`, `routes/department.routes.js`, and `routes/staff.routes.js`.
- **Conflict Risk**: High. If `auth.routes.js` resolves department ID via fallback, but `middleware/auth.js` or `resolveUserDepartment` in `department.routes.js` queries `users` directly (where `department_id` might be `null`), the user's token vs database state will mismatch.

### 3. `backend/src/config/db.js`
- **What changed**: Added `$1` to `?` parameter replacement logic for SQLite mode (`/\$\d+/.test(sql)`), added `pgPool` uninitialized error handling, added SQLite initial seeding for departments and codes.
- **Why it changed**: Allow backend routes using PostgreSQL `$1`, `$2` parameter syntax to run seamlessly on local development SQLite database.
- **Replaces old logic?**: Replaces simple `params` passing with regex-based `$1` replacement.
- **Does old logic exist elsewhere?**: No.
- **Conflict Risk**: Medium. In queries that mix `$1` placeholders with `?` placeholders, the regex `/\$\d+/.test(sql)` replaces only `$1` placeholders and overwrites `sqliteParams`, discarding positional `?` parameters.

### 4. `backend/src/middleware/auth.js`
- **What changed**: Added central route guard rejecting non-essential requests if `must_change_password` is pending; added query check against `users.must_change_password`.
- **Why it changed**: Force first-time users or password-reset users to change password before accessing dashboard data.
- **Replaces old logic?**: Replaces simple JWT token verification with active database state check per request.
- **Does old logic exist elsewhere?**: Frontend `AuthContext.tsx` and `ProtectedRoute.tsx` also check `must_change_password` from `user` object in React state/localStorage.
- **Conflict Risk**: Medium. If `must_change_password` is updated in DB, the frontend state stored in `localStorage` (`nagarsetu_user`) may remain stale until page reload or token re-fetch.

### 5. `frontend/src/context/AuthContext.tsx`
- **What changed**: Synchronized `user` state with API responses, added `must_change_password` state flag, added periodic/on-mount token verification via `/api/auth/me`.
- **Why it changed**: Keep frontend user session in sync with backend role and password status.
- **Replaces old logic?**: Replaces pure `localStorage` session read with API re-validation.
- **Does old logic exist elsewhere?**: Direct `localStorage.getItem('nagarsetu_user')` is still performed in individual service files (`adminService.ts`, `departmentService.ts`, `complaintService.ts`).
- **Conflict Risk**: High. Service files that read `localStorage` directly can read outdated user objects if `AuthContext` updates React state without updating `localStorage.setItem('nagarsetu_user')`.

### 6. `frontend/src/services/departmentService.ts` & `adminService.ts`
- **What changed**: Added API calls for staff password management, added fallback memory arrays and direct Supabase queries when backend API is unreachable.
- **Why it changed**: Provide offline fallback and compatibility with direct Supabase deployments.
- **Replaces old logic?**: Wraps direct database queries with backend API calls.
- **Does old logic exist elsewhere?**: Yes! Both services contain fallback functions that query Supabase directly or return `memoryStaffRecords` / mock data.
- **Conflict Risk**: CRITICAL. If backend API returns an error or 404, frontend services fall back to querying Supabase directly or reading memory state, causing multi-source-of-truth conflicts.
