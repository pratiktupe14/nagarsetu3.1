# Security, Reliability & Deployment Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical security vulnerabilities (department head login backdoor, hardcoded fallback secrets, universal OTP bypass, unauthenticated complaints endpoint, citizen IDOR PII exposure), fix the PostgreSQL staff parameter query crash, verify tests & build, and deploy the updated service to Vercel.

**Architecture:** 
1. Secure the backend authentication and authorization flow by removing dynamic account insertion on login, enforcing environment-based JWT secrets, gating demo OTPs, and adding access control to complaints routes.
2. Fix parameter index mismatch in staff tasks SQL queries.
3. Validate backend endpoints and verify frontend build.
4. Deploy the fixed backend API using Vercel CLI.

**Tech Stack:** Node.js, Express 4, bcryptjs, jsonwebtoken, PostgreSQL / pg, Vite, TypeScript, Vercel CLI.

**Spec:** [`PROJECT_REVIEW_AND_ANALYSIS.md`](file:///C:/Users/prati/.gemini/antigravity-cli/brain/2721fb1d-1f87-4dcd-82a2-a56a3f63ef5f/PROJECT_REVIEW_AND_ANALYSIS.md)

## Global Constraints

- Never break existing authenticated API contracts (`/api/auth/login`, `/api/complaints`, `/api/staff/tasks`).
- Zero hardcoded production credentials, keys, or passwords.
- No dynamic account provisioning with arbitrary user passwords during login.
- Production builds (`npm run build`) in `frontend` must pass without errors.

## Review Focus

1. `POST /api/auth/login`: Supplying a department head email that is not in `users` must return `401 Invalid login credentials`, NOT dynamically insert an account with the attacker's password.
2. `POST /api/auth/otp-verify`: Non-development requests must not accept `123456` blindly, and `/api/auth/otp-request` must not leak `demoOtp` in production.
3. `GET /api/complaints`: Request without a Bearer token must return `401 Access token required`.
4. `GET /api/complaints/:id`: Citizen A must not receive Citizen B's name or mobile number.
5. `GET /api/staff/tasks`: When `req.user.department_id` is set, the query must match `department_id` against `$4` (not `$3` text staff name).

---

### Task 1: Eliminate Department Head Login Backdoor & Secure Auth Middleware

**Files:**
- Modify: `backend/src/routes/auth.routes.js:50-95`
- Modify: `backend/src/middleware/auth.js:1-25`
- Modify: `backend/src/config/supabaseStorage.js:1-20`
- Test: `backend/tests/auth_security.test.js`

**Interfaces:**
- Consumes: `query` from `backend/src/config/db`, `bcrypt`
- Produces: Hardened `authenticateToken`, `requireRole`, and login route

- [ ] **Step 1: Write test reproducing the backdoor and token fallbacks**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Remove dynamic user creation in `backend/src/routes/auth.routes.js` and eliminate hardcoded secrets in `auth.js` and `supabaseStorage.js`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit changes**

---

### Task 2: Gate OTP Bypass & Protect Complaint Endpoints (Auth & IDOR Fix)

**Files:**
- Modify: `backend/src/routes/auth.routes.js:165-200`
- Modify: `backend/src/routes/complaint.routes.js:190-270`
- Test: `backend/tests/complaint_security.test.js`

**Interfaces:**
- Consumes: `authenticateToken` middleware
- Produces: Protected `GET /api/complaints` and scoped `GET /api/complaints/:id`

- [ ] **Step 1: Write test for unauthenticated access on `/api/complaints` and OTP bypass**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Apply `authenticateToken` to `GET /api/complaints` and add role/ownership checks to `GET /api/complaints/:id`**
- [ ] **Step 4: Restrict OTP `123456` to development mode only and remove `demoOtp` from production response**
- [ ] **Step 5: Run tests to verify they pass**
- [ ] **Step 6: Commit changes**

---

### Task 3: Fix Staff Tasks SQL Parameter Crash & Deprecate Unused Shims

**Files:**
- Modify: `backend/src/routes/staff.routes.js:20-40`
- Delete / Clean: `frontend/src/context/AuthContext.jsx`, `frontend/src/context/LanguageContext.jsx`, `frontend/src/utils/i18n.js`
- Test: `backend/tests/staff_query.test.js`

**Interfaces:**
- Consumes: `query` from `backend/src/config/db`
- Produces: Error-free `/api/staff/tasks` query execution under PostgreSQL

- [ ] **Step 1: Write test executing staff tasks query with `department_id`**
- [ ] **Step 2: Run test to confirm parameter index error**
- [ ] **Step 3: Fix parameter index to `$4` in `backend/src/routes/staff.routes.js`**
- [ ] **Step 4: Remove redundant `.jsx` / `.js` re-export shims and verify frontend build**
- [ ] **Step 5: Commit changes**

---

### Task 4: End-to-End Verification & Production Deployment to Vercel

**Files:**
- Working directory: `backend`

**Interfaces:**
- Consumes: Vercel CLI (`vercel --prod`)

- [ ] **Step 1: Run complete backend test suite**
- [ ] **Step 2: Run frontend production build check (`npm run build` in `frontend`)**
- [ ] **Step 3: Deploy backend to Vercel (`vercel deploy --prod`)**
- [ ] **Step 4: Verify live `/api/health` on deployed URL**
- [ ] **Step 5: Commit final deployment record**
