# CENTERFLOW: COMPLETE TECHNICAL AND BUSINESS SYSTEM DOCUMENTATION

**Document Status:** Complete Technical & Architectural Baseline  
**Project Name:** CenterFlow (Educational Center Management System)  
**Target Repository:** Full-Stack Next.js (App Router) Educational Center Management Platform  
**Target Audience:** Software Engineers, AI Systems Engineers, Technical Architects, and Product Maintainers  

---

## 1. EXECUTIVE SUMMARY & SYSTEM OVERVIEW

### 1.1 Purpose & Domain
**CenterFlow** is an offline-first, web-based management system tailored for private tutoring centers, educational academies, and private teachers in Egypt and the MENA region. The platform addresses critical administrative workflows:
- Student enrollment, codification, and group assignment.
- Fast barcode-based attendance marking (using handheld USB/Bluetooth barcode scanners).
- Financial ledger tracking (monthly fees, subscription payments, custom receipts, overdue alerts).
- Academic tracking (oral/written recitations, exams, score sheets, and behavioral notes).
- Parent communication via automated WhatsApp web deep-linking.
- Parent self-service portal (`/parents`) for student academic/attendance lookup.
- Real-time data synchronization with cloud PostgreSQL (Neon DB) alongside robust offline fallbacks.

### 1.2 Core Business Value
- **Zero-Latency Scanning:** Designed for high-volume entry, where hundreds of students arrive in short windows before lectures. Barcode scanning registers attendance in milliseconds locally without waiting for network roundtrips.
- **Offline Reliability:** Operations (attendance, payments, exam entries) continue uninterrupted during internet outages. Local changes are queued as delta events and auto-synced upon reconnection.
- **Role-Based Access Control:** Protects teacher settings, financial reports, and pin codes while delegating daily operational tasks to center secretaries.

---

## 2. ARCHITECTURE & TECH STACK

```
+---------------------------------------------------------------------------------+
|                                 CLIENT BROWSER                                  |
|                                                                                 |
|  +-----------------------+   +----------------------+   +--------------------+  |
|  |   Next.js App Router  |   |  StateStore Singleton|   |  In-Memory Delta   |  |
|  |  (React 19 Components)| <->  (useSyncExternalStore) <-> |   Events Queue     |  |
|  +-----------------------+   +----------------------+   +--------------------+  |
|                                         ^                                       |
|                                         | localStorage / JSON Backups           |
+-----------------------------------------|---------------------------------------+
                                          |
                                          | HTTP POST /api/sync
                                          v
+---------------------------------------------------------------------------------+
|                               SERVER (Cloud Run / Node)                         |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | /app/api/sync/route.ts                                                    |  |
|  | - Server Auth Validation (getServerSession via cookies / x-user-role)     |  |
|  | - Sequential Event Replay Engine & LWW Payment Conflict Resolution        |  |
|  | - Secret Stripping (teacherPin, appLockPin, secretary pin)                |  |
|  +---------------------------------------------------------------------------+  |
|                                         |                                       |
|                                         v Neon Serverless Client (@neondatabase) |
+-----------------------------------------|---------------------------------------+
                                          v
+---------------------------------------------------------------------------------+
|                         NEON POSTGRESQL CLOUD DATABASE                          |
|                                                                                 |
|  Table: system_data (id VARCHAR(50) PRIMARY KEY, payload JSONB, updated_at)    |
+---------------------------------------------------------------------------------+
```

### 2.1 Framework & Core Technologies
- **Frontend / Framework:** Next.js 15 (App Router) with React 19 and TypeScript.
- **Styling & UI:** Tailwind CSS v4, Lucide React icons, Framer Motion (`framer-motion`) animations, HTML5 Canvas API.
- **Data Persistence & Local State:** Custom `StateStore` event-driven pub/sub architecture backed by browser `localStorage` and `useSyncExternalStore`.
- **Database Engine:** Neon PostgreSQL Serverless (`@neondatabase/serverless`).
- **File & PDF Processing:** `jszip` for bulk ZIP packaging, `jspdf` for label generation.
- **Deployment Platform:** Containerized Cloud Run with Nginx reverse proxy routing on exposed Port 3000.

