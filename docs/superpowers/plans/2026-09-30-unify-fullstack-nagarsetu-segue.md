# Unify Full-Stack into NagarSetuSegue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the separate frontend (`nagarsetu3-1`) and backend (`nagarsetu-backend-api`) Vercel deployments into a single unified full-stack Vercel project named `NagarSetuSegue` with same-origin routing and zero CORS friction.

**Architecture:** A unified monorepo on Vercel deploying from the repository root. Vercel routes `/api/*` requests to the serverless Express function (`api/index.js` invoking `backend/src/app.js`), serves static production assets from `frontend/dist`, and rewrites SPA client routes `/*` to `frontend/dist/index.html`. In local development, Vite proxies `/api` to the local Express server on port 5000.

**Tech Stack:** Node.js 20+, Express.js, React 18, Vite, TypeScript, Vercel Serverless Functions, Supabase PostgreSQL & Storage, Google Gemini API.

**Spec:** Architectural design for consolidating frontend and backend into `NagarSetuSegue` on Vercel.

## Global Constraints

- Preserve all existing security fixes in `backend/src/` (OTP gating, department backdoors, IDOR masking, parameter bindings).
- Do not alter existing database schemas or destroy previous deployment records on Vercel.
- Keep local development workflows (`npm run dev`, `start-dev.js`) 100% operational with no breaking changes.
- Ensure all public assets (`/assets/*`, `/favicon.ico`, `/uploads/*`) are served correctly with standard caching and security headers.
- Never hardcode sensitive secrets in public bundles (`VITE_*` must only contain public keys; `DATABASE_URL` and `JWT_SECRET` must remain strictly serverless environment variables).

## Review Focus

1. **SPA Routing vs API Collisions:** Verify `/api/*` routes are handled exclusively by Express and never rewritten to `index.html`.
2. **Relative API Resolution:** Verify `apiConfig.ts` gracefully resolves relative URLs without falling back to stale legacy URLs when `VITE_API_URL` is omitted.
3. **Serverless Dependency Bundling:** Verify Vercel NFT (Node File Trace) correctly packages backend dependencies for root `api/index.js`.
4. **Environment Variable Parity:** Verify all required backend secrets and frontend public keys are present in the new `NagarSetuSegue` Vercel project.
5. **CORS & Preflight Elimination:** Verify browser requests to `/api/*` from the same origin execute seamlessly without preflight overhead.

---

### Task 1: Unify Root Configuration & Monorepo Workspaces

**Files:**
- Modify: `package.json`
- Modify: `vercel.json`
- Verify: `api/index.js`

**Interfaces:**
- Consumes: `backend/package.json`, `frontend/package.json`, `api/index.js`
- Produces: Root `package.json` with npm workspaces and unified build scripts; Root `vercel.json` with rewrites and build outputs.

- [ ] **Step 1: Configure root `package.json` with npm workspaces**
Add `"workspaces": ["backend", "frontend"]` and unified `build` and `test` scripts:
```json
{
  "name": "nagarsetu-segue",
  "version": "3.1.0",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev": "node start-dev.js",
    "build": "npm run build --workspace=frontend",
    "test": "npm test --workspace=backend",
    "start:backend": "npm start --workspace=backend",
    "start:frontend": "npm run dev --workspace=frontend"
  }
}
```

- [ ] **Step 2: Update root `vercel.json` for unified routing**
Configure root `vercel.json` to install dependencies across workspaces, build frontend to `frontend/dist`, route `/api/(.*)` to `/api/index.js`, and fallback all other routes to `/index.html`:
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 3: Verify root `api/index.js` serverless handler**
Confirm `api/index.js` exports the configured Express app from `../backend/src/app.js` and initializes the database pool safely.

- [ ] **Step 4: Test root build and test scripts locally**
Run: `npm run build` and `npm test` from root.
Expected: Frontend compiles cleanly into `frontend/dist`; Backend test suite passes 6/6 tests.

---

### Task 2: Update Frontend API Resolver for Same-Origin Production

