# NAGARSETU 3.1 — PRODUCTION INCIDENT RUNBOOK

Date: 2026-09-17
Phase: Phase 4 (Monitoring, Error Observability & Production Health)
Status: OPERATIONAL INCIDENT RESPONSE RUNBOOK

==================================================
OPERATIONAL WORKFLOW PATTERN
==================================================

For all production incidents, engineers must follow:
**DETECT → IDENTIFY → INVESTIGATE → MITIGATE → VERIFY → DOCUMENT**

==================================================
INCIDENT SCENARIOS & SPECIFIC PROCEDURES
==================================================

### 1. API OUTAGE (HTTP 5xx across all routes)
- **DETECT**: Monitor alert / endpoint health check `GET /api/health` returns 503 or fails to respond.
- **IDENTIFY**: Check Vercel deployment status & server process logs. Look for `FATAL_UNCAUGHT_EXCEPTION` or `DATABASE_INIT_FATAL_ERROR`.
- **INVESTIGATE**: Extract `requestId` from failed responses. Inspect database connectivity.
- **MITIGATE**: Redeploy last known stable production build via Vercel / server restart.
- **VERIFY**: Query `GET /api/health` and `GET /api/health/ready` -> Confirm status `ok` and `ready`.
- **DOCUMENT**: Record incident timeline, root cause, and remediation steps in post-mortem audit.

### 2. DATABASE OUTAGE / CONNECTION FAILURE
- **DETECT**: `GET /api/health/ready` returns 503 `not_ready` with `status: database_error`.
- **IDENTIFY**: Server logs show `DATABASE_CONNECTION_ERROR` or `DATABASE_QUERY_ERROR`.
- **INVESTIGATE**: Check Supabase Cloud Dashboard -> Project Status -> Database instance state. Verify `DATABASE_URL` connectivity.
- **MITIGATE**: If Supabase connection pool is exhausted, recycle Vercel serverless connections or restart database poolers.
- **VERIFY**: Run `node scratch/test_db_integrity_checklist.js` and check `GET /api/health/ready`.
- **DOCUMENT**: Log outage duration and connection pool metrics.

### 3. STORAGE OUTAGE (Photo upload failure)
- **DETECT**: Complaint photo submission returns HTTP 500 `Storage Error`.
- **IDENTIFY**: Server logs show `STORAGE_UPLOAD_FAILED` or `STORAGE_BUCKET_ERROR`.
- **INVESTIGATE**: Inspect Supabase Storage bucket `issues` status and service-role key access.
- **MITIGATE**: Verify Supabase Storage bucket `issues` permissions. Ensure fallback photo handling functions cleanly for text complaints.
- **VERIFY**: Test single image upload endpoint `POST /api/ai/analyze` with test image.
- **DOCUMENT**: Log storage failure event and bucket policy status.

### 4. AI / GEMINI SERVICE OUTAGE
- **DETECT**: AI vision categorization returns default fallback category (`Road Damage / Pothole`).
- **IDENTIFY**: Server logs show `AI_SERVICE_FALLBACK` or `AI_QUOTA_EXCEEDED` / `AI_MODEL_NOT_FOUND`.
- **INVESTIGATE**: Run health check `GET /api/ai/health`. Check Gemini API key quota and Google AI Studio status.
- **MITIGATE**: System automatically falls back to local vision engine with `needs_manual_verification: true`. No citizen workflow interruption.
- **VERIFY**: Submit test complaint to confirm manual department assignment flow operates cleanly.
- **DOCUMENT**: Log Gemini quota error event.

### 5. AUTHENTICATION / AUTHORIZATION OUTAGE
- **DETECT**: High rate of HTTP 401 `Authentication required` or HTTP 403 `Access forbidden` across legitimate portals.
- **IDENTIFY**: Server logs show `AUTH_TOKEN_INVALID`, `AUTH_FORBIDDEN`, or `RBAC_DENIED`.
- **INVESTIGATE**: Inspect `JWT_SECRET` environment variable setting across backend environments.
- **MITIGATE**: Re-align `JWT_SECRET` in Vercel environment variables if secret mismatch exists across serverless functions.
- **VERIFY**: Execute `node scratch/test_credential_management.js` and `node scratch/test_p0_route_security.js`.
- **DOCUMENT**: Record authentication key verification results.

### 6. HIGH ERROR RATE (Spike in HTTP 4xx / 5xx)
- **DETECT**: Log metrics show `clientErrors` or `serverErrors` exceeding 5% of total requests.
- **IDENTIFY**: Inspect structured error log events `APPLICATION_ERROR` grouped by `url` and `classification`.
- **INVESTIGATE**: Check for malformed API payloads or expired client tokens.
- **MITIGATE**: Apply rate limiting or fix client request payload handling.
- **VERIFY**: Run production acceptance test matrix `node scratch/run_production_acceptance_test.js`.
- **DOCUMENT**: Log error rate trend and resolution.

### 7. SLOW API RESPONSES (Request latency > 1000ms)
- **DETECT**: Server logs emit `HTTP_REQUEST_SLOW` with `durationMs > 1000`.
- **IDENTIFY**: Group slow requests by `route` and `method`.
- **INVESTIGATE**: Inspect un-indexed database queries or slow external API calls.
- **MITIGATE**: Add database indexes or optimize SQL query joins.
- **VERIFY**: Measure response time on `GET /api/complaints` and `GET /api/officer/complaints`.
- **DOCUMENT**: Record latency before and after optimization.

### 8. DEPLOYMENT REGRESSION
- **DETECT**: Test failures or broken routes immediately following a deployment.
- **IDENTIFY**: Compare Vercel deployment commit SHA with working baseline.
- **INVESTIGATE**: Run local regression suite `node scratch/run_production_acceptance_test.js`.
- **MITIGATE**: Instantly rollback Vercel deployment to previous production release.
- **VERIFY**: Confirm 59/59 acceptance test matrix passes 100%.
- **DOCUMENT**: Record deployment regression post-mortem.

### 9. REPEATED 5XX RESPONSES ON SPECIFIC ROUTE
- **DETECT**: Server logs report `HTTP_REQUEST_SERVER_ERROR` concentrated on a single API endpoint.
- **IDENTIFY**: Extract error stack trace and `requestId` from server log.
- **INVESTIGATE**: Trace controller function and database query execution for that route.
- **MITIGATE**: Deploy targeted bugfix for the specific endpoint.
- **VERIFY**: Execute specific route test script.
- **DOCUMENT**: Log root cause and fix details.

### 10. UNEXPECTED PROCESS CRASHES
- **DETECT**: Server process exits unexpectedly or serverless function time outs.
- **IDENTIFY**: Inspect server logs for `FATAL_UNCAUGHT_EXCEPTION` or `FATAL_UNHANDLED_REJECTION`.
- **INVESTIGATE**: Identify unhandled async error or memory leak.
- **MITIGATE**: Wrap unhandled promise or file operation in `asyncHandler` / `try-catch`.
- **VERIFY**: Run `npm run build` and start process cleanly.
- **DOCUMENT**: Record process crash fix in audit log.
