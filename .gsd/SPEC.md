# NAGARSETU 3.0 — Technical Specification & Audit Baseline

## 1. Executive Overview
NAGARSETU 3.0 is a smart civic issue reporting and municipal operations platform connecting Citizens, City Administration, Department Heads, and Service Staff in a unified digital system.

## 2. Core Architecture & Tech Stack
- **Frontend**: React (v18), Vite, TypeScript, Tailwind CSS, Leaflet Maps, Lucide Icons, Chart.js.
- **Backend API**: Node.js / Express REST API (`/api/*`).
- **AI Microservice**: Python FastAPI + Gemini 3.6 Flash Computer Vision & Google Maps API.
- **Database**: PostgreSQL (Supabase / Production) with SQLite fallback for local development.
- **Auth**: JWT Authentication with role-based access control (Citizen, Officer, Staff, Department Head, City Admin).

## 3. Discovered Audit Findings & Inventory

### P0 — Critical (0 Found)
- All critical build compilation steps pass (`tsc` & Vite build succeed).

### P1 — High (0 Found)
- Authentication, SQLite/PostgreSQL schemas, and rate-limiting security guards are operational.

### P2 — Medium (2 Found)
1. **Frontend Large Bundle Chunk Warning**: Vite bundle produces a single `1,835 kB` index chunk.
   - *Fix*: Implement `manualChunks` in `vite.config.js` to split vendor dependencies (`vendor-react`, `vendor-leaflet`, `vendor-charts`, `vendor-lucide`).
2. **Async Error Propagation in Backend Routes**: Ensure all Express route handlers wrap async calls with `try-catch` calling `next(err)` to guarantee global `errorHandler` processing.

### P3 — Low (1 Found)
1. **Outdated Documentation**: Update README and `.env.example` to reflect the 6 GSD security enhancements and code-splitting configuration.

## 4. Acceptance Criteria
1. `npm run build` in `frontend` passes with vendor code-splitting enabled (`index` chunk size < 500 kB).
2. All backend route endpoints propagate async exceptions to global `errorHandler.js`.
3. End-to-end user workflows (Citizen submission, Department Head assignment, Staff resolution, Admin analytics) pass runtime validation.
