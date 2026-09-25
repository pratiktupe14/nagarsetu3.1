# NAGARSETU 3.1 — DATABASE DESIGN & SCHEMA ARCHITECTURE

## 1. DATABASE PARADIGM
- **Production Engine**: PostgreSQL (Target deployment with relational schema & PostGIS GIS support)
- **Development Engine**: SQLite3 (Local file-backed development driver at `backend/nagarsetu.sqlite`)
- **Abstraction Utility**: `backend/src/config/db.js` providing parameter translation (`$1, $2` to `?, ?`) and unified `query(sql, params)` interface.

---

## 2. CORE SCHEMAS & RELATIONSHIPS

### A. USERS & PROFILES
- `users`: Primary identity store (`id`, `name`, `email`, `mobile`, `password`, `role`, `department_id`, `employee_id`, `created_at`).
- `profiles`: Citizen profile store (`id`, `full_name`, `mobile`, `email`, `role`, `language_pref`, `status`).

### B. DEPARTMENTS & STAFF
- `departments`: Municipal departments (`id`, `name`, `code`, `description`, `created_at`). Canonical codes: `PWD`, `SAN`, `WTR`, `DRN`, `ELE`, `TRF`, `MNT`.
- `department_heads`: Department head allocations (`id`, `user_id`, `department_id`, `email`, `employee_id`, `status`).
- `field_staff`: Service staff assignments (`id`, `user_id`, `department_id`, `email`, `employee_id`, `status`).

### C. COMPLAINTS & LIFECYCLE
- `complaints`: Master issue registry (`id`, `complaint_number`, `citizen_id`, `department_id`, `category`, `title`, `description`, `priority`, `status`, `latitude`, `longitude`, `location_address`, `photo_before_url`, `photo_after_url`, `ai_category`, `ai_confidence`, `ai_severity`, `ai_urgency`, `sla_deadline`, `support_count`, `created_at`).
- `assignments`: Task allocations (`id`, `complaint_id`, `staff_id`, `assigned_by`, `assigned_at`, `resolved_at`).
- `complaint_status_history`: Auditable timeline log (`id`, `complaint_id`, `status`, `remark`, `department`, `updated_by`, `created_at`).
- `feedback`: Citizen satisfaction ratings (`id`, `complaint_id`, `rating`, `comment`, `created_at`).

---

## 3. CANONICAL DEPARTMENT RESOLUTION DATA FLOW
1. Input string or numeric ID received.
2. Direct lookup in `departments` table by `id`, `code`, or `name`.
3. Fallback lookup in `department_heads`, `field_staff`, or `users` table.
4. Returns canonical `{ id: String(d.id), code: String(d.code).toUpperCase() }`.
5. Returns `null` if unresolvable (**Fail Closed**).
