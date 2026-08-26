# CenterFlow — Online-First Architecture Audit & Remediation Report

**Date**: August 2026  
**Application**: CenterFlow (Center Management Platform)  
**Architecture Model**: **ONLINE-FIRST / CLOUD-FIRST (Neon PostgreSQL Source of Truth)**  

---

## 1. Executive Summary & Architectural Shift

The CenterFlow platform has been transitioned from a hybrid local-first state management design to a strict **Online-First / Cloud-First Architecture**. 

### Core Architectural Principle
- **Primary Source of Truth**: Neon PostgreSQL Cloud Database (`system_data` table).
- **Secondary Local Role**: Client-side storage (`IndexedDB` / `localStorage`) serves exclusively as an **Offline Event Queue** and **Transient Local Cache** for offline resilience.
- **Boot Strategy**: Upon launch, the application validates the server session, fetches authoritative cloud state directly from Neon PostgreSQL (`GET /api/sync`), and hydrates the React state store before exposing sensitive administrative functions.
- **Local Fallback Rule**: Local cache is strictly isolated to scenarios where network connectivity is absent or the cloud database is temporarily unreachable. At no point does local data silently overwrite or replace valid cloud state.

---

## 2. Audit Findings & Root Causes Identified

During the discovery and audit phase, the following architectural vulnerabilities were identified and remediated:

| Audit Item | Identified Deficiency | Severity | Remediation Applied |
| :--- | :--- | :--- | :--- |
| **Boot Flow** | Store previously initialized UI directly from stale local storage before Neon sync finished. | **HIGH** | Refactored `syncWithNeonOnLoad()` to fetch authoritative cloud state first and block stale state overrides. |
| **Bypass Trigger** | `offline_mode_simulation` flag in `localStorage` allowed bypassing cloud sync entirely. | **HIGH** | Completely removed `offline_mode_simulation` bypass logic across client store and UI. |
| **Session Enforcement** | `GET /api/sync` and `POST /api/sync` lacked strict session checks at the handler entry point. | **CRITICAL** | Enforced `getServerSession(req)` as the absolute first check in both GET and POST endpoints (returns HTTP 401 for unauthenticated calls). |
| **Offline Resilience** | Offline state loading was previously disabled (`loadFromIndexedDB` no-op). | **MEDIUM** | Implemented `persistWholeStateToIndexedDB` and `getPersistedStateFromIndexedDB` for offline cache loading when network is down. |
| **Reconnection Sync** | Reconnecting to network did not automatically push offline event queues to Neon. | **HIGH** | Added `online` and `offline` window event listeners in store constructor to auto-trigger `triggerBackgroundSync(true)`. |
| **Sync Indicators** | UI status badges lacked clear status distinction between Online Cloud and Offline Cache. | **MEDIUM** | Updated navbar and Sync Hub indicators to display live status: `🟢 متصل بـ Neon SQL`, `🟡 جاري المزامنة`, `🟠 مؤقت محلياً (أوفلاين)`. |

---

## 3. Implemented Architecture & Code Refactorings

### A. Boot Sequence & Cloud Hydration (`lib/store.ts`)
1. **Boot Initialization**:
   - `StateStore` initializes with clean `INITIAL_STATE` while preserving the user's active session (`currentUserRole`, `currentUserId`, `currentUserName`).
2. **Cloud Synchronization**:
   - `syncWithNeonOnLoad()` sets `syncStatus: "syncing"`.
   - Checks `getPendingDeltaSyncEvents()`. If offline events exist from prior disconnected sessions, it pushes them via `POST /api/sync` first.
   - Executes `GET /api/sync` to fetch authoritative state from Neon PostgreSQL.
   - Merges authoritative state into memory, updates offline cache via `persistWholeStateToIndexedDB()`, and sets `syncStatus: "online"`.
3. **Offline Fallback**:
   - If network or Neon is unreachable, `syncWithNeonOnLoad()` catches the error, loads cached state via `getPersistedStateFromIndexedDB()`, hydrates the store, and sets `syncStatus: "offline"`.

### B. Session Authorization & Backend Protection (`app/api/sync/route.ts`)
- **GET Endpoint**: Checks `getServerSession(req)` before querying Neon. Unauthenticated requests strictly return `HTTP 401 Unauthorized`.
- **POST Endpoint**: Checks `getServerSession(req)` before processing pending events. Returns `HTTP 401` for unauthenticated sessions.
- **Force Overwrite Restriction**: `forceOverwrite: true` is strictly restricted to Teacher sessions (`session.role === "teacher"`). Any attempt by non-teacher roles (e.g. Secretary) yields `HTTP 403 Forbidden`.

### C. Offline Queueing & Automatic Reconnection (`lib/db.ts` & `lib/store.ts`)
- Delta operations (attendance toggles, student registration, financial payments, exam scores) are enqueued durably in IndexedDB (`delta_sync_events` store).
- Window event listener `window.addEventListener("online", ...)` automatically detects network recovery and executes `triggerBackgroundSync(true)`.
- Upon HTTP 200 server confirmation, processed events are purged from the queue (`markDeltaEventsAsSynced`).

---

## 4. Verification & Validation Summary

| Test Category | Test Case | Target Endpoint / Method | Expected Result | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Unauthenticated GET sync | `GET /api/sync` | `HTTP 401 Unauthorized` | **PASSED** ✅ |
| **Authentication** | Unauthenticated POST sync | `POST /api/sync` | `HTTP 401 Unauthorized` | **PASSED** ✅ |
| **Role Authorization** | Secretary `forceOverwrite` attempt | `POST /api/sync` | `HTTP 403 Forbidden` | **PASSED** ✅ |
| **Online Boot** | Cold startup with active connection | `syncWithNeonOnLoad()` | Neon state loaded, `syncStatus = "online"` | **PASSED** ✅ |
| **Offline Fallback** | Disconnected boot | `syncWithNeonOnLoad()` | Local cache loaded, `syncStatus = "offline"` | **PASSED** ✅ |
| **Reconnection** | Online event trigger | `window.ononline` | Flushes offline queue, sets `syncStatus = "online"` | **PASSED** ✅ |
| **Build & Type Safety** | Application compilation | `npm run build` | Clean compilation with 0 errors | **PASSED** ✅ |
| **Code Quality** | ESLint validation | `npm run lint` | 0 errors | **PASSED** ✅ |

---

## 5. Conclusion

CenterFlow is fully hardened as an **Online-First / Cloud-First Platform**. Neon PostgreSQL serves as the authoritative, single source of truth for all student records, group rosters, financial ledgers, and attendance logs. Offline operations remain responsive and resilient through durable IndexedDB queueing, automatically re-synchronizing with Neon as soon as connectivity is restored.
