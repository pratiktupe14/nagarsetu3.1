# NAGARSETU 3.1 — SYSTEM ARCHITECTURE & BASELINE DOCUMENTATION

## 1. OVERVIEW & CURRENT ARCHITECTURE
NAGARSETU 3.1 is an AI-powered municipal civic issue reporting and resolution platform.
- **Backend Architecture**: Express.js REST API server (`backend/src/app.js` and `backend/src/routes/`) utilizing CommonJS modules, PostgreSQL/SQLite parameter-mapped hybrid database query abstraction (`backend/src/config/db.js`), and centralized middleware (`auth.js`, `validateInput.js`, `rateLimiter.js`).
- **Frontend Architecture**: React 18 / Vite / TypeScript Single Page Application (`frontend/src/`) organized into role-based views (`citizen`, `departmentHead`, `staff`, `admin`), contextual state providers (`AuthContext.tsx`, `LanguageContext.tsx`), and Leaflet mapping components.
- **AI Service Architecture**: Independent Python service (`ai_service/main.py`) executing Google Gemini 3.6 Vision multimodal image analysis for automated category, issue, urgency, and severity classification.

---

## 2. TARGET ARCHITECTURE: MODULAR MONOLITH
The target architecture is a **Modular Monolith** with:
- **Domain Modules**: `backend/src/modules/{auth, complaints, departments, staff, admin, notifications, announcements, maps, ai}` containing domain-isolated `routes`, `controllers`, `services`, `repositories`, and `schemas`.
- **Feature-Based Frontend**: `frontend/src/features/` (business functionality) and `frontend/src/portals/` (role views).
- **Dedicated Security Boundary**: `backend/src/security/` containing canonical department resolvers, permission services, and security auditing logs.

---

## 3. CURRENT-TO-TARGET MAPPING

| Domain / Layer | Current File Location | Target Modular Location | Migration Strategy |
| :--- | :--- | :--- | :--- |
| **Auth** | `backend/src/routes/auth.routes.js` | `backend/src/modules/auth/` | Extract controller/service iteratively |
| **Complaints** | `backend/src/routes/complaint.routes.js` | `backend/src/modules/complaints/` | Extract controller, service & repository |
| **Departments** | `backend/src/routes/department.routes.js` | `backend/src/modules/departments/` | Extract controller, service & repository |
| **Field Staff** | `backend/src/routes/staff.routes.js` | `backend/src/modules/staff/` | Extract controller, service & repository |
| **Security Layer** | `backend/src/utils/departmentUtils.js` | `backend/src/security/` | Expand `departmentResolver.js` & `accessPolicy.js` |

---

## 4. PROTECTED FILES (DO NOT OVERWRITE OR DELETE)
- `backend/src/config/db.js` (Hybrid DB Parameterization Abstraction)
- `backend/src/utils/departmentUtils.js` (Canonical Department Resolver)
- `backend/src/middleware/auth.js` (JWT Authentication & Role Check)
- `tests/test_issue001_department_crud.js`
- `tests/test_issue002_department_head_mobile.js`
- `tests/test_issue003_public_pii.js`
- `tests/test_issue004_status_idor.js`
- `tests/test_issue010_complaint_access.js`

---

## 5. INCREMENTAL MIGRATION ORDER
1. **Iteration 001**: Baseline Architecture & Documentation Foundation (`docs/architecture/`, `docs/tasks/`).
2. **Iteration 002**: Security Boundary Consolidation (`backend/src/security/departmentResolver.js`).
3. **Iteration 003**: Complaint Domain Layering (`backend/src/modules/complaints/`).
4. **Iteration 004**: Department & Staff Domain Layering (`backend/src/modules/departments/`, `backend/src/modules/staff/`).
5. **Iteration 005**: Auth & Admin Domain Layering (`backend/src/modules/auth/`, `backend/src/modules/admin/`).
6. **Iteration 006**: Frontend Portal & Feature Boundary Alignment (`frontend/src/features/`, `frontend/src/portals/`).

---

## 6. ROLLBACK STRATEGY
- **Atomic Iterations**: Each iteration modifies only a single bounded domain module.
- **Zero Breaking Contract Changes**: All REST endpoint paths, request bodies, and response structures remain strictly backward-compatible.
- **Verification Gate**: Any failing test, type error (`tsc`), or build error (`vite build`) triggers immediate rollback of the iteration before progressing.
