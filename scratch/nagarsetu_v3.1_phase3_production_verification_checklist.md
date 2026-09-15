# NAGARSETU 3.1 — PRODUCTION SUPABASE BACKUP & RESTORE VERIFICATION CHECKLIST

Date: 2026-09-16
Phase: Phase 3 Blocker Remediation & Operational Package
Target Audience: Authorized Municipal Database Administrator / DevOps Engineer
Status: OPERATIONAL CHECKLIST (REQUIRED FOR PHASE 3 CLOSURE)

==================================================
OPERATIONAL INSTRUCTIONS
==================================================

This checklist provides the exact verification sequence required for an authorized administrator with Supabase Cloud Console credentials to complete the physical backup verification, PITR enablement check, and safe non-production restore drill.

Execute each step below, record the observed values, and capture screenshot/log evidence into the checklist table.

==================================================
VERIFICATION STEPS & EVIDENCE TABLE
==================================================

### STEP 1: Open Production Supabase Project
- Instructions: Log in to `https://app.supabase.com` using authorized municipal infrastructure credentials. Select the production project `nagarsetu3-1`.
- EXPECTED RESULT: Project dashboard loads successfully with active PostgreSQL project status.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Project Reference ID / Dashboard Screenshot
- STATUS: NOT VERIFIED

### STEP 2: Locate Database Backup Settings
- Instructions: Navigate to Project Settings -> Database -> Backups.
- EXPECTED RESULT: Managed Backups & PITR settings pane is accessible.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Backup settings screen reference
- STATUS: NOT VERIFIED

### STEP 3: Verify Automated Daily Backups
- Instructions: Inspect the "Scheduled Backups" section.
- EXPECTED RESULT: Automated daily physical backups are ENABLED.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Backup execution schedule timestamp
- STATUS: NOT VERIFIED

### STEP 4: Verify Backup Retention Period
- Instructions: Check the configured snapshot retention window.
- EXPECTED RESULT: Retention window is >= 7 days (Free/Pro tier) or >= 30 days (Enterprise tier).
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Retention policy display text
- STATUS: NOT VERIFIED

### STEP 5: Verify Point-In-Time Recovery (PITR) Status
- Instructions: Inspect the "Point in Time Recovery" toggle.
- EXPECTED RESULT: PITR is toggled to ENABLED with active Write-Ahead Logging (WAL) stream.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: PITR status toggle screenshot / WAL stream indicator
- STATUS: NOT VERIFIED

### STEP 6: Verify Recovery Window
- Instructions: Inspect the earliest available recovery timestamp.
- EXPECTED RESULT: Continuous recovery window covers the last 7 to 30 days to seconds precision.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Earliest recovery timestamp display
- STATUS: NOT VERIFIED

### STEP 7: Identify Restore / Clone Mechanism
- Instructions: Verify available restore methods (e.g. "Restore to new project", "Download backup", or CLI `pg_dump`).
- EXPECTED RESULT: "Restore to new project" (PITR clone) or logical backup export is available.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Restore UI option list
- STATUS: NOT VERIFIED

### STEP 8: Create Isolated Non-Production Recovery Target
- Instructions: Provision a clean, isolated staging project or test database instance (e.g. `nagarsetu-staging-restore-db`). NEVER restore over the active production instance.
- EXPECTED RESULT: Isolated staging target database is online and reachable.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Staging database connection string
- STATUS: NOT VERIFIED

### STEP 9: Perform Non-Production Restore Drill
- Instructions: Initiate a restore/clone of the production backup or PITR timestamp (e.g. 1 hour prior) into the isolated staging database instance.
- EXPECTED RESULT: Restore completes cleanly without SQL errors or data corruption.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Restore completion log / Console status
- STATUS: NOT VERIFIED

### STEP 10: Record Restore Execution Timestamps
- Instructions: Log start time and completion time of the restore drill.
- EXPECTED RESULT: Restore drill completes within operational target (RTO <= 30 mins).
- ACTUAL RESULT: Start: [HH:MM:SS], End: [HH:MM:SS]
- EVIDENCE: Timestamp diff log
- STATUS: NOT VERIFIED

### STEP 11: Execute Database Integrity Verification Script
- Instructions: Run `node scratch/test_db_integrity_checklist.js` pointing to the restored staging database (`DATABASE_URL="$STAGING_DB_URL"`).
- EXPECTED RESULT: Integrity script reports 100% PASS across all 15 tables with expected counts.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Script console execution log output
- STATUS: NOT VERIFIED

### STEP 12: Validate Representative Business Records
- Instructions: Execute read-only SQL queries on staging database for `users`, `complaints`, `assignments`, and `complaint_status_history`.
- EXPECTED RESULT: Complaint statuses, staff assignments, and user mobile numbers match expected state.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: SQL query output snippet
- STATUS: NOT VERIFIED

### STEP 13: Validate DB ↔ Storage Image References
- Instructions: Inspect 5 random complaint records in staging DB. Verify that `photo_before_url` and `photo_after_url` HTTPS URLs resolve and display valid images from Supabase Storage `issues` bucket.
- EXPECTED RESULT: All 5 image URLs return HTTP 200 and display complaint photos cleanly.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: HTTP status check log
- STATUS: NOT VERIFIED

### STEP 14: Record Measured RPO
- Instructions: Calculate time delta between latest production transaction and restored database state.
- EXPECTED RESULT: Measured RPO meets target requirement (RPO <= 5 mins for PITR / <= 24 hrs for daily).
- ACTUAL RESULT: Measured RPO: [X minutes]
- EVIDENCE: Transaction timestamp comparison log
- STATUS: NOT VERIFIED

### STEP 15: Record Measured RTO
- Instructions: Calculate total elapsed time for restore drill completion & verification.
- EXPECTED RESULT: Measured RTO meets target requirement (RTO <= 30 mins for PITR / <= 2 hrs for logical).
- ACTUAL RESULT: Measured RTO: [Y minutes]
- EVIDENCE: Drill timing log
- STATUS: NOT VERIFIED

### STEP 16: Capture Evidence Package
- Instructions: Bundle all screenshot artifacts, SQL query logs, and script outputs into `scratch/evidence_phase3/`.
- EXPECTED RESULT: Complete evidence package assembled for sign-off audit.
- ACTUAL RESULT: [To be recorded by admin]
- EVIDENCE: Directory listing of evidence files
- STATUS: NOT VERIFIED

### STEP 17: Sign Off Phase 3 Disaster Recovery Verification
- Instructions: Database Administrator and Lead DevOps Engineer sign off on verified RPO, RTO, and restore capability.
- EXPECTED RESULT: Signed approval documented.
- ACTUAL RESULT: Signed by: [Name/Role], Date: [YYYY-MM-DD]
- EVIDENCE: Formal sign-off record
- STATUS: NOT VERIFIED
