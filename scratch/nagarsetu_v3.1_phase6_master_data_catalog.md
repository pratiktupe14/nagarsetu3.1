# NAGARSETU 3.1 — Phase 6 Municipal Master Data Catalog

## Executive Summary
This document serves as the single authoritative master catalog for the municipal organizational structure of NAGARSETU 3.1. All organizational mappings, department head relationships, service staff assignments, and category routing rules documented herein are enforced at the database level in PostgreSQL / Supabase and local SQLite instances.

---

## 1. Authoritative 7 Municipal Departments

| DB ID | Code | Department Name | Scope & Responsibilities | Assigned Department Head |
|-------|------|-----------------|--------------------------|--------------------------|
| 1 | PWD | Public Works Department | Road repairs, asphalt paving, potholes, sidewalk & structural civic infrastructure | Rahul Kumar (`rahul.kumar@nagarsetu.gov.in`) |
| 2 | SAN | Sanitation & Waste Management | Solid waste collection, dumpster clearing, street sweeping, market sanitation & public hygiene | Amit Sharma (`amit.sharma@nagarsetu.gov.in`) |
| 3 | WTR | Water Supply & Sewerage Board | Potable water pipelines, leakage sealing, valve control & water supply network | Vikram Patil (`vikram.patil@nagarsetu.gov.in`) |
| 4 | DRN | Drainage & Sewage Department | Drainage blockages, sewage overflows, open drains, culverts & storm channels | Sanjay More (`sanjay.more@nagarsetu.gov.in`) |
| 5 | ELE | Electrical & Street Lighting | Streetlight repair, electrical poles, transformer inspection & public lighting | Kunal Kulkarni (`kunal.kulkarni@nagarsetu.gov.in`) |
| 6 | TRF | Traffic Management Department | Traffic signals, road signage, lane markings & junction traffic safety | Rohan Deshmukh (`rohan.deshmukh@nagarsetu.gov.in`) |
| 7 | MNT | Maintenance Department | Civic building repairs, public park upkeep & general municipal asset management | Aditya Joshi (`aditya.joshi@nagarsetu.gov.in`) |

---

## 2. Department Head Relationships & Constraints

- **Strict Non-Swappable Mappings**:
  - `Rahul Kumar` → `PWD` (Dept ID 1)
  - `Amit Sharma` → `SAN` (Dept ID 2)
  - `Vikram Patil` → `WTR` (Dept ID 3)
  - `Sanjay More` → `DRN` (Dept ID 4)
  - `Kunal Kulkarni` → `ELE` (Dept ID 5)
  - `Rohan Deshmukh` → `TRF` (Dept ID 6)
  - `Aditya Joshi` → `MNT` (Dept ID 7)
- **Hardening Rules**:
  - Department Head role (`role: 'department_head'`) is linked strictly to a single department via `department_id`.
  - Department Heads cannot edit, reassign, or deactivate staff members or complaints outside their assigned department (enforced with HTTP 403 Forbidden).

---

## 3. Field Staff Relationships & Baseline Mapping

Each field staff member is assigned to a specific department. Standard baseline field staff:

| Staff ID | Name | Role | Department Code | Department Name | DB ID |
|----------|------|------|-----------------|-----------------|-------|
| PWD-STF-001 | Amit Patil | Field Operations | PWD | Public Works Department | 1 |
| SAN-STF-001 | Prashant Mane | Field Operations | SAN | Sanitation & Waste Management | 2 |
| WTR-STF-001 | Kiran Patil | Field Operations | WTR | Water Supply & Sewerage Board | 3 |
| DRN-STF-001 | Sunil Patil | Field Operations | DRN | Drainage & Sewage Department | 4 |
| ELE-STF-001 | Rahul Joshi | Field Operations | ELE | Electrical & Street Lighting | 5 |
| TRF-STF-001 | Rohan Patil | Field Operations | TRF | Traffic Management Department | 6 |
| MNT-STF-001 | Kunal Patil | Field Operations | MNT | Maintenance Department | 7 |

---

## 4. Complaint Category Routing & Master Data

Categories are stored and mapped dynamically to departments via database relationships.

| Category | Primary Department Code | Resolved Department Name |
|----------|-------------------------|--------------------------|
| Road damage / potholes | PWD | Public Works Department |
| Sanitation / waste | SAN | Sanitation & Waste Management |
| Water supply / leakage | WTR | Water Supply & Sewerage Board |
| Drainage / sewage | DRN | Drainage & Sewage Department |
| Electrical / street lighting | ELE | Electrical & Street Lighting |
| Traffic signals / signage | TRF | Traffic Management Department |
| Civic building / park maintenance | MNT | Maintenance Department |

---

## 5. Priority & Status Master Configuration

- **Complaint Lifecycle Flow**:
  `Submitted` → `Staff Assigned` → `Accepted` → `On the Way` → `In Progress` → `Resolution Submitted` → `Resolved`
- **Reopen Lifecycle Flow**:
  `Resolved` → `Reopened` → `In Progress` → `Resolution Submitted` → `Resolved`
- **Authorization Scoping**:
  - **Field Staff**: Permitted to update status through `Accepted`, `On the Way`, `In Progress`, and `Resolution Submitted`.
  - **Department Head / Admin**: Authorized to perform final verification (`Resolved` / `Rejected`).
  - **Citizen**: Authorized to rate resolution or trigger `Reopened` state on resolved complaints.

---

## 6. Security, Isolation, and Historical Integrity

- **Database Source of Truth**: All UI views resolve department details directly from API responses powered by PostgreSQL/Supabase database tables (`departments`, `field_staff`, `department_heads`, `users`).
- **No Direct Data Mutation**: Client inputs for `department_id` during staff creation or complaint submission are validated on the backend against server-side user credentials and department master records.
- **Historical Data Protection**: Deletion of departments with active or historical complaints is blocked (`is_active = false` soft deactivation preserved).
