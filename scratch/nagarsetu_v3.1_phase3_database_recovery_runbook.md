# NAGARSETU 3.1 — DATABASE DISASTER RECOVERY RUNBOOK

Date: 2026-09-16
Phase: Phase 3 (Database Backup / Restore / Disaster Recovery)
Document Version: 2.1.0

==================================================
1. CLASSIFICATION SYSTEM
==================================================

This runbook categorizes disaster recovery components into three explicit buckets:
- **[VERIFIED CONFIGURATION]**: Directly observed and tested in this codebase environment.
- **[RECOMMENDED CONFIGURATION]**: Target operational objectives based on architecture design.
- **[REQUIRED EXTERNAL ACTION]**: Managed cloud infrastructure settings requiring Supabase Cloud Console admin login.

==================================================
2. PRODUCTION DATABASE IDENTIFICATION
==================================================

- **[VERIFIED]** Production Database: Managed Supabase PostgreSQL Database Instance
- **[VERIFIED]** Connection Architecture: `DATABASE_URL` / `POSTGRES_URL` (Server-side SSL enabled via `pg.Pool` in `backend/src/config/db.js`)
- **[VERIFIED]** Authoritative Data Owner: Express Backend API (`backend/src/config/db.js`)
- **[VERIFIED]** Client Data Storage: Strictly prohibited from hosting authoritative business state in browser memory, `localStorage`, or `sessionStorage`.

==================================================
3. BACKUP SOURCES & ARCHITECTURE
==================================================

1. **[REQUIRED EXTERNAL ACTION]** Managed Supabase Daily Backups: Automated physical backups executed by Supabase infrastructure.
2. **[REQUIRED EXTERNAL ACTION]** Supabase Point-in-Time Recovery (PITR): WAL (Write-Ahead Logging) continuous archiving.
3. **[VERIFIED]** Logical CLI Backups (`pg_dump`): Operator-initiated or scheduled logical snapshots of database schema and data into compressed `.sql.gz` / `.dump` formats.

==================================================
4. BACKUP FREQUENCY & RETENTION
==================================================

- **[REQUIRED EXTERNAL ACTION]** Managed Automated Backups: Daily at 02:00 UTC (Default)
- **[REQUIRED EXTERNAL ACTION]** PITR Log Archiving: Continuous (every 2 seconds)
- **[REQUIRED EXTERNAL ACTION]** Automated Retention Window: 7 days (Free/Pro tier) / 30 days (Enterprise tier)
- **[RECOMMENDED]** Logical Snapshot Retention: 90 days in off-site encrypted storage
- **[RECOMMENDED]** Restore Verification Frequency: Bi-weekly simulated restore testing

==================================================
5. INCIDENT RESPONSE & DISASTER WORKFLOW
==================================================

Step 1: Incident Identification & Severity Declaration
- Declare DR Incident when production database corruption, accidental table deletion, hardware loss, or cloud region outage occurs.
- Halt write traffic by enabling maintenance mode or recycling backend serverless connections if active corruption is spreading.

Step 2: Backup Selection & PITR Timestamp Determination
- For data corruption or accidental row deletion: Select PITR (Point-in-Time Recovery) to restore to the exact second prior to the incident ($T - 1\text{ min}$).
- For complete infrastructure loss or provider outage: Select latest automated daily backup snapshot or offline `.dump` file.

Step 3: Restore Target Selection
- WARNING: NEVER restore directly over the active production database instance.
- Target MUST be an isolated non-production project instance (e.g., `nagarsetu-staging-recovery` or `nagarsetu-dr-test`).

==================================================
6. POINT-IN-TIME RECOVERY (PITR) PROCEDURE
==================================================

**[REQUIRED EXTERNAL ACTION]** PITR permits restoring the PostgreSQL database to any specific second within the retention window.

Recovery Steps via Supabase Management Interface:
1. Access Supabase Dashboard (`https://app.supabase.com`) -> Select Project `nagarsetu3-1` -> Database -> Backups -> Point in Time Recovery.
2. Select target recovery timestamp (UTC).
3. Clone project database to a new restoration target instance (e.g. `nagarsetu-restored-db`).
4. Perform post-restore data integrity validation using `node scratch/test_db_integrity_checklist.js`.
5. Update Vercel / Express backend environment variable `DATABASE_URL` to point to the validated restored database host.

