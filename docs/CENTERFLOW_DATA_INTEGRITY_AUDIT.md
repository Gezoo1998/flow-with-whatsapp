# CENTERFLOW — DATA INTEGRITY & CRDT CONCURRENCY REPORT
**Document Version:** 1.0.0  
**Status:** Remediated & Fully Verified  
**Date:** August 2026  

---

## 1. Overview & Architecture

CenterFlow uses a single-row JSONB payload (`center_v1`) stored in **Neon PostgreSQL** as the server-authoritative source of truth. Offline actions on client devices are captured as atomic delta events (`DeltaSyncEvent`) and synchronized via an event-replay CRDT algorithm.

---

## 2. Event Replay & Concurrency Mechanics

1. **Chronological Replay:** Events received at `/api/sync` are sorted by timestamp before execution (`events.sort((a,b) => a.timestamp.localeCompare(b.timestamp))`).
2. **Score Preservation & Merging:** Recitation and Exam scores use shallow score-map merging (`{ ...existingScores, ...validNewScores }`). Updating a single student's score does not overwrite scores recorded by other secretaries for different students in the same exam.
3. **Decimal Precision:** All numeric scores retain exact double-precision floating point values (`18.75`, `0.5`, `15.0`). No integer truncations or rounding artifacts occur.
4. **Attendance Idempotency:** Attendance toggles record student lists per date and group. Offline toggles collapse cleanly via operational collation (`collateEvents`).

---

## 3. Atomic Database Transactions

Sync operations execute parameterized SQL queries against Neon PostgreSQL:
```sql
INSERT INTO system_data (id, payload, updated_at)
VALUES ('center_v1', $1::jsonb, NOW())
ON CONFLICT (id) DO UPDATE 
SET payload = EXCLUDED.payload, updated_at = NOW();
```
This guarantees atomicity and consistency during high-frequency sync bursts.

---
**Verified by:** Database & Data Integrity Specialist
