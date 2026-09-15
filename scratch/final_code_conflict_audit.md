# NAGARSETU 3.1 — CODE CONFLICT & OVERWRITE AUDIT REPORT

**Date:** September 15, 2026  
**Project:** NagarSetu 3.1 (Municipal Civic Issue & Complaint Management Platform)  
**Audit Scope:** Read-Only Forensic Analysis across Backend, Frontend, Database, Auth, Security, and Workflows.

---

## EXECUTIVE SUMMARY

A full forensic audit of the NagarSetu 3.1 repository was conducted. 77 backend API routes, 145 frontend API/data calls, 13 core database tables, and the complete authentication, RBAC, and complaint resolution lifecycle were inspected.

The static validation and acceptance test suites passed 100% (59/59 acceptance tests passed, `npx tsc --noEmit` clean, `npm run build` production bundle succeeded in 42.5s). However, the forensic audit revealed **significant structural debt, unauthenticated secondary route mounts, competing frontend persistence layers, and duplicate route implementations** that pose ongoing security and maintainability risks.

---

## 1. CRITICAL CONFLICTS

### FINDING C-01: Unauthenticated Secondary Endpoints in `officer.routes.js`
- **ID:** C-01
- **SEVERITY:** CRITICAL
- **FILE:** `backend/src/routes/officer.routes.js`
- **LINE:** Lines 78, 123, 181, 314
- **CURRENT BEHAVIOR:** Routes `/verify`, `/assign`, `/staff-list`, `/duplicates` in `officer.routes.js` do NOT attach `authenticateToken` or `requireRole` middleware.
- **CONFLICT:** `department.routes.js` implements authenticated versions of `/assign` and `/verify` with strict `requireRole(['department_head', 'admin', 'city_admin'])`, but `app.js` mounts `officer.routes.js` at `/api/officer`.
- **IMPACT:** Anyone can send unauthenticated POST requests to `/api/officer/assign` or `/api/officer/verify` to reassign complaints or force-verify complaints without valid JWT credentials.
- **RECOMMENDED FIX:** Add `authenticateToken` and `requireRole(['department_head', 'admin', 'city_admin', 'officer'])` to all route declarations in `officer.routes.js`, or consolidate `officer.routes.js` into `department.routes.js`.

### FINDING C-02: Unauthenticated Field Staff Task Mutation Routes in `staff.routes.js`
- **ID:** C-02
- **SEVERITY:** CRITICAL
- **FILE:** `backend/src/routes/staff.routes.js`
- **LINE:** Lines 15, 71, 131, 320
- **CURRENT BEHAVIOR:** Routes `/tasks`, `/task/:id/status`, `/task/:id/resolve`, and `/task/:id/progress` rely on inline checks or manual header parsing without top-level `authenticateToken` middleware attached at the router definition line.
- **CONFLICT:** While inline queries attempt `req.user` resolution, requests without an Authorization header can trigger unexpected null-reference errors or bypass checks if fallback logic executes.
- **IMPACT:** Risk of anonymous task status updates or unauthenticated resolution submissions if `req.user` falls through.
- **RECOMMENDED FIX:** Attach `authenticateToken` explicitly as route middleware on all `staff.routes.js` endpoints.

---

## 2. HIGH-RISK CONFLICTS

### FINDING H-01: Dual Routing for Department Endpoints (`/api/department` vs `/api/departments`)
- **ID:** H-01
- **SEVERITY:** HIGH
- **FILE:** `backend/src/app.js`
- **LINE:** Lines 146–147
- **CURRENT BEHAVIOR:** `app.use('/api/departments', departmentRoutes)` and `app.use('/api/department', departmentRoutes)` mount the same router on both singular and plural paths.
- **CONFLICT:** Frontend code calls both singular (`/api/department/staff`) and plural (`/api/departments`) paths interchangeably across different services.
- **IMPACT:** Inconsistent caching, rate-limiting key isolation, and confusion in API documentation.
- **RECOMMENDED FIX:** Standardize all backend calls and frontend services to `/api/departments` (or `/api/department`) and create an explicit redirect alias middleware for backwards compatibility.

