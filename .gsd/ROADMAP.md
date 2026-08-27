# NAGARSETU 3.0 — Repair & Verification Roadmap

## Phase 1: Infrastructure & Build Optimization
- [x] Run initial dependency audit & typecheck
- [x] Implement Vite `manualChunks` vendor code-splitting in `frontend/vite.config.js`
- [x] Verify production bundle size reduction (< 500 kB per vendor chunk)

## Phase 2: Security & Backend Error Handling
- [x] Implement Tiered Rate Limiter (`rateLimiter.js`) for Auth, Public, and Authenticated routes
- [x] Implement Strict Joi Input Validation (`validateInput.js` & schemas)
- [x] Enforce JWT_SECRET production check and `.env` ignore rules
- [x] Implement Global `errorHandler.js` preventing stack trace / SQL leaks
- [x] Implement Magic Byte Buffer Verification for image uploads in `upload.js`
- [x] Ensure async error propagation (`next(err)`) across Express routes

## Phase 3: Runtime Verification & Flow Testing
- [x] Verify API Health endpoints (`http://localhost:5000/api/health` & `http://localhost:8000/`)
- [x] Test Citizen complaint report flow with AI detection & Leaflet pin drop
- [x] Test Department Head task assignment flow
- [x] Test Service Staff task resolution & "After" photo proof flow
- [x] Test Admin Executive Dashboard & Analytics flow

## Phase 4: Final Independent Audit & Documentation
- [x] Re-run typecheck, build, and audit checks
- [x] Update GSD STATE.md and documentation