---

## 3. USER ROLES, AUTHENTICATION & ACCESS CONTROL

### 3.1 User Roles
1. **Teacher (`teacher`):**
   - Superuser role with full system permissions.
   - Master access to financial summaries, system reset, secretary management, PIN reconfiguration, backup/restore, and database force overwrites.
2. **Secretary (`secretary`):**
   - Operational role assigned to individual center assistants.
   - Default permissions: Attendance scanning, student entry, exam recording, payment recording.
   - Granular permissions: Can be individually granted `fullAccess: true` by the teacher, or restricted via global `isLockAccessEnabled` settings.
3. **Admin (`admin`):**
   - Treated as teacher-equivalent in server authentication checks (`lib/serverAuth.ts`).

### 3.2 Authentication & Session Flow
- **PIN Authentication:** Users sign in via numeric PIN screens handled by `AuthScreen.tsx`.
  - Master Teacher PIN default: `"2026"`.
  - Secretaries authenticate using their assigned PIN stored in `state.secretaries`.
- **Session Cookies & Headers:**
  - Client stores active user role and ID in `StateStore` state (`currentUserRole`, `currentUserId`, `currentUserName`).
  - Server-side auth helper (`lib/serverAuth.ts`) parses:
    1. Cookie: `centerflow_session` or `session` (JSON string or raw role string).
    2. HTTP Headers: `x-user-role`, `x-user-id`, `x-user-name`.
    3. HTTP Authorization Header: `Bearer <token>` (defaults to teacher session).
    4. Default Fallback: If unauthenticated, returns teacher session for seamless single-center sync operations.

### 3.3 Granular Access Control Logic (`hasFullAccess`)
```ts
export function hasFullAccess(state: AppState): boolean {
  if (state.currentUserRole === "teacher") return true;
  if (state.currentUserRole === "secretary" && state.currentUserId) {
    const sec = state.secretaries.find((s) => s.id === state.currentUserId);
    return !!sec?.fullAccess;
  }
  return false;
}
```

---

## 4. CLIENT-SIDE STATE MANAGEMENT (`StateStore`)

### 4.1 Architecture
Located in `/lib/store.ts`, `StateStore` is an event-driven singleton class managing the `AppState` object.

Key Features:
- **Subscription API:** Uses `subscribe(listener)` and `useSyncExternalStore` for reactive React component updates.
- **Local Storage Persistence:** State updates write to `localStorage` key `teacher_center_system_v1` on every `setState`.
- **Secret Hygiene:** `teacherPin`, `appLockPin`, and secretary `pin` attributes are scrubbed before saving to public browser storage or returning API payloads to secretaries.

### 4.2 State Interface (`AppState`)
```ts
export interface AppState {
  // Authentication & Session
  currentUserRole: Role;
  currentUserId: string | null;
  currentUserName: string;
  teacherPin: string;
  teacherName: string;
  centerName: string;
  subjectName: string;
  academicYear: string;
  
  // Security Locks
  isLockAccessEnabled: boolean;
  lockAccessStart: string;
  lockAccessEnd: string;
  isAppLockActive: boolean;
  appLockPin: string;

  // Domain Collections
  secretaries: Secretary[];
  groups: Group[];
  students: Student[];
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  recitations: RecitationRecord[];
  exams: ExamRecord[];
  studentNotes: StudentNote[];
  activityLogs: ActivityLog[];
  whatsappTemplates: WhatsAppTemplate[];
  archives: ArchivedYearData[];

  // System State
  syncStatus: "online" | "offline" | "syncing";
}
```

---

## 5. OFFLINE-FIRST ARCHITECTURE & DELTA SYNC ENGINE

### 5.1 Delta Event Queue (`lib/db.ts`)
When mutations occur while offline or during background operations, state changes create a `DeltaSyncEvent` queued in an in-memory array (`inMemoryDeltaEvents`):

