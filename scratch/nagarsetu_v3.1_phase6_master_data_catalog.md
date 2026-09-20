# NAGARSETU 3.1 — Phase 6 Master Data Catalog

Authoritative catalog of municipal master data, operational configuration, schema definitions, and governance rules in NAGARSETU 3.1.

---

## 1. Municipality & City Configuration

- **City Name**: Nashik
- **Municipal Body**: Nashik Municipal Corporation (NMC)
- **Timezone**: `Asia/Kolkata` (IST, UTC+5:30)
- **Default Locale**: `en` (English), supporting multilingual civic interface (`hi`, `mr`)
- **Emergency Helpline**: `1800-233-1913` / `112`
- **Primary Source of Truth**: PostgreSQL / SQLite (`departments`, `department_heads`, `field_staff`, `users`, `complaints` database tables)

---

## 2. Municipal Departments Master Data

| Dept ID | Code | Department Name | Description / Scope |
|---|---|---|---|
| `1` | `PWD` | Public Works Department | Roads, potholes, footpaths, bridges, public works infrastructure |
| `2` | `SAN` | Sanitation & Waste Management | Garbage collection, solid waste, street cleaning, bin overflow |
| `3` | `WTR` | Water Supply & Sewerage Board | Water supply, main pipelines, water leaks, distribution |
| `4` | `DRN` | Drainage & Sewage Department | Stormwater drains, open gutters, sewerage chokeages, manholes |
| `5` | `ELE` | Electrical & Street Lighting | Street lights, electrical poles, dark spots, power infrastructure |
| `6` | `TRF` | Traffic Management Department | Traffic signals, road signage, traffic island maintenance |
| `7` | `MNT` | Maintenance Department | General civic infrastructure, railings, public building repair |

---

## 3. Active Department Leadership Master Data

All Department Heads are linked to authoritative database records in `department_heads` and `users`:

| Dept Code | Active Department Head | Email | Official Employee ID | Status |
|---|---|---|---|---|
| `PWD` | Rahul Kumar | `rahul.kumar@nagarsetu.gov.in` | `EMP-PWD-001` | Active |
| `SAN` | Amit Sharma | `amit.sharma@nagarsetu.gov.in` | `EMP-SAN-001` | Active |
| `WTR` | Vikram Patil | `vikram.patil@nagarsetu.gov.in` | `EMP-WTR-001` | Active |
| `DRN` | Sanjay More | `sanjay.more@nagarsetu.gov.in` | `EMP-DRN-001` | Active |
| `ELE` | Kunal Kulkarni | `kunal.kulkarni@nagarsetu.gov.in` | `EMP-ELE-001` | Active |
| `TRF` | Rohan Deshmukh | `rohan.deshmukh@nagarsetu.gov.in` | `EMP-TRF-001` | Active |
| `MNT` | Aditya Joshi | `aditya.joshi@nagarsetu.gov.in` | `EMP-MNT-001` | Active |

---

## 4. Field Staff Distribution Master Data

Active workforce linked via `field_staff` database table (36 Total Active Accounts):

| Dept Code | Staff Count | Employee ID Pattern | Default Duty Areas |
|---|---|---|---|
| `PWD` | 6 Staff | `PWD-STF-001` to `PWD-STF-006` | Nashik East, West, Panchavati, CIDCO |
| `SAN` | 5 Staff | `SAN-STF-001` to `SAN-STF-005` | Satpur, Nashik Road, Panchavati |
| `WTR` | 5 Staff | `WTR-STF-001` to `WTR-STF-005` | Gangapur, CIDCO, Nashik East |
| `DRN` | 5 Staff | `DRN-STF-001` to `DRN-STF-005` | Satpur, Panchavati, Nashik Road |
| `ELE` | 5 Staff | `ELE-STF-001` to `ELE-STF-005` | Nashik West, CIDCO, Satpur |
| `TRF` | 5 Staff | `TRF-STF-001` to `TRF-STF-005` | CBS Circle, Dwarka, Highway Zone |
| `MNT` | 5 Staff | `MNT-STF-001` to `MNT-STF-005` | Main City Central, Municipal Properties |

---

## 5. Civic Issue Category Taxonomy & Department Routing Map

Taxonomy resolution is executed server-side via `taxonomyService.js` and database lookup:

| Canonical Category | Specific Issues / Keywords | Default Target Dept | Department ID |
|---|---|---|---|
| `Road Damage / Pothole` | Pothole, asphalt crater, footpath damage, road crack | `PWD` | `1` |
| `Garbage / Waste` | Overflowing bin, waste accumulation, uncollected trash | `SAN` | `2` |
| `Water Leakage / Pipeline` | Pipeline burst, water leakage, supply disruption | `WTR` | `3` |
| `Drainage / Sewage` | Blocked drain, overflowing sewer, open manhole | `DRN` | `4` |
| `Streetlight / Electrical` | Broken streetlight, exposed wire, pole damage | `ELE` | `5` |
| `Traffic Infrastructure` | Signal malfunction, damaged traffic sign, island | `TRF` | `6` |
| `Public Infrastructure Damage` | Railing damage, paver block defect, civic building | `MNT` | `7` |

---

## 6. Complaint Lifecycle Status Master Data

| Status Code | Description | Allowed Roles to Set |
|---|---|---|
| `Submitted` | Initial state upon citizen submission | System / Citizen |
| `NEEDS_VERIFICATION` | Low confidence AI submission requiring verification | System |
| `Staff Assigned` | Task assigned to specific field staff by Department Head | Department Head |
| `Accepted` | Field staff accepted assigned task | Assigned Field Staff |
| `On the Way` | Field staff dispatched to site | Assigned Field Staff |
| `In Progress` | Work active on location | Assigned Field Staff |
| `Resolution Submitted` | Work finished, photo submitted, awaiting DH approval | Assigned Field Staff |
| `Resolved` | Verified & approved by Department Head | Department Head |
| `Reopened` | Reopened by Citizen within allowed SLA window | Citizen |
| `Rejected` | Invalid / duplicate / rejected complaint | Department Head / Admin |

---

## 7. Governance & Master Data Security Rules

1. **Database Source of Truth**: All municipal relationships (`departments`, `department_heads`, `field_staff`) must be queried from PostgreSQL / SQLite.
2. **Server-Side Category Routing**: Client cannot forge `department_id` to route a complaint to an arbitrary department. Server resolves department using category taxonomy and database lookup.
3. **No Soft/Hard Hardcoded IDs**: Department logic checks database records by code and primary keys.
4. **Delete Safety**: Departments with active complaints cannot be deleted (HTTP 400 Bad Request).
5. **Security Isolation**: Department Heads can view and assign ONLY field staff and complaints belonging to their own department.