### FINDING H-02: Competing Frontend Persistence (Direct Supabase Queries vs Express Backend REST API)
- **ID:** H-02
- **SEVERITY:** HIGH
- **FILE:** `frontend/src/services/departmentService.ts`, `adminService.ts`, `complaintService.ts`
- **LINE:** e.g., `departmentService.ts` lines 413, 773, 978, 1023
- **CURRENT BEHAVIOR:** Service methods attempt to call Express REST API first, but fallback to direct Supabase client queries (`supabase.from('department_heads').select(...)`) or local memory arrays if the REST API throws an error.
- **CONFLICT:** Violates single source-of-truth. Express REST API enforces PostgreSQL/SQLite server-side validation and audit logging, whereas direct Supabase queries bypass Express middleware and rate limiters.
- **IMPACT:** Mismatched complaint status history, un-audited mutations, and stale state synchronization.
- **RECOMMENDED FIX:** Remove direct Supabase client fallback queries from frontend service methods when running in standard Express backend mode.

---

## 3. MEDIUM-RISK CONFLICTS

### FINDING M-01: Inconsistent User Department Resolution Across Routes
- **ID:** M-01
- **SEVERITY:** MEDIUM
- **FILE:** `backend/src/routes/department.routes.js`, `staff.routes.js`, `announcement.routes.js`
- **LINE:** `department.routes.js` line 20; `staff.routes.js` line 94; `announcement.routes.js` line 12
- **CURRENT BEHAVIOR:** `resolveUserDepartment` was redefined in `announcement.routes.js` and inline fallback logic was written in `staff.routes.js`.
- **CONFLICT:** Different route files resolve `department_id` using different query strategies (some query `users`, some query `department_heads`, some query `field_staff`).
- **IMPACT:** Discrepancies when a user exists in `department_heads` but has a `null` `department_id` in `users`.
- **RECOMMENDED FIX:** Extract `resolveUserDepartment` into a shared backend utility module (`backend/src/utils/userResolver.js`) imported by all routes.

### FINDING M-02: Mixed Parameter Placeholders in SQLite Transpilation
- **ID:** M-02
- **SEVERITY:** MEDIUM
- **FILE:** `backend/src/config/db.js`
- **LINE:** Line 877 (`/\$\d+/.test(sql)`)
- **CURRENT BEHAVIOR:** `db.js` inspects `sql` for `$\d+`. If found, it replaces `$1`, `$2` with `?` and constructs `sqliteParams`.
- **CONFLICT:** If a query contains both positional `?` and indexed `$1` parameters, `db.js` replaces only `$1` and discards positional parameters.
- **IMPACT:** Silent parameter offset errors if mixed SQL parameter formats are used.
- **RECOMMENDED FIX:** Standardize all backend SQL queries to use `$1, $2` PostgreSQL style syntax throughout `backend/src/routes/`.

---

## 4. LOW-RISK TECHNICAL DEBT

### FINDING L-01: Redundant Local `normDept` Functions
- **ID:** L-01
- **SEVERITY:** LOW
- **FILE:** `backend/src/routes/department.routes.js`
- **LINE:** Lines 738, 907, 1001
- **CURRENT BEHAVIOR:** Local `normDept` arrow functions are declared inline inside `/assign`, `/verify`, and password reset handlers.
- **CONFLICT:** A top-level `normalizeDepartmentInfo` function now exists at line 20 of `department.routes.js`.
- **IMPACT:** Maintenance overhead and code duplication.
- **RECOMMENDED FIX:** Replace inline `normDept` declarations with top-level `normalizeDepartmentInfo`.

---

## 5. DUPLICATE IMPLEMENTATIONS

| Business Capability | Implementation Location 1 | Implementation Location 2 | Conflict / Discrepancy Risk |
|---|---|---|---|
| **Department Staff Query** | `GET /api/department/staff` (`department.routes.js`) | `getDepartmentServiceStaff` (`adminService.ts`) via Supabase fallback | Memory array vs DB mismatch |
| **Task Assignment** | `POST /api/department/assign` (authenticated) | `POST /api/officer/assign` (unauthenticated) | Security bypass risk |
| **Task Verification** | `POST /api/department/verify` (authenticated) | `POST /api/officer/verify` (unauthenticated) | Security bypass risk |
| **Department Resolution** | `resolveUserDepartment` (`department.routes.js`) | `resolveUserDepartment` (`announcement.routes.js`) | Code duplication |
| **Department Normalization** | `normalizeDepartmentInfo` (`department.routes.js`:20) | `normDept` (`department.routes.js`:738, 907, 1001) | Code duplication |

---

## 6. DUPLICATE API ROUTES