```ts
export interface DeltaSyncEvent {
  id: string;
  timestamp: string;
  action: 
    | "TOGGLE_ATTENDANCE" | "ADD_STUDENT" | "UPDATE_STUDENT" | "DELETE_STUDENT" 
    | "ADD_PAYMENT" | "DELETE_PAYMENT" | "ADD_GROUP" | "UPDATE_GROUP" | "DELETE_GROUP"
    | "ADD_RECITATION" | "DELETE_RECITATION" | "ADD_EXAM" | "SAVE_EXAM_SCORES" | "DELETE_EXAM"
    | "ADD_NOTE" | "DELETE_NOTE" | "LOG_ACTIVITY";
  payload: any;
  synced: boolean;
}
```

### 5.2 Local Conflict Resolution & Event Collation (`collateEvents`)
`lib/db.ts` provides `collateEvents()` to resolve offline operational conflicts before transmission:
- **Attendance Toggles:** Keeps the latest toggled attendance state per `studentId_date_groupId`.
- **Student Mutations:** Merges rapid offline `UPDATE_STUDENT` events into a single `ADD_STUDENT` or updated payload. If created and deleted offline, cancels out events completely.

### 5.3 Baseline Comparison Engine (`lib/syncService.ts`)
`SyncService` maintains a baseline in `localStorage` under `teacher_center_sync_baseline_v1`:
- Computes property-level diff reports (`calculateStateDiff`) between current local state and the cloud baseline.
- Tracks pending entities and fields changed across all domain collections.

---

## 6. DATABASE & SERVER-SIDE SYNC ROUTE

### 6.1 Database Schema (`app/api/sync/route.ts`)
The server uses Neon Serverless PostgreSQL with a single JSONB table:

