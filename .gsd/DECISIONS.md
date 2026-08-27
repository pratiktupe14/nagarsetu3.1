# NAGARSETU 3.0 — Architectural Decisions

## Decision 1: Dual Database Support (PostgreSQL / SQLite)
- **Context**: App must run in both cloud (Vercel + Supabase PostgreSQL) and offline local development environments.
- **Decision**: Maintained unified query runner in `backend/src/config/db.js` with automatic SQLite local file fallback for dev and PostgreSQL for production.

## Decision 2: In-Memory Storage for Uploads with Magic Byte Validation
- **Context**: Vercel serverless environment has read-only filesystems.
- **Decision**: Use Multer `memoryStorage` engine with Buffer Magic Byte inspection for safe image processing across both local disk and serverless deployments.

## Decision 3: Vendor Chunk Splitting in Vite
- **Context**: Production bundle index.js exceeded 1.8 MB.
- **Decision**: Configured Rollup `manualChunks` in `vite.config.js` to split heavy libraries (Leaflet, Chart.js, Lucide icons, React core) into dedicated vendor bundles.
