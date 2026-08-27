# NAGARSETU 3.0 — GSD Execution Journal

## Entry 1: Localization Audit & Strategy
- **Issue**: Switching language (English / हिंदी / मराठी) left most pages in English.
- **Root Cause**: Only a small subset of keys existed in `i18n.ts`, and major portal pages (`AdminPortal`, `StaffPortal`, `CitizenPortal`, `LandingPage`, `LoginPage`, `DepartmentHeadPortal`) were rendering hardcoded English strings instead of subscribing to `useLanguage()`.
- **Strategy**: 
  1. Build a comprehensive civic translation dictionary in `i18n.ts` covering all portals, navigation, table headers, forms, stats, and dialogs in `en`, `hi`, and `mr`.
  2. Wire `useLanguage()` across shell components (`Navbar`, `Sidebar`, `StatusBadge`, `PriorityBadge`).
  3. Wire `useLanguage()` across Citizen, Staff, Department Head, Admin, and Landing pages.
  4. Ensure dynamic translators handle DB status, priority, category, and department strings cleanly.
  5. Verify zero build/runtime/layout regressions.
