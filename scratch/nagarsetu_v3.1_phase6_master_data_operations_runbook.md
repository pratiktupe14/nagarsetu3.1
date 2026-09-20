# NAGARSETU 3.1 — Phase 6 Master Data Operations Runbook

## Executive Summary
This runbook describes operational procedures for managing municipal master data in NAGARSETU 3.1 safely and securely without risking data corruption, orphaned records, or authorization bypasses.

---

## 1. Managing Departments

### Adding a New Department
1. Execute `POST /api/department` (Requires `admin` or `city_admin` role).
2. Payload:
   ```json
   {
     "name": "New Department Name",
     "code": "NDP",
     "description": "Department Scope Description"
   }
   ```
3. Backend auto-validates unique department codes and names before insertion into the database.

### Deactivating a Department (Historical Protection)
1. Do NOT execute `DELETE FROM departments` directly if historical complaints or staff reference the department.
2. If active complaints exist, reassign active complaints first via `POST /api/department/assign`.
3. Soft deactivation sets `is_active = false` on the target department record to preserve historical complaints and audit trail.

---

## 2. Managing Service Staff & Department Assignment

### Adding New Field Staff
1. Execute `POST /api/department/staff` (Requires `department_head`, `admin`, or `city_admin` role).
2. Department Head requests automatically lock `department_id` to their own assigned department. Any client-provided `department_id` mismatch is overridden by backend validation.
3. System automatically inserts records into both `users` and `field_staff` tables with matched `department_id`.

### Changing Staff Department
1. Admin or authorized Department Head invokes `PUT /api/department/staff/:id`.
2. Backend validates that the staff member is not currently assigned to active open complaints before performing department migration.

---

## 3. Managing Department Heads

### Assigning / Updating Department Heads
1. Execute `POST /api/admin/department-heads` (Requires `admin` or `city_admin` role).
2. Required non-negotiable Department Head accounts:
   - `Rahul Kumar` → `PWD` (Dept 1)
   - `Amit Sharma` → `SAN` (Dept 2)
   - `Vikram Patil` → `WTR` (Dept 3)
   - `Sanjay More` → `DRN` (Dept 4)
   - `Kunal Kulkarni` → `ELE` (Dept 5)
   - `Rohan Deshmukh` → `TRF` (Dept 6)
   - `Aditya Joshi` → `MNT` (Dept 7)
3. Direct execution of `seed7DemoDepartmentHeads(query)` automatically syncs user accounts and department head database mappings idempotently.

---

## 4. Master Data Validation & Integrity Verification

Run the following read-only integrity test script to verify database state before and after any operational maintenance:
```bash
node scratch/test_phase6_master_data_integrity.js
node scratch/test_phase6_master_data_security.js
```
Expected output: 0 failures, 32/32 integrity assertions PASS, 9/9 security assertions PASS.
