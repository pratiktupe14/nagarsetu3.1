# NAGARSETU 3.1 — Phase 6 Master Data Operations Runbook

Standard Operating Procedures (SOP) for managing municipal master data, department routing, staff assignments, and operational configuration safely in NAGARSETU 3.1.

---

## SOP-01: Adding a New Municipal Department

1. **Prerequisite**: Admin role required (`city_admin` or `admin`).
2. **Procedure**:
   Execute `POST /api/departments` with payload:
   ```json
   {
     "name": "Parks & Horticulture Department",
     "code": "PRK",
     "description": "Public parks, tree trimming, and green belt maintenance"
   }
   ```
3. **Validation**:
   - Backend checks that name and code are unique (`409 Conflict` if duplicate).
   - Record inserted into `departments` table.
4. **Taxonomy Sync**: Update `taxonomyService.js` if auto-routing of new civic categories to `PRK` is required.

---

## SOP-02: Updating Department Metadata

1. **Prerequisite**: Admin role required.
2. **Procedure**:
   Execute `PUT /api/departments/:id` with updated fields:
   ```json
   {
     "name": "Water Supply & Hydro Board",
     "description": "Citywide potable water distribution and hydro infrastructure"
   }
   ```
3. **Safety Guard**: Backend ensures updated code/name does not clash with another department.

---

## SOP-03: Deactivating or Removing a Department

1. **Prerequisite**: Admin role required.
2. **Safety Rule**: **NEVER** drop historical records. Departments with active or non-resolved complaints **CANNOT** be deleted.
3. **Procedure**:
   Execute `DELETE /api/departments/:id`.
   - If active complaints exist: API returns `400 Bad Request` with error message `"Cannot delete department with N active complaint(s). Reassign them first."`
   - To deactivate safely without deleting historical data: Update status field or reassign active complaints prior to deletion.

---

## SOP-04: Appointing a New Department Head

1. **Prerequisite**: Admin role required.
2. **Procedure**:
   Execute `POST /api/admin/department-heads` with payload:
   ```json
   {
     "fullName": "Rajesh V. Deshmukh",
     "email": "rajesh.deshmukh@nagarsetu.gov.in",
     "phone": "+91 98220 00010",
     "employeeId": "EMP-PWD-002",
     "departmentId": "1",
     "designation": "Chief Engineer & Department Head",
     "password": "SecurePassword123!"
   }
   ```
3. **Atomic Execution**:
   - Deactivates previous active Department Head for Department `1` (`status = 'inactive'`).
   - Inserts/updates `department_heads` and `users` tables atomically.
   - Logs structured security event `DEPARTMENT_HEAD_UPDATED`.

---

## SOP-05: Assigning & Reassigning Field Staff to Department

1. **Prerequisite**: Admin or Department Head role.
2. **Procedure**:
   - Service staff accounts must have `department_id` set to the target department ID in `users` and `field_staff` tables.
   - Staff listing filtered dynamically via database query `WHERE department_id = :deptId`.

---

## SOP-06: Verifying Category ↔ Department Routing

1. Run the read-only integrity test:
   ```bash
   node scratch/test_phase6_master_data_integrity.js
   ```
2. Verify all categories cleanly resolve to valid database department records.

---

## SOP-07: Master Data Emergency Rollback & Backup

1. Backup SQLite / PostgreSQL master tables before bulk operations:
   ```sql
   CREATE TABLE departments_backup AS SELECT * FROM departments;
   CREATE TABLE department_heads_backup AS SELECT * FROM department_heads;
   CREATE TABLE field_staff_backup AS SELECT * FROM field_staff;
   ```
2. Always prefer non-destructive soft deactivation (`status = 'inactive'`) over hard row deletions.
