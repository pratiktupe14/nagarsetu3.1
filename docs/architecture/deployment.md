# NAGARSETU 3.1 — DEPLOYMENT & DEVOPS ARCHITECTURE

## 1. ENVIRONMENT CONFIGURATION
- **Frontend Build Tool**: Vite 5.2.0 building to `frontend/dist/`.
- **Backend Application**: Express.js server on Node.js v24+. Serverless entry via `api/index.js` (Vercel) or server entry via `backend/src/server.js`.
- **AI Service**: Python FastAPI / Flask application at `ai_service/main.py`.

---

## 2. PRODUCTION DEPLOYMENT TARGETS
- **Vercel**: Configured via `vercel.json` and `api/index.js` serverless function wrapper.
- **Render / Container Platform**: Backend Node.js service running `npm start` in `backend/` directory connected to Supabase / Managed PostgreSQL.
