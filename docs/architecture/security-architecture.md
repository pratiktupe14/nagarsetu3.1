# NAGARSETU 3.1 — SECURITY ARCHITECTURE & THREAT MODEL

## 1. AUTHENTICATION & AUTHORIZATION PIPELINE
Every security-sensitive operation enforces the following order:

```
[HTTP REQUEST]
    │
    ▼
[1. AUTHENTICATION] (middleware/auth.js -> authenticateToken)
    │  Verifies Bearer JWT signature, expiration, and extracts req.user
    ▼
[2. ROLE AUTHORIZATION] (middleware/auth.js -> requireRole(['admin', 'department_head', ...]))
    │  Verifies user role matches endpoint access policy
    ▼
[3. DEPARTMENT AUTHORIZATION] (utils/departmentUtils.js -> isDeptMatch)
    │  Verifies req.user department matches target resource department via database canonical resolver
    ▼
[4. RESOURCE OWNERSHIP / ASSIGNMENT]
    │  Verifies citizen ownership (citizen_id) or field staff task assignment
    ▼
[5. BUSINESS LOGIC & STATE MUTATION]
```

---

## 2. KEY SECURITY CONTROLS

### A. Fail-Closed Canonical Department Resolver
- `isDeptMatch(deptA, deptB)` resolves both parameters to canonical `{ id, code }` objects against the database.
- If either input is unresolvable or null, it returns `false`, causing the endpoint to deny access with `HTTP 403 Forbidden`.

### B. IDOR Protection (Issue-004 & Issue-010)
- `PATCH /api/complaints/:id/status`: Department Heads can ONLY update status/priority for complaints within their own canonical department. Field staff & citizens are blocked (`HTTP 403`).
- `GET /api/complaints/:id`: Citizens can ONLY view their own complaints. Department Heads & Field Staff can ONLY view complaints within their department or assigned tasks.

### C. Public Feed PII Sanitization (Issue-003)
- `GET /api/complaints`: Unauthenticated public visitors receive sanitized complaint records with personal identifiers (`citizen_name`, `citizen_phone`, `citizen_email`, `citizen_mobile`, exact GPS coordinates, staff phone/email) stripped.

### D. Parameterized Database Queries
- 100% of database queries execute via parameterized placeholders `$1, $2` (or `?` in local SQLite translation) to prevent SQL injection.
