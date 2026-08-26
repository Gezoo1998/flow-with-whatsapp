# CENTERFLOW — SECURITY REVIEW & ONLINE-FIRST AUTHENTICATION AUDIT
**Document Reference:** `CENTERFLOW_AUTH_ONLINE_FIRST_SECURITY_REVIEW.md`  
**Date:** August 11, 2026  
**Status:** COMPLETED & REMEDIATED  

---

## 1. Executive Security Summary
During a deep architectural audit of CenterFlow's sync flow, a critical security regression was identified in `lib/serverAuth.ts`. In a previous attempt to fix a false "offline" UI indicator, server-side authentication fallback logic was introduced that directly trusted unauthenticated client-supplied HTTP headers (`x-user-role`, `x-user-id`, `x-user-name`).

This created a severe authentication bypass where any unauthenticated client could send `x-user-role: teacher` to endpoints such as `GET /api/sync` or `POST /api/sync` (including with `forceOverwrite: true`) and gain administrative access without presenting a valid server session cookie (`centerflow_session`).

**Action Taken:** The fallback trust in client-supplied role headers has been completely removed from `lib/serverAuth.ts`. The server now strictly enforces `centerflow_session` HttpOnly cookie validation as the sole authority for authentication and authorization.

---

## 2. Original Bug & Applied Solution Overview
* **Original UI Symptom:** When opening the application with internet access available, the UI displayed `🟠 مؤقت محلياً (أوفلاين)` instead of `🟢 متصل بـ Neon SQL`.
* ** Flawed Initial Patch:** Added `x-user-role`, `x-user-id`, and `x-user-name` headers to outbound `fetch("/api/sync")` requests, and modified `lib/serverAuth.ts` to accept these headers as fallback identity credentials when no session cookie was present.
* **Security Flaw Identified:** Relying on client headers turned user-controlled HTTP metadata into an authentication authority, bypassing password/PIN validation.
* **Remediated Solution:** Enforced strict server-side cookie verification for all API operations, updated client sync logic to treat 401/403 HTTP statuses as `auth_error` rather than `offline`, and maintained Neon PostgreSQL as the single online source of truth.

---

## 3. Complete Authentication & Authorization Flow

```
[ Client Browser / UI ]
        │
        ├── 1. POST /api/auth/login (PIN validation)
        │         │
        │         ▼
        │    Sets HttpOnly Cookie: centerflow_session
        │         │
        ▼         ▼
[ Automatic Cookie Transport ] ──► GET / POST /api/sync
                                           │
                                           ▼
                                 lib/serverAuth.ts
                                  (getServerSession)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                Cookie Valid                          Cookie Missing / Invalid
                        │                                     │
                        ▼                                     ▼
           Authenticated ServerSession              HTTP 401 Unauthorized
                        │                                     │
           ┌────────────┴────────────┐                        ▼
           ▼                         ▼                 UI Status: auth_error
   Role: teacher             Role: secretary           (Prompt user to log in)
           │                         │
           ▼                         ▼
   Full DB Access           Restricted DB Access
   (forceOverwrite OK)      (forceOverwrite Denied: HTTP 403)
```

---

## 4. Verification Test Matrix

| Test Case | Description | Payload / Headers | Expected HTTP Code | Actual HTTP Code | Result |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Test A** | `GET /api/sync` without session cookie | No headers / cookies | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Test B** | `GET /api/sync` with fake `x-user-role: teacher` header | Header: `x-user-role: teacher` (No cookie) | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Test C** | `POST /api/sync` unauthenticated + `forceOverwrite: true` | Body: `{ forceOverwrite: true }` (No cookie) | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Test D** | `POST /api/sync` with `x-user-role: teacher` + `forceOverwrite: true` | Header: `x-user-role: teacher` (No cookie) | `401 Unauthorized` | `401 Unauthorized` | **PASS** |
| **Test E** | `POST /api/sync` with Secretary Session Cookie + `forceOverwrite: true` | Cookie: `centerflow_session` (Secretary) | `403 Forbidden` | `403 Forbidden` | **PASS** |
| **Test F** | `POST /api/sync` with Teacher Session Cookie + `forceOverwrite: true` | Cookie: `centerflow_session` (Teacher) | `200 OK` | `200 OK` | **PASS** |

