# NAGARSETU 3.1 — API ARCHITECTURE & CONTRACT SPECIFICATION

## 1. REST ROUTE DOMAINS & CONTRACT PROTECTION
All API endpoint contracts are protected under backward-compatibility guarantees. Response envelope formats, key names, and HTTP status codes are preserved.

### Domain Route Groups
- `/api/auth`: Registration, Login, Mobile Login, OTP, Password Reset
- `/api/complaints`: Complaint Submission, Single Complaint Detail, Status Patch, History Timeline, Feedback, Support/Upvote
- `/api/department`: Department Triage Queue, Staff Allocation, Department Analytics, Roster
- `/api/staff`: Field Staff Task Queue, Location Directions, Proof Upload & Resolution
- `/api/admin`: Department CRUD, Department Head Credential Provisioning, Overdue Audits, Reports
- `/api/announcements`: Broadcast Announcements for Citizens & Departments
- `/api/notifications`: In-App User Alerts & Read Status Updates
- `/api/maps`: GeoJSON Features & Spatial Cluster Coordinates
- `/api/ai`: Photo Vision Analysis & Auto-Categorization Proxy

---

## 2. KEY ENDPOINT CONTRACT DEFINITIONS

### A. Complaint Submission
- **POST** `/api/complaints/submit`
- **Auth**: Required (`Bearer JWT`)
- **Payload**: `{ photo_url, category, title, description, priority, latitude, longitude, department_id, ... }`
- **Response**: `{ success: true, message: "...", complaint_id: 123, complaint: { ... } }` (HTTP 201)

### B. Status Update (Issue-004)
- **PATCH** `/api/complaints/:id/status`
- **Auth**: Required (`admin`, `city_admin`, `department_head`)
- **Payload**: `{ status: "In Progress", priority: "High", remarks: "..." }`
- **Response**: `{ success: true, message: "...", complaint: { ... } }` (HTTP 200) or `{ error: "..." }` (HTTP 403)

### C. Single Complaint Retrieval (Issue-010)
- **GET** `/api/complaints/:id`
- **Auth**: Required (`all roles`)
- **Response**: `{ complaint: { id, complaint_number, citizen_id, department_id, priority, status, assignment, ... } }` (HTTP 200) or `{ error: "..." }` (HTTP 403 / 404)
