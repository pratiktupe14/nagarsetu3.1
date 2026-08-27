# NAGARSETU 3.0 — Comprehensive Localization & Repair Specification

## 1. Executive Summary
This specification defines the complete overhaul of NAGARSETU 3.0's localization (i18n) framework and project reliability. The goal is to ensure 100% natural, consistent, and persistent translation across English (`en`), Hindi (`hi`), and Marathi (`mr`) for all user roles (Citizen, Department Head, Field Staff, City Admin).

## 2. Root Cause Analysis of Localization Failure
1. **Incomplete Translation Dictionaries**: `utils/i18n.ts` contains only ~50 keys, missing dictionary definitions for Admin Portal, Staff Portal, Citizen Settings, Landing Page, Auth forms, Table headers, Modal dialogs, and Dynamic alerts.
2. **Hardcoded UI Strings in Pages**: Over 30 pages and components render hardcoded English strings instead of calling `useLanguage()` and `t(...)`.
3. **Inconsistent Dynamic Content Translation**: Categories, Complaint Statuses, Priority levels, and Department names returned from API/DB are rendered in raw English without passing through `translateStatus()`, `translateCategory()`, `translatePriority()`, or `translateDepartment()`.

## 3. Required End State & Acceptance Criteria
1. **Complete Dictionary Coverage**: `en`, `hi`, and `mr` in `utils/i18n.ts` contain natural, accurate civic terminology for every UI string.
2. **Unified Single Source of Truth**: All components subscribe to `useLanguage()` from `LanguageContext.tsx`.
3. **State Persistence**: Switching language updates state, stores preference in `localStorage` (`nagarsetu_lang`), syncs to user profile, and persists across navigation and page refresh.
4. **Dynamic Data Translation**: Status badges, priority badges, category chips, and department names render in the active selected language.
5. **Zero UI Overflow**: Layouts (buttons, cards, headers, tables) adjust cleanly without clipping text in Hindi or Marathi.
6. **Zero Build & Runtime Errors**: Production build (`tsc && vite build`) and runtime console remain 100% clean.
