# NAGARSETU 3.1 — LOGGING & PRIVACY POLICY DIRECTIVE

Date: 2026-09-17
Phase: Phase 4 (Monitoring, Error Observability & Production Health)
Status: ACTIVE OPERATIONAL POLICY

==================================================
1. PURPOSE & SCOPE
==================================================

This directive establishes mandatory production logging, sensitive data redaction, privacy controls, and audit guidelines for the NAGARSETU 3.1 civic issue reporting platform.

The goal is to ensure production system errors, security events, and performance latency are fully observable and diagnosable without exposing sensitive citizen data, employee credentials, or infrastructure secrets.

==================================================
2. LOGGED VS. NEVER-LOGGED DATA MATRIX
==================================================

### A. LOGGED DATA (APPROVED OBSERVABILITY CONTEXT)
- **Request Metadata**: `timestamp`, `requestId`, `method`, `route`, `status`, `durationMs`.
- **User Context**: `userId`, `role`, `department_id` (NO PII, NO mobile numbers in log context).
- **Error Context**: Error classification (`CLIENT_ERROR`, `AUTH_ERROR`, `RBAC_DENIED`, `DATABASE_ERROR`, `STORAGE_ERROR`, `AI_ERROR`), error message, status code.
- **Service Events**: Database connection status, Storage upload events, AI model fallback indicators.

### B. NEVER-LOGGED DATA (STRICTLY PROHIBITED)
- **Authentication Secrets**: Passwords, bcrypt hashes, OTPs, JWT tokens, `Authorization` headers.
- **Infrastructure Credentials**: `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`.
- **Citizen Personal Data**: Full names, mobile numbers, precise home addresses, personal email addresses.
- **Full Payloads**: Full request bodies for sensitive endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/change-password`).

==================================================
3. SENSITIVE DATA REDACTION MECHANISM
==================================================

All structured server logs pass through automated recursive sanitization (`backend/src/utils/logger.js`).

Keys automatically redacted to `[REDACTED]`:
`password`, `password_hash`, `pass`, `pwd`, `otp`, `token`, `jwt`, `authorization`, `bearer`, `secret`, `jwt_secret`, `service_role`, `service_role_key`, `database_url`, `postgres_url`, `supabase_db_url`, `gemini_api_key`, `api_key`, `cookie`, `session`.

==================================================
4. RECOMMENDED LOG RETENTION & ACCESS CONTROL
==================================================

- **Production Log Retention**: 30 days in production log management platform (e.g., Vercel Logs / CloudWatch / Datadog).
- **Security Incident Log Retention**: 90 days for audit records (`audit_logs` table).
- **Access Control**: Production log inspection restricted to authorized Municipal DevOps Engineers and Lead System Administrators.
- **Log Source of Truth**: Logs are diagnostic platform artifacts ONLY. Business state remains 100% authoritative in Supabase PostgreSQL.

==================================================
5. INCIDENT INVESTIGATION PROCEDURE
==================================================

1. Obtain `requestId` from user error report or alert log.
2. Filter server logs using `requestId` in platform log management dashboard.
3. Trace full request lifecycle: `HTTP_REQUEST_COMPLETE`, `APPLICATION_ERROR`, or `DATABASE_QUERY_ERROR`.
4. Identify root cause without exposing or handling user credentials.