```sql
CREATE TABLE IF NOT EXISTS system_data (
  id VARCHAR(50) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
- Row Identifier: `'center_v1'` holds the authoritative center payload.

### 6.2 Replay & Merging Engine
When `POST /api/sync` receives client requests:
1. **Authentication Check:** Validates user session unless initializing an empty cloud database.
2. **Force Overwrite:** If `forceOverwrite: true` and the user is a teacher, directly overwrites cloud `payload` with `localState`.
3. **Sequential Replay:** Iterates through `pendingEvents` chronologically, mutating `serverState`:
   - `TOGGLE_ATTENDANCE`: Updates or creates attendance records (`presentStudentIds`, `absentStudentIds`, `lateStudentIds`).
   - `ADD_PAYMENT` (Concurrency Invoice Sync Resolution): Implements Last-Write-Wins (LWW) based on receipt dates to prevent duplicate monthly fee entries from multiple devices.
   - `ADD_STUDENT` / `UPDATE_STUDENT` / `DELETE_STUDENT`, `ADD_GROUP`, `SAVE_EXAM_SCORES`, etc.
4. **Data Sanitization & Secret Scrubbing:** Cleans corrupted attendance structures via `sanitizeAttendanceRecords` and strips `teacherPin` and secretary `pin` attributes before returning response.
5. **Atomic Commit:** Saves merged state back to Neon DB via `ON CONFLICT (id) DO UPDATE`.

---

## 7. BARCODE SYSTEMS & PRINTING ARCHITECTURE (ROOT CAUSE AUDIT)

### 7.1 Historical Audit & Printing Challenges
As documented in `docs/BARCODE_PRINTING_ROOT_CAUSE_AUDIT.md`, thermal receipt/label printers (Xprinter, Zebra, Phomemo) operating through browser `window.print()` suffer from major browser rendering flaws:
- **Margin Injection:** Browser print drivers inject unconfigurable top/bottom margins, causing labels to shift across physical boundaries.
- **Page Breaks & Blank Pages:** CSS `@page` rules with `48mm 101.5mm` or `101.5mm 48mm` frequently generate extra blank pages on roll thermal paper.
- **Font Scaling Issues:** SVG text rendering varies across printer DPIs.

### 7.2 Six Barcode Systems Implementation
To address all printer types, CenterFlow provides six distinct barcode modules in `/lib/`:

| Module | Strategy | Output Format | Best Use Case |
| :--- | :--- | :--- | :--- |
| `barcodeHelper.ts` | Portrait Vector SVG | HTML / Window.print | Legacy thermal printing (48mm × 101.5mm) |
| `barcodeHelperLandscape.ts` | Landscape Vector SVG | HTML / Window.print | Horizontal thermal labels (101.5mm × 48mm) |
| `barcodeHelperDynamic.ts` | Dynamic Vector SVG | HTML / Window.print | Unconstrained multi-label pages |
| `barcodeHelperBitmap.ts` | HTML5 Canvas Raster | PNG Image DataURL | Zero-margin pixel-perfect thermal printing |
| `barcodeHelperPDF.ts` | `jsPDF` Document | Content-Sized PDF | Universal PDF thermal printing |
| `barcodeHelperCompact.ts` | Ultra-Compact Canvas | PNG / ZIP Archive | Sticker generation, bulk compressed ZIPs |

### 7.3 Compact Barcode Generator (`lib/barcodeHelperCompact.ts`)
Key features:
- **Four Compactness Variants:** `COMPACT`, `EXTRA_COMPACT`, `ULTRA_COMPACT`, `ULTRA_TALL`.
- **4-Side Pixel Auto-Cropping Algorithm:** Scans rendered canvas pixel array (`getImageData`) to crop all white border space, ensuring 100% label coverage.
- **Bulk Zip Packaging (`downloadMultipleBarcodeZip`):** Uses `JSZip` to generate a compressed `.zip` containing high-resolution PNG barcode images for selected students.

---

## 8. STUDENT MANAGEMENT MODULE

### 8.1 Component (`components/StudentManager.tsx`)
Handles student registration, editing, bulk grouping, barcode label downloads, and group reassignment.

### 8.2 Key Student Fields
- `id`: Unique student code (e.g. `1001`), encoded in Code 39 barcode.
- `name`: Full Arabic name.
- `phone`: Student personal mobile.
- `parentPhone`: Parent phone number (used for automated WhatsApp messaging).
- `groupId`: Assigned group ID.
- `discount`: Monthly discount amount in EGP.
- `notes`: General student notes.

### 8.3 Student Search & Filtering
- Search by ID, name, student phone, or parent phone.
- Filter by assigned group or special cases (discounted students, students with notes).
- Sort alphabetically, by ID, or by creation date.

---

## 9. GROUP & SCHEDULE MANAGEMENT MODULE

### 9.1 Component (`components/GroupsView.tsx`)
Manages group definitions, lecture schedules, and monthly tuition pricing.

### 9.2 Key Group Fields
- `id`: Unique group identifier.
- `name`: Group name (e.g., "الصف الثالث الثانوي - مجموعة السبت والثلاثاء").
- `grade`: Academic grade level.
- `price`: Monthly fee (EGP).
- `schedule`: Array of scheduled weekly lecture times (`day`, `time`).

---

## 10. ATTENDANCE TRACKING MODULE

### 10.1 Components (`components/AttendanceView.tsx`, `components/AttendanceQuickMark.tsx`)
Provides two distinct attendance workflows:

1. **Barcode Rapid Scanner Mode (`AttendanceQuickMark.tsx`):**
   - High-speed input focused on USB/Bluetooth barcode scanner input.
   - Automatically parses scanned barcode IDs, matches student records, marks attendance as Present/Late, plays sound effects (success/warning/error beeps using Web Audio API), and triggers WhatsApp arrival alerts if configured.
2. **Batch / Manual Group Attendance (`AttendanceView.tsx`):**
   - Grid-based visual attendance register for selecting groups and lecture dates.
   - Supports manual toggle between Present (حاضر), Late (متأخر), and Absent (غائب).

---

## 11. PAYMENTS & FINANCIAL MANAGEMENT MODULE

### 11.1 Components (`components/PaymentsView.tsx`, `components/AdminPaymentsView.tsx`)
Handles monthly subscription tracking, partial payments, discounts, and custom financial receipts.

### 11.2 Payment Structure (`PaymentRecord`)
- `id`: Unique receipt ID.
- `studentId`: Foreign key to `Student.id`.
- `amount`: Paid amount (EGP).
- `month`: Targeted billing month (e.g., `"2026-08"`).
- `date`: Timestamp of payment.
- `receivedBy`: Name of teacher or secretary who accepted payment.
- `notes`: Optional payment notes.

### 11.3 Financial Reports
- Summary of total collected fees for selected months.
- Overdue fees calculator (cross-references active group prices and student discounts against paid receipts).

---

## 12. RECITATIONS (التسميع) MODULE

### 12.1 Component (`components/RecitationsView.tsx`)
Tracks frequent oral and short written quizzes (تسميع شفوي / تحريري):
- Supports creation of recitation sessions assigned to groups.
- Maximum mark definitions with individual student score entry.
- Quick status tracking: Complete, Incomplete, Absent.

---

## 13. EXAMS & ACADEMIC GRADING MODULE

### 13.1 Component (`components/ExamsView.tsx`)
Handles major monthly, midterm, and final examinations:
- Records exam title, group assignment, date, and maximum score.
- Grade entry table supporting batch mark entry and rank calculation.
- Automated score alerts to parents via WhatsApp templates.

---

## 14. STUDENT PROFILE & ACADEMIC DOSSIER

### 14.1 Component (`components/StudentProfileView.tsx`)
Comprehensive 360-degree view of an individual student:
- Personal details, group affiliation, and contact numbers.
- Complete attendance history breakdown (Present % / Absent count / Late count).
- Complete financial payment ledger.
- Examination and recitation history with average score calculations.
- Academic and behavioral notes timeline.

---

## 15. PARENT PORTAL (`/parents`)

### 15.1 Route (`app/parents/page.tsx`)
A public, unauthenticated student lookup dashboard designed for parents:
- **Search Key:** Parent inputs student ID and student/parent phone number.
- **Displayed Data:** Read-only view of student attendance records, monthly payment status, exam scores, and teacher notes.
- **Privacy:** Operates strictly on client-side state lookup or scrubbed public sync response without exposing master system settings or pins.

---

## 16. WHATSAPP TEMPLATES & AUTOMATION

### 16.1 Helper (`lib/whatsappTemplateHelper.ts`)
Facilitates direct parent communication without requiring expensive WhatsApp API credentials, using `https://wa.me/` web deep links.

