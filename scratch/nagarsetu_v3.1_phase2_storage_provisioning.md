# NAGARSETU 3.1 — PRODUCTION SUPABASE STORAGE PROVISIONING SPECIFICATION

Date: 2026-09-16
Phase: Phase 2 Final P2 Hardening
Status: COMPLETE

==================================================
1. PRODUCTION BUCKET SPECIFICATION
==================================================

- Production Bucket Name: `issues`
- Environment Variable: `SUPABASE_STORAGE_BUCKET` (defaults to `issues` if unset)
- Visibility: **PUBLIC** (`public: true`)
- Purpose: Permanent object storage for civic defect complaint evidence images (`photo_before_url`) and field staff resolution proof images (`photo_after_url`).
- Public Visibility Rationale: NAGARSETU 3.1 displays public civic defect photos on civic tracking maps and public feeds (`GET /api/complaints`). Sensitive citizen metadata (phone numbers, house details) is protected by Express API authentication and RBAC endpoints, while defect photos remain viewable via HTTPS URLs.

==================================================
2. REQUIRED PRODUCTION PRE-PROVISIONING
==================================================

Production deployment requires the `issues` bucket to be pre-provisioned in the Supabase project prior to deployment.

Supabase Dashboard Setup / SQL Setup:
1. Open Supabase Dashboard -> Storage -> Create new bucket.
2. Bucket Name: `issues`
3. Public bucket: **ENABLED** (Public read access)
4. Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
5. Maximum file size: `10 MB` (10485760 bytes)

Alternatively via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('issues', 'issues', true)
ON CONFLICT (id) DO NOTHING;
```

==================================================
3. EXPECTED PRODUCTION BEHAVIOR IF BUCKET IS MISSING
==================================================

- Runtime Bucket Creation: **DISABLED in production** (`process.env.NODE_ENV === 'production'`). Production code does NOT attempt lazy runtime bucket provisioning.
- Failure Mode: If the `issues` bucket does not exist or storage configuration is invalid:
  - Backend logs `[SUPABASE STORAGE ERROR] Production bucket 'issues' is missing. Pre-provisioning required.`
  - Express API returns an honest HTTP 500 error response to the client.
  - Zero local disk (`/uploads`) write fallback occurs in production.
  - Zero in-memory fallback occurs in production.
  - Zero false/incomplete database complaint records are created.

==================================================
4. LEGACY /UPLOADS COMPATIBILITY
==================================================

- Existing legacy local upload paths (`/uploads/...`) remain viewable via safe static file middleware in `backend/src/app.js`.
- Configured with security headers (`X-Content-Type-Options: nosniff`, strict CSP) to prevent script execution.
- New uploads write exclusively to permanent object storage (`issues` bucket).

==================================================
5. SECURITY NOTES
==================================================

- Zero Secret Exposure: `SUPABASE_SERVICE_ROLE_KEY` is strictly server-side and never exposed to frontend code or production build bundles.
- Payload Safety: Upload middleware (`backend/src/middleware/upload.js`) validates binary header magic bytes (`isValidImageMagicBytes`), MIME types, and 10MB file size limits.
- Traversal & Overwrite Protection: Filenames are generated using `crypto.randomUUID()` and timestamp prefixing, rendering object storage immune to path traversal or object overwrite collisions.

==================================================
6. EXACT CODE FILES CHANGED
==================================================

- `backend/src/config/supabaseStorage.js`:
  - Updated `uploadBufferToSupabase` to resolve bucket name to `process.env.SUPABASE_STORAGE_BUCKET || 'issues'`.
  - Enforced explicit pre-provisioned bucket requirement in production (`NODE_ENV === 'production'`), disabling runtime lazy `createBucket()` calls for production environments.
