# NAGARSETU 3.1 — Phase 5 Authentication Incident Runbook

This document details standard operational procedures (SOP) for handling security incidents affecting NAGARSETU 3.1 authentication services.

---

## Incident Scenarios & Response Procedures

### 1. Suspected Credential Compromise
- **DETECT**: Alert or log event showing multiple successful logins from disparate IP addresses or abnormal user activity.
- **VERIFY**: Check user activity logs and request correlation IDs in server logs.
- **CONTAIN**: Temporarily deactivate user account (`UPDATE users SET status = 'inactive' WHERE id = ?`).
- **ROTATE/INVALIDATE**: Reset user password hash to random value and clear active session.
- **VERIFY**: Confirm old credentials reject with HTTP 401.
- **DOCUMENT**: Log incident ID, affected user ID, and resolution timestamp in incident log.

---

### 2. Repeated Login Attacks (Brute-Force Attack)
- **DETECT**: `HTTP 429` rate limit triggers or `AUTH_RATE_LIMITED` log events.
- **VERIFY**: Verify source IP address and target account identifier in `authRateLimiter` map.
- **CONTAIN**: IP and account backoff automatically enforced by `authRateLimiter` middleware.
- **ROTATE/INVALIDATE**: No key rotation required unless compromised.
- **VERIFY**: Confirm HTTP 429 response and `Retry-After` header sent to client.
- **DOCUMENT**: Record attack vector, source IP subnet, and duration.

---

### 3. OTP Abuse (Replay / Flooding)
- **DETECT**: High rate of `/api/auth/otp-request` calls or invalid code attempts.
- **VERIFY**: Inspect `otpStore` metrics or route log counts.
- **CONTAIN**: Per-mobile cooldown (15s minimum) and max attempt limit (5 attempts) automatically block abuse.
- **ROTATE/INVALIDATE**: Invalidate active OTP code for target mobile (`otpStore.delete(mobile)`).
- **VERIFY**: Verify subsequent verification attempt fails with HTTP 400.
- **DOCUMENT**: Document mobile number range and rate limit logs.

---

### 4. JWT Secret Compromise
- **DETECT**: Unscheduled token generation or forged claims detected.
- **VERIFY**: Verify signature validity across production API servers.
- **CONTAIN**: Revoke active secret across environment configurations.
- **ROTATE/INVALIDATE**: Set new `JWT_SECRET` in environment variables and restart API servers.
- **VERIFY**: Confirm all legacy tokens return HTTP 401 `Invalid or expired token`.
- **DOCUMENT**: Perform root-cause analysis on secret leak source.

---

### 5. Unauthorized Role Escalation Attempt
- **DETECT**: HTTP 403 `Forbidden: Access denied for user role` in logs.
- **VERIFY**: Inspect token payload vs DB user role for discrepancies.
- **CONTAIN**: Server-side RBAC middleware (`requireRole`) automatically blocks unauthorized API execution.
- **ROTATE/INVALIDATE**: Revoke session token if client attempted token tampering.
- **VERIFY**: Re-test route with low-privilege token.
- **DOCUMENT**: Record user ID and attempted path.

---

### 6. Unauthorized Department Access Attempt
- **DETECT**: HTTP 403 `Forbidden: You cannot assign complaints outside your department` or cross-department access denied.
- **VERIFY**: Audit department assignment in `department_heads` or `field_staff` DB table.
- **CONTAIN**: Backend middleware enforces server-derived department isolation.
- **ROTATE/INVALIDATE**: No credential change required unless account hijacked.
- **VERIFY**: Verify cross-department query returns empty or HTTP 403.
- **DOCUMENT**: Record actor ID, target department, and resource ID.

---

### 7. Password Reset Abuse
- **DETECT**: Repeated requests to staff reset endpoint `/api/department/staff/:id/change-password`.
- **VERIFY**: Check Department Head identity and staff department membership in DB.
- **CONTAIN**: Cross-department resets blocked with HTTP 403.
- **ROTATE/INVALIDATE**: Reset compromised staff temporary credentials.
- **VERIFY**: Verify staff `must_change_password` flag is set.
- **DOCUMENT**: Record DH user ID, staff ID, and outcome.

---

### 8. Staff Credential Compromise
- **DETECT**: Unauthorized status changes or resolution submissions by staff account.
- **VERIFY**: Inspect `audit_logs` and complaint history table.
- **CONTAIN**: Department Head or Admin resets staff password (`must_change_password = 1`).
- **ROTATE/INVALIDATE**: Issue new temporary credentials.
- **VERIFY**: Verify old staff token is rejected or forced to change password.
- **DOCUMENT**: Log complaint ID and revoked actions.

---

### 9. Suspicious Admin Login
- **DETECT**: Login event for `city_admin` from unfamiliar location/IP.
- **VERIFY**: Confirm with municipal IT administrator.
- **CONTAIN**: Admin account deactivated immediately if unauthorized.
- **ROTATE/INVALIDATE**: Force admin credential rotation and secret key audit.
- **VERIFY**: Verify admin login requires new credential.
- **DOCUMENT**: Escalate to Chief Information Security Officer (CISO).

---

### 10. Emergency Credential Rotation Procedures
- **DETECT**: Widespread security advisory or breach declaration.
- **VERIFY**: Assess scope of compromised credentials.
- **CONTAIN**: Set system flag `FORCE_PASSWORD_RESET=true` in server environment if global reset required.
- **ROTATE/INVALIDATE**: Rotate `JWT_SECRET`, database passwords, and service keys.
- **VERIFY**: Re-run complete baseline test suite (`node scratch/run_production_acceptance_test.js`).
- **DOCUMENT**: Publish incident post-mortem report.