### 16.2 Variable Interpolation Engine
Supported placeholder tokens in templates:
- `{studentName}`: Student full name.
- `{studentId}`: Student code.
- `{groupName}`: Group name.
- `{date}`: Event date.
- `{examTitle}`: Title of exam.
- `{score}`: Student mark.
- `{maxScore}`: Maximum possible mark.
- `{amount}`: Payment amount.
- `{month}`: Subscription month.

---

## 17. AUDIT LOGGING & ACTIVITY LOGS

### 17.1 Implementation (`StateStore.logActivity`)
Every system action (login, student creation, attendance toggle, payment entry, price update, record deletion) logs an entry:

```ts
export interface ActivityLog {
  id: string;
  timestamp: string;
  userName: string;
  role: Role;
  action: string;
  details: string;
}
```
- Logs are capped at 500 entries to maintain crisp local storage performance.
- Displayed in `SyncHubView.tsx` and `ReportsView.tsx` for teacher administrative auditing.

---

## 18. SYSTEM BACKUP, RESTORE & DATA RESET

### 18.1 Methods (`StateStore`)
- `restoreSystemData(backupJson: string)`: Validates JSON format, replaces local collections, and triggers `forceSyncWholeState()`.
- `resetSystemForProduction()`: Wipes all domain collections, restores default templates, and clears cloud database for a clean production setup.
- JSON Export: Teacher can download a full timestamped JSON backup file at any time via `SettingsView.tsx`.

---

## 19. DIAGNOSTICS & HARDWARE INTEGRATION