---

## 5. Security Audit of `x-user-role`, `x-user-id`, and `x-user-name`
* **Finding:** Custom headers can be forged or manipulated by any HTTP client or malicious script.
* **Verdict:** Unauthenticated custom headers must **never** serve as authentication credentials. `lib/serverAuth.ts` now ignores incoming `x-user-role` headers for authentication.
* **Client Metadata Usage:** Client state (`store.ts`) maintains user context for local UI rendering, but all remote database mutations and sync requests are strictly verified using `centerflow_session`.

---

## 6. Session Transport Analysis
* **Cookie Mechanism:** `centerflow_session` is issued by `/api/auth/login` upon successful PIN verification.
* **Cookie Flags:**
  * `HttpOnly: true` (prevents JavaScript/XSS reading)
  * `SameSite: lax` (ensures cross-site request protection)
  * `Path: /` (available across all API endpoints)
  * `Max-Age: 604800` (7 days persistence)
* **Transport Protocol:** Standard browser `fetch` calls automatically transmit `centerflow_session` on same-origin requests to `/api/sync`.

---

## 7. Security Risk & Escalation Assessment
Before remediation, the ability to specify `x-user-role: teacher` on requests without a cookie allowed:
1. Complete bypass of PIN authentication.
2. Arbitrary overwriting or resetting of PostgreSQL database state via `forceOverwrite: true`.
3. Unauthorized inspection of sensitive student, attendance, exam, and financial payment records.

Post-remediation, these risks are **completely eliminated**. Unauthenticated requests are rejected with HTTP 401, and unauthorized role actions are rejected with HTTP 403.

---

## 8. Implemented Security Remediation
1. **`lib/serverAuth.ts` Modified:** Removed lines trusting `x-user-role` and unverified `Authorization: Bearer` strings. Only valid `centerflow_session` cookies are parsed and accepted.
2. **`app/api/sync/route.ts` Preserved:** Maintains full role-based access checks (Teacher vs Secretary). Unauthenticated access yields 401; non-teacher `forceOverwrite` yields 403.
3. **`lib/store.ts` Categorization Preserved:** Network errors trigger `offline` status; HTTP 401/403 triggers `auth_error`; HTTP 500 triggers `server_error`; successful sync triggers `online`.

---

## 9. Final Security Verdict
**VERDICT: APPROVED & SECURE**
The application now satisfies all security and architectural constraints:
* `centerflow_session` cookie is the sole authority for authentication.
* No authentication bypass is possible via HTTP request headers.
* Neon PostgreSQL remains the single online source of truth.
* Offline capability remains functional with IndexedDB queuing for legitimate offline scenarios.

---

## 10. System Architecture Integrity Matrix

| Subsystem | Online Behavior | Offline Behavior | Security Boundary |
| :--- | :--- | :--- | :--- |
| **Authentication** | Validated via `centerflow_session` cookie against Neon DB PINs | Cached local session in `localStorage` | Server-enforced HttpOnly cookie |
| **Sync Status** | `online` (HTTP 200) | `offline` (Fetch error / no internet) | `auth_error` on HTTP 401/403 |
| **Data Storage** | Neon PostgreSQL (`system_data` table) | IndexedDB delta queues (`pendingDeltaSyncEvents`) | Server authorization on merge |

---

## 11. Maintenance & Operation Guidelines
1. **Never re-introduce header-based auth fallbacks** in server code.
2. Always test sync endpoints without cookies to ensure HTTP 401 is returned.
3. Ensure `/api/auth/login` is used whenever a user logs in to refresh the `centerflow_session` HttpOnly cookie.
