# NAGARSETU 3.0 — AI-Powered Civic Issue Reporting & Resolution Portal

NAGARSETU is a full-stack civic-issue reporting progressive web application (PWA) that allows citizens to report municipal issues like potholes, garbage accumulation, water leaks, and broken streetlights by taking or uploading a photo.

---

## 🌟 Key Features & Single Pipeline Architecture

```
Citizen → AI Detection → Auto-Complaint → GPS Tagging → Municipal Command Center
  → Officer Verification → Department Routing → Maintenance Staff Assignment
  → Resolution (photo proof) → Citizen Feedback → Analytics
```

1. **Citizen PWA:**
   - Multi-language interface: English (`en`), Hindi (`hi`), Marathi (`mr`).
   - Photo upload with AI Computer Vision auto-drafting.
   - Core Location Engine: Live Device GPS ➔ EXIF Metadata GPS ➔ Mandatory Interactive Leaflet Pin-Drop.
   - Real-time status tracking & star rating feedback upon resolution.
   - PWA Service Worker offline draft capability.

2. **Python AI Vision Microservice:**
   - FastAPI microservice running at `http://localhost:8000/analyze`.
   - Feature classification & auto-generated complaint titles, descriptions, and urgency priority tags.

3. **Municipal Command Center (Officer Dashboard):**
   - Live complaints triage table & GIS map view.
   - Priority filters, SLA timers, complaint verification (Approve/Reject), and department routing.
   - Duplicate complaint flagging (100m radius).

4. **Field Maintenance Staff App:**
   - Mobile-optimized view listing assigned tasks.
   - Direct Google Maps navigation link.
   - Photo proof upload ("After" photo) to complete task and notify citizen.

5. **Executive Admin Dashboard:**
   - Resolution speed metrics, department performance metrics, and GIS ward-level hotspot map visualizer.
   - Role Management (Citizen / Officer / Staff / Admin).

---

## 🚀 How to Run NAGARSETU Locally

### 1. Start Backend Server (Port 5000)
```bash
cd backend
npm install
npm start
```

### 2. Start AI Vision Microservice (Port 8000)
```bash
cd ai_service
pip install -r requirements.txt
python main.py
```

### 3. Start Frontend App (Port 3000)
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Pre-seeded Demo Accounts

| Role | Mobile / Login | Password | Initial View |
| :--- | :--- | :--- | :--- |
| **Citizen** | `9876543210` | `password123` | Report Issue & My Complaints |
| **Municipal Officer** | `9876543211` | `password123` | Command Center Dashboard |
| **Field Maintenance Staff** | `9876543212` | `password123` | Assigned Tasks & Resolution Upload |
| **Municipal Admin** | `9876543213` | `password123` | Executive Analytics & Hotspot Map |