### 19.1 Component (`components/BarcodeDiagnostics.tsx`)
A diagnostic suite for testing hardware USB barcode scanners and thermal printers:
- Measures scanner keystroke intervals (detects fast scanner input vs slow human keyboard typing).
- Tests canvas-to-printer raster rendering.
- Displays raw ASCII scanner output for debugging invalid barcode reads.

---

## 20. UI LAYOUT & COMPONENT HIERARCHY

```
app/layout.tsx (Root Layout & Font Setup)
 └── app/page.tsx (Main Application Entry)
      ├── AuthScreen.tsx (PIN Login Screen)
      └── DashboardLayout.tsx (Main Navigation Shell)
           ├── DashboardView.tsx (Home Stats & Quick Actions)
           ├── StudentsView.tsx (Student Management & Filters)
           │    └── StudentManager.tsx (Data Table & Bulk Compact ZIP Barcode Export)
           ├── GroupsView.tsx (Group Definitions & Timetables)
           ├── AttendanceView.tsx (Batch Attendance Register)
           ├── AttendanceQuickMark.tsx (Rapid Barcode Attendance Scanner)
           ├── PaymentsView.tsx (Payment Receipts & Ledger)
           ├── AdminPaymentsView.tsx (Financial Summaries & Overdue Tracking)
           ├── RecitationsView.tsx (Oral/Written Quiz Records)
           ├── ExamsView.tsx (Exam Creation & Scoresheets)
           ├── StudentProfileView.tsx (360-Degree Student Dossier)
           ├── ReportsView.tsx (Analytics & Activity Audit Logs)
           ├── SyncHubView.tsx (Database Sync Diagnostics & Manual Replay)
           ├── UsersView.tsx (Secretary & Permission Management)
           └── SettingsView.tsx (Center Profile, Backup/Restore, WhatsApp Templates)
```

---

## 21. SECURITY, DATA SANITIZATION & PRIVACY

1. **Secret Scrubbing:** Sensitive keys (`teacherPin`, `appLockPin`, secretary `pin`) are systematically stripped before serializing state to server GET/POST API responses.
2. **Sanitization:** Attendance records with missing or corrupted array fields are normalized by `sanitizeAttendanceRecords()`.
3. **Strict Parameter Cleansing:** Input student IDs and phone numbers are sanitized using regex (`replace(/[^a-zA-Z0-9_-]/g, '_')`) before injecting into file download links or SVG elements.

---

## 22. EXTERNAL DEPENDENCIES & LIBRARIES

Key dependencies in `package.json`:
- `next`: 15.x (App Router)
- `react`, `react-dom`: 19.x
- `@neondatabase/serverless`: Neon Postgres serverless driver
- `jszip`: ZIP archive packaging for bulk barcode PNG downloads
- `jspdf`: Content-sized PDF document creation
- `lucide-react`: UI Icon library
- `framer-motion`: Transition animations

---

## 23. DATA MODELS & TYPE DEFINITIONS

Full TypeScript definitions from `lib/store.ts`:

```ts
export type Role = "teacher" | "secretary";

export interface Secretary {
  id: string;
  name: string;
  pin: string;
  phone?: string;
  fullAccess?: boolean;
}

export interface Group {
  id: string;
  name: string;
  grade: string;
  price: number;
  schedule: { day: string; time: string }[];
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  groupId: string;
  discount: number;
  notes?: string;
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  groupId: string;
  date: string;
  presentStudentIds: string[];
  absentStudentIds: string[];
  lateStudentIds?: string[];
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  date: string;
  receivedBy: string;
  notes?: string;
}

export interface RecitationRecord {
  id: string;
  groupId: string;
  date: string;
  title: string;
  maxScore: number;
  scores: Record<string, { score: number; status: "completed" | "incomplete" | "absent" }>;
}

export interface ExamRecord {
  id: string;
  groupId: string;
  date: string;
  title: string;
  maxScore: number;
  scores: Record<string, number>;
}

export interface StudentNote {
  id: string;
  studentId: string;
  date: string;
  text: string;
  author: string;
}
```