==================================================
7. MANUAL LOGICAL BACKUP PROCEDURE (OPERATOR RUNBOOK)
==================================================

**[VERIFIED OPERATOR PROCEDURE]** Prerequisites: `pg_dump` utility installed on secure operator host.

Step 1: Export production database schema and data (server-side environment):
```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --blobs \
  --no-owner \
  --no-privileges \
  --file="nagarsetu_backup_$(date +%Y%m%d_%H%M%S).dump"
```

Step 2: Compress backup artifact:
```bash
gzip -9 "nagarsetu_backup_$(date +%Y%m%d_%H%M%S).dump"
```

Step 3: Transfer to encrypted off-site storage (AWS S3 / GCS bucket with object lock enabled).

==================================================
8. RESTORE PROCEDURE (ISOLATED STAGING ENVIRONMENT)
==================================================

**[VERIFIED OPERATOR PROCEDURE]** WARNING: NEVER run restore commands directly against the active production database instance without an explicit maintenance window and pre-restore snapshot.

Step 1: Provision clean target PostgreSQL database instance (`nagarsetu-staging-recovery`).

Step 2: Restore schema and data using `pg_restore`:
```bash
pg_restore \
  --dbname="$STAGING_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  "nagarsetu_backup_20260916_000000.dump"
```

Step 3: Verify schema DDL integrity by initializing application schema migrations:
```bash
NODE_ENV=staging DATABASE_URL="$STAGING_DATABASE_URL" node backend/src/config/db.js
```

==================================================
9. POST-RESTORE INTEGRITY VALIDATION & APPLICATION RECONNECTION
==================================================

Step 1: Run read-only automated database integrity script against target:
```bash
DATABASE_URL="$STAGING_DATABASE_URL" node scratch/test_db_integrity_checklist.js
```
- Validates table row counts across all schema tables.
- Validates mandatory non-null fields (`users.mobile`).
- Validates departmental staff population consistency.

Step 2: Storage Reference Alignment Validation:
- Verify that restored `complaints.photo_before_url` and `complaints.photo_after_url` resolve cleanly to Supabase Storage bucket `issues`.

Step 3: Production Cutover & Connection Reconnection:
- Update `DATABASE_URL` in Vercel environment variables to point to the validated target database.
- Redeploy Vercel backend to recycle connection pools.

Step 4: Rollback Strategy:
- If restored database exhibits unexpected application defects during smoke testing, revert Vercel `DATABASE_URL` back to the pre-cutover database connection string.

==================================================
10. OBJECT STORAGE DEPENDENCY & CONSISTENCY
==================================================

- **[VERIFIED]** Database records (`complaints.photo_before_url`, `complaints.photo_after_url`) store permanent HTTPS object URLs pointing to Supabase Storage bucket `issues`.
- Storage Object Recovery Interaction:
  - If DB is restored to a prior timestamp, newly uploaded Storage objects uploaded since that timestamp remain intact in `issues` bucket.
  - If Storage bucket is restored, public object URLs remain stable because file paths use timestamped UUIDs (`uploads/{timestamp}_{uuid}.jpg`).
  - Coordinated Recovery Rule: When restoring database, perform object inventory check to ensure all `photo_before_url` and `photo_after_url` HTTPS links resolve cleanly.

==================================================
11. RECOVERY OBJECTIVES (RPO / RTO)
==================================================

- **[RECOMMENDED TARGET] Recovery Point Objective (RPO)**:
  - With PITR (WAL enabled): **RPO <= 5 minutes** (maximum data loss window).
  - With Daily Snapshots: **RPO <= 24 hours**.
- **[RECOMMENDED TARGET] Recovery Time Objective (RTO)**:
  - PITR Project Clone: **RTO <= 30 minutes** (time to switch connection string).
  - Logical Restore (`pg_restore`): **RTO <= 2 hours**.
- **[UNMEASURED IN PRODUCTION] Measured RPO / RTO**: Requires execution of `scratch/nagarsetu_v3.1_phase3_production_verification_checklist.md`.

==================================================
12. OPERATIONAL OWNER & SIGN-OFF
==================================================

- Operational Owner: Municipal Database Administrator / Lead DevOps Engineer
- **[REQUIRED EXTERNAL ACTION]** Complete operational verification and sign off in `scratch/nagarsetu_v3.1_phase3_production_verification_checklist.md`.