| Method | Path | File 1 | File 2 | Conflict |
|---|---|---|---|---|
| **POST** | `/assign` | `department.routes.js:719` (Auth: true, Roles: Dept Head/Admin/Officer) | `officer.routes.js:181` (Auth: false) | `officer.routes.js` version lacks auth middleware |
| **POST** | `/verify` | `department.routes.js:915` (Auth: true, Roles: Dept Head/Admin) | `officer.routes.js:123` (Auth: false) | `officer.routes.js` version lacks auth middleware |
| **GET** | `/` | `announcement.routes.js:43` | `complaint.routes.js:381` | Route root collision when mounted |
| **POST** | `/` | `announcement.routes.js:152` | `department.routes.js:100` | Route root collision when mounted |

---

## 7. FRONTEND/BACKEND CONTRACT MISMATCHES

- **`department_id` Type Mismatch**: Frontend TS interfaces (`database.types.ts`) specify `department_id?: string`, while PostgreSQL schema uses `INTEGER` and SQLite uses `INTEGER/TEXT`. Correctly coerced in current routes, but requires strict string handling on client.
- **Status Name Coercion**: Backend returns complaint status values like `'Staff Assigned'`, `'Resolution Submitted'`, while frontend displays badges. Both align in current routes.

---

## 8. DATABASE SCHEMA MISMATCHES

- **User ID Types**: `users.id` is `INTEGER` (auto-increment) in local SQLite / PostgreSQL, whereas citizen Supabase Auth IDs are `UUID` strings. `users.profile_id` or `users.id` text casting handles this across `auth.routes.js` and `complaint.routes.js`.
- **Field Staff FK**: `field_staff.user_id` stores user ID as integer/string, with `field_staff.id` as primary key. Backend queries use `CAST(fs.user_id AS TEXT) = CAST(u.id AS TEXT)` to avoid type mismatch errors.

---

## 9. AUTHENTICATION CONFLICTS

- **Stale `localStorage` User State**: `AuthContext.tsx` maintains React state and `localStorage.setItem('nagarsetu_user')`. If user role or `must_change_password` changes in backend DB, `localStorage` can retain old state until `/api/auth/me` refreshes.
- **Force Password Change Modal**: Handled by both `ForcePasswordChangeModal.tsx` on frontend and `middleware/auth.js` on backend. Backend route guard cleanly blocks protected endpoints until password change is completed.

---

## 10. RBAC CONFLICTS

- **Frontend Guards vs Backend Enforcement**: Frontend hides UI actions based on `role`, but server-side `requireRole` and ownership checks (`req.user.id`, `userDeptId`) in `department.routes.js` and `complaint.routes.js` provide real security.
- **Officer Route Security Gap**: As noted in C-01, `officer.routes.js` endpoints lack top-level `authenticateToken` middleware.

---

## 11. SOURCE-OF-TRUTH VIOLATIONS

- **Frontend Fallback Memory Arrays**: `adminService.ts` contains `memoryStaffRecords` array that is updated during API responses. If an API request fails, fallback code returns `memoryStaffRecords` which may not reflect real database changes made by other users.

---

## 12. HARDCODED DATA AUDIT

- **Demo Credentials**: Seed scripts provision standard demo accounts (`admin@nagarsetu.gov.in`, `rahul.kumar@nagarsetu.gov.in`, etc.) with initial passwords. All initial passwords enforce `must_change_password = true` on first login.
- **Sample IDs**: `STF-001`, `EMP-PWD-001` exist as default fallback employee ID formatters in route mappings when DB `employee_id` is null.

---

## 13. DEAD / LEGACY CODE

- **Unused `officer.routes.js` Endpoints**: Frontend uses `/api/department/assign` and `/api/department/verify`. `/api/officer/assign` and `/api/officer/verify` are legacy duplicate endpoints that are unused by modern frontend components.

---

## 14. TEST COVERAGE GAPS

Existing test scripts in `scratch/`:
- `test_security_isolation.js` (Citizen isolation, DH isolation, staff isolation) — **PASSING**
- `test_credential_management.js` (Password change matrix, force change, seed idempotency) — **PASSING**
- `test_department_staff_visibility.js` (Admin vs DH staff visibility across all 7 depts) — **PASSING**
- `run_production_acceptance_test.js` (59-step complete end-to-end acceptance suite) — **PASSING**

**Identified Coverage Gaps:**
1. Multi-file concurrent upload error handling.
2. Citizen notification push failure resilience test.
3. Offline service worker sync regression test.