**Files:**
- Modify: `frontend/src/config/apiConfig.ts`
- Modify: `frontend/.env.production` (if present)

**Interfaces:**
- Consumes: `import.meta.env.VITE_API_URL`
- Produces: `getApiUrl()` returning empty string `""` for relative URLs when on same origin.

- [ ] **Step 1: Update `getApiUrl()` in `frontend/src/config/apiConfig.ts`**
Allow empty or relative root when `VITE_API_URL` is omitted, eliminating stale hardcoded fallback URLs:
```typescript
export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  // When unified in NagarSetuSegue, use same-origin relative URLs:
  return '';
};
```

- [ ] **Step 2: Verify `getAiServiceUrl()`**
Confirm `getAiServiceUrl()` correctly resolves `/api/ai` when `getApiUrl()` returns `""`.

- [ ] **Step 3: Build frontend and verify output**
Run: `npm run build --workspace=frontend`
Expected: TypeScript and Vite compile with 0 errors into `frontend/dist`.

---

### Task 3: Create & Configure `NagarSetuSegue` Project on Vercel

**Files:**
- Modify: `.vercel/project.json` (root level link)

**Interfaces:**
- Consumes: Vercel CLI credentials and environment variables from `nagarsetu-backend-api` and `nagarsetu3-1`
- Produces: New Vercel project `nagarsetusegue` with all synchronized environment variables.

- [ ] **Step 1: Link new project `NagarSetuSegue` via Vercel CLI**
Run Vercel link command at repository root to create/link `nagarsetusegue` under `pratik-dilip-tupes-projects`.

- [ ] **Step 2: Sync Backend Secrets to `NagarSetuSegue`**
Add to `nagarsetusegue` on Production and Preview:
- `DATABASE_URL`
- `DB_TYPE`
- `NODE_ENV=production`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_VISION_MODEL`
- `GOOGLE_MAPS_API_KEY`
- `RATE_LIMIT_*`

- [ ] **Step 3: Sync Frontend Public Variables to `NagarSetuSegue`**
Add to `nagarsetusegue` on Production and Preview:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
(Leave `VITE_API_URL` blank or unset so it uses seamless relative same-origin calls).

---

### Task 4: Deploy & Verify `NagarSetuSegue` in Production

**Files:**
- Deploy from: `D:\NAGARSETU\NAGARSETU 3.1`

**Interfaces:**
- Consumes: Root `vercel.json`, `api/index.js`, `frontend/dist`
- Produces: Live production deployment at `https://nagarsetusegue.vercel.app` (or generated Vercel alias).

- [ ] **Step 1: Execute production deployment**
Run: `vercel deploy --prod --yes` from repository root.
Expected: Vercel builds frontend, deploys serverless function `/api/index.js`, and provisions live production URL.

- [ ] **Step 2: Live Verification - Backend API Endpoints**
- Test `GET /api/health` -> HTTP 200 with `{ status: "ok", service: "NAGARSETU Express Backend API" }`
- Test `GET /api/complaints` without auth token -> HTTP 401 Unauthorized (Security test)
- Test `POST /api/auth/otp-verify` -> Handled by Express auth route

- [ ] **Step 3: Live Verification - Frontend SPA Endpoints**
- Test `GET /` -> HTTP 200 with HTML title `NAGARSETU` and compiled React assets
- Test `GET /login` -> HTTP 200 (SPA client routing fallback to `index.html`)
- Test asset loading -> All `/assets/*.js` and `/assets/*.css` return HTTP 200 with proper MIME types.

---

### Task 5: Final Review & Git Commit

**Files:**
- Commit all modified files: `package.json`, `vercel.json`, `frontend/src/config/apiConfig.ts`, `docs/superpowers/plans/`

- [ ] **Step 1: Run comprehensive tests locally**
Run: `npm test`
Expected: 100% test pass.

- [ ] **Step 2: Commit changes to Git**
Create clean atomic commit documenting the transition to unified `NagarSetuSegue` project.