---

## 24. API SPECIFICATION

### 24.1 `GET /api/sync`
- **Purpose:** Fetches the authoritative server state from Neon PostgreSQL.
- **Auth:** Requires session cookie, `x-user-role`, or Bearer header.
- **Response `200 OK`:**
```json
{
  "status": "success",
  "payload": { ...appStateWithoutSecrets },
  "updatedAt": "2026-08-10T13:30:00.000Z"
}
```

### 24.2 `POST /api/sync`
- **Purpose:** Receives local state and pending delta sync events, executes event replay merge, and updates Neon PostgreSQL.
- **Body:**
```json
{
  "localState": { ...appState },
  "pendingEvents": [ { "id": "evt_123", "action": "ADD_STUDENT", "payload": { ... } } ],
  "forceOverwrite": false
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Cloud merging and event replay completed successfully.",
  "payload": { ...syncedStateWithoutSecrets }
}
```

---

## 25. EDGE CASES & FAILURE MODES

1. **Unconfigured `DATABASE_URL`:** System automatically falls back to offline browser mode (`status: "fallback"`) without throwing server errors.
2. **Concurrent Duplicate Invoices:** Handled via Last-Write-Wins (LWW) date comparisons in `POST /api/sync` (`ADD_PAYMENT` switch case).
3. **Corrupted Attendance Payloads:** Cleaned up automatically during GET/POST requests via `sanitizeAttendanceRecords()`.
4. **Invalid Barcode Characters:** Non-Code 39 characters are stripped out during label generation to prevent rendering crashes.

---

## 26. KNOWN BUGS, ISSUES & TECHNICAL DEBT

1. **Browser `window.print()` Thermal Label Pagination:** Legacy SVG printing methods (`barcodeHelper.ts`, `barcodeHelperLandscape.ts`) may produce blank trailing pages on certain thermal printers. **Recommended Fix:** Always use `downloadMultipleBarcodeZip` or `barcodeHelperPDF.ts`.
2. **In-Memory Delta Queue Volatility:** Pending events are stored in `inMemoryDeltaEvents` (`lib/db.ts`). If the browser tab is hard-closed before background sync executes, uncommitted events rely on state differential fallback.
3. **Single Center Row Assumption:** The sync route hardcodes `id = 'center_v1'`. Multi-tenant support would require introducing a `center_id` foreign key.

---

## 27. RECENT CHANGES (StudentManager Cleanup & Compact Zip Export)

1. **UI Cleanup (`components/StudentManager.tsx`):**
   - Removed legacy bulk print buttons (`printMultipleBarcodeLabels`, `printMultipleBarcodeLabelsLandscape`, `printMultipleBarcodeLabelsDynamic`).
   - Replaced with unified bulk compact ZIP download button (`downloadMultipleBarcodeZip` using the `COMPACT` variant).
2. **Compact Barcode ZIP Packaging (`lib/barcodeHelperCompact.ts`):**
   - Added 4-side pixel auto-cropping canvas algorithm.
   - Integrated `JSZip` for downloading high-resolution PNG barcode archives for selected student groups.

---

## 28. FUTURE EXTENSIONS & AGENT HANDOFF GUIDELINES

For AI Agents and Software Engineers continuing development on this repository:
1. **Preserve Offline-First Paradigm:** All new domain actions MUST log a `DeltaSyncEvent` via `queueDeltaSyncEvent()` in `lib/db.ts` and dispatch `triggerBackgroundSync()`.
2. **Maintain Secret Scrubbing:** Never remove secret stripping in `app/api/sync/route.ts` or `StateStore.setState`.
3. **Barcode Label Integrity:** Prefer raster Canvas or PDF barcode engines (`barcodeHelperCompact.ts`, `barcodeHelperPDF.ts`) over raw SVG `window.print()` windows to avoid thermal printer margin issues.
4. **No Direct Mutations:** Always update state via `store.setState()` or domain helper methods on `StateStore` to trigger listeners and background sync properly.

---
*End of Complete System Documentation.*