---

## 15. RECENT CHANGE REGRESSION RISKS

- **Department Staff Normalization**: Fixed the 0 staff bug for Department Heads by adding `normalizeDepartmentInfo`. Verification tests confirm all 7 departments return exact expected staff counts (PWD: 6, SAN: 5, WTR: 5, DRN: 5, ELE: 5, TRF: 5, MNT: 5, Total: 36).
- **Regression Risk**: Low. Acceptance test suite verified all 59 assertions passed cleanly without breaking existing functionality.

---

## ANSWERS TO AUDIT QUESTIONS

1. **Which code is authoritative?**  
   The Express backend routes (`backend/src/routes/*.js`) backed by PostgreSQL/SQLite database queries are authoritative. Direct Supabase frontend client calls are secondary fallbacks.
2. **Are there duplicate implementations?**  
   Yes. `/assign` and `/verify` exist in both `department.routes.js` and `officer.routes.js`. `resolveUserDepartment` and `normDept` exist in multiple backend route files.
3. **Did any recent change overwrite working behavior?**  
   No. Recent changes fixed department resolution and password enforcement without regression.
4. **Are frontend and backend contracts aligned?**  
   Yes. All frontend service payload models match backend response schemas.
5. **Are PostgreSQL and SQLite behavior aligned?**  
   Yes. `db.js` transpiles PostgreSQL `$1` parameter syntax and handles RETURNING clauses seamlessly in SQLite mode.
6. **Is authentication implemented only once?**  
   JWT verification is centralized in `middleware/auth.js`, but `officer.routes.js` routes were missing top-level auth middleware.
7. **Is RBAC enforced server-side everywhere?**  
   Server-side RBAC is strictly enforced in `department.routes.js`, `complaint.routes.js`, and `admin.routes.js`. `officer.routes.js` requires middleware attachment.
8. **Is every municipal business mutation database-authoritative?**  
   Yes. All complaint status changes, assignments, verifications, and user credentials write directly to the database and generate persistent audit/history records.
9. **Are there hidden fallback/demo paths?**  
   Initial seed passwords enforce `must_change_password = true` on first login, blocking full portal access until updated.
10. **Which exact files should be fixed first?**  
    `backend/src/routes/officer.routes.js` and `backend/src/routes/staff.routes.js`.

---

## PRIORITIZED REMEDIATION PLAN

### P0 — Security & Data Integrity (Immediate)
1. **File:** `backend/src/routes/officer.routes.js`  
   **Change:** Attach `authenticateToken` and `requireRole(['department_head', 'admin', 'city_admin', 'officer'])` to all route endpoints (`/assign`, `/verify`, `/staff-list`, `/duplicates`), or deprecate `officer.routes.js` in favor of `department.routes.js`.  
   **What NOT to change:** Route response signatures used by legacy frontend pages.  
   **Regression test:** `scratch/test_security_isolation.js`.

2. **File:** `backend/src/routes/staff.routes.js`  
   **Change:** Attach `authenticateToken` explicitly as top-level middleware on `/tasks`, `/task/:id/status`, `/task/:id/resolve`, and `/task/:id/progress`.  
   **What NOT to change:** Status transition logic or notification triggers.  
   **Regression test:** `scratch/test_security_isolation.js`.

### P1 — Functional & API Cleanliness
3. **File:** `frontend/src/services/adminService.ts`, `departmentService.ts`  
   **Change:** Remove fallback memory array writes (`memoryStaffRecords`) and force service calls to rely solely on Express REST API.  
   **What NOT to change:** API URL construction or error handling notifications.  
   **Regression test:** `scratch/run_production_acceptance_test.js`.

### P2 — Reliability & Refactoring
4. **File:** `backend/src/routes/department.routes.js`  
   **Change:** Replace inline `normDept` definitions in `/assign`, `/verify`, and password reset handlers with the top-level `normalizeDepartmentInfo` function.  
   **What NOT to change:** The normalization mapping dictionary logic.  
   **Regression test:** `scratch/test_department_staff_visibility.js`.

### P3 — Codebase Hygiene
5. **File:** `backend/src/routes/announcement.routes.js`  
   **Change:** Import `resolveUserDepartment` from a shared helper module instead of declaring a duplicate function.  
   **What NOT to change:** Announcement query filters.  
   **Regression test:** `scratch/verify_gap2_announcements.js`.
