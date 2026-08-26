"use client";

import { 
  Student, 
  Group, 
  AttendanceRecord, 
  PaymentRecord, 
  RecitationRecord, 
  ExamRecord, 
  StudentNote 
} from "./store";
import { queueDeltaSyncEvent, DeltaSyncEvent, markDeltaEventsAsSynced } from "./db";

export interface AttributeDiff {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface DiffEntity {
  id: string;
  name: string;
  type: "student" | "group" | "payment" | "recitation" | "exam" | "studentNote" | "attendance";
  operation: "ADD" | "UPDATE" | "DELETE";
  diffs?: AttributeDiff[];
  payload?: any;
}

export interface DiffReport {
  timestamp: string;
  totalChanges: number;
  entities: DiffEntity[];
  pendingEventsCount: number;
}

const BASELINE_KEY = "teacher_center_sync_baseline_v1";

export const SyncService = {
  /**
   * Safe check for window and localStorage
   */
  isClient() {
    return typeof window !== "undefined";
  },

  /**
   * Initializes the last synced baseline with current state if none exists.
   */
  initializeBaseline(state: any) {
    if (!this.isClient()) return;
    const baseline = localStorage.getItem(BASELINE_KEY);
    if (!baseline) {
      this.saveBaseline(state);
    }
  },

  /**
   * Save the current state as the synchronized baseline.
   */
  saveBaseline(state: any) {
    if (!this.isClient()) return;
    try {
      const serialized = JSON.stringify({
        students: state.students || [],
        groups: state.groups || [],
        attendance: state.attendance || [],
        payments: state.payments || [],
        recitations: state.recitations || [],
        exams: state.exams || [],
        studentNotes: state.studentNotes || []
      });
      localStorage.setItem(BASELINE_KEY, serialized);
    } catch (e) {
      console.error("Failed to save sync baseline", e);
    }
  },

  /**
   * Retrieve the last-known baseline state from offline/browser storage.
   */
  getBaseline(): any {
    if (!this.isClient()) return null;
    try {
      const data = localStorage.getItem(BASELINE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to parse baseline", e);
    }
    return {
      students: [],
      groups: [],
      attendance: [],
      payments: [],
      recitations: [],
      exams: [],
      studentNotes: []
    };
  },

  /**
   * Force logs action into local IndexedDB event-queue.
   */
  async logAction(
    actionType: DeltaSyncEvent["action"] | any,
    payload: any
  ): Promise<DeltaSyncEvent> {
    return await queueDeltaSyncEvent(actionType, payload);
  },

  /**
   * Diff-Based Synchronization Algorithm:
   * Compares the offline updated local state against the last-synced cloud baseline.
   * Isolates newly created, updated, and deleted records at the property level.
   */
  calculateStateDiff(localState: any, pendingEvents: DeltaSyncEvent[]): DiffReport {
    const baseline = this.getBaseline() || {
      students: [],
      groups: [],
      attendance: [],
      payments: [],
      recitations: [],
      exams: [],
      studentNotes: []
    };

    const entities: DiffEntity[] = [];

    // Helper to calculate differences between two objects
    const getObjDiffs = (oldObj: any, newObj: any): AttributeDiff[] => {
      const diffs: AttributeDiff[] = [];
      const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      
      const ignoredKeys = new Set(["id", "scores", "presentStudentIds", "absentStudentIds"]);
      
      keys.forEach(k => {
        if (ignoredKeys.has(k)) return;
        
        const oldVal = oldObj[k];
        const newVal = newObj[k];
        
        // Skip comparing functions or nested objects, handle simple variables
        if (typeof oldVal === "object" || typeof newVal === "object") {
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diffs.push({ field: k, oldValue: oldVal, newValue: newVal });
          }
        } else if (oldVal !== newVal) {
          diffs.push({ field: k, oldValue: oldVal, newValue: newVal });
        }
      });
      return diffs;
    };

    // 1. STUDENTS DIFF
    const localStudents: Student[] = localState.students || [];
    const baseStudents: Student[] = baseline.students || [];
    
    // Check Added & Modified
    localStudents.forEach(st => {
      const baseSt = baseStudents.find(b => b.id === st.id);
      if (!baseSt) {
        entities.push({
          id: st.id,
          name: st.name,
          type: "student",
          operation: "ADD",
          payload: st
        });
      } else {
        const attributeDiffs = getObjDiffs(baseSt, st);
        if (attributeDiffs.length > 0) {
          entities.push({
            id: st.id,
            name: st.name,
            type: "student",
            operation: "UPDATE",
            diffs: attributeDiffs
          });
        }
      }
    });
    // Check Deleted
    baseStudents.forEach(baseSt => {
      const stillExists = localStudents.some(l => l.id === baseSt.id);
      if (!stillExists) {
        entities.push({
          id: baseSt.id,
          name: baseSt.name,
          type: "student",
          operation: "DELETE",
          payload: baseSt
        });
      }
    });

    // 2. GROUPS DIFF
    const localGroups: Group[] = localState.groups || [];
    const baseGroups: Group[] = baseline.groups || [];
    localGroups.forEach(g => {
      const baseG = baseGroups.find(b => b.id === g.id);
      if (!baseG) {
        entities.push({
          id: g.id,
          name: g.name,
          type: "group",
          operation: "ADD",
          payload: g
        });
      } else {
        const attributeDiffs = getObjDiffs(baseG, g);
        if (attributeDiffs.length > 0) {
          entities.push({
            id: g.id,
            name: g.name,
            type: "group",
            operation: "UPDATE",
            diffs: attributeDiffs
          });
        }
      }
    });
    baseGroups.forEach(baseG => {
      const stillExists = localGroups.some(l => l.id === baseG.id);
      if (!stillExists) {
        entities.push({
          id: baseG.id,
          name: baseG.name,
          type: "group",
          operation: "DELETE",
          payload: baseG
        });
      }
    });

    // 3. PAYMENTS DIFF
    const localPayments: PaymentRecord[] = localState.payments || [];
    const basePayments: PaymentRecord[] = baseline.payments || [];
    localPayments.forEach(p => {
      const baseP = basePayments.find(b => b.id === p.id);
      if (!baseP) {
        const student = localStudents.find(s => s.id === p.studentId);
        entities.push({
          id: p.id,
          name: `سند مالي بقيمة ${p.amount} ج.م للطالب ${student?.name || p.studentId}`,
          type: "payment",
          operation: "ADD",
          payload: p
        });
      }
    });
    basePayments.forEach(baseP => {
      const stillExists = localPayments.some(l => l.id === baseP.id);
      if (!stillExists) {
        entities.push({
          id: baseP.id,
          name: `سند مالي ملغي بقيمة ${baseP.amount} ج.م`,
          type: "payment",
          operation: "DELETE",
          payload: baseP
        });
      }
    });

    // 4. ATTENDANCE DIFF
    const localAtt: AttendanceRecord[] = localState.attendance || [];
    const baseAtt: AttendanceRecord[] = baseline.attendance || [];
    localAtt.forEach(att => {
      const baseItem = baseAtt.find(b => b.id === att.id);
      if (!baseItem) {
        const group = localGroups.find(g => g.id === att.groupId);
        entities.push({
          id: att.id,
          name: `كشف حضور تاريخ ${att.date} لـ ${group?.name || att.groupId}`,
          type: "attendance",
          operation: "ADD",
          payload: att
        });
      } else {
        // Compare lists
        const addedPresent = att.presentStudentIds.filter(x => !baseItem.presentStudentIds.includes(x));
        const removedPresent = baseItem.presentStudentIds.filter(x => !att.presentStudentIds.includes(x));
        if (addedPresent.length > 0 || removedPresent.length > 0) {
          const group = localGroups.find(g => g.id === att.groupId);
          entities.push({
            id: att.id,
            name: `تحضير تاريخ ${att.date} لـ ${group?.name || "المجموعة"}`,
            type: "attendance",
            operation: "UPDATE",
            diffs: [
              { field: "presentStudentIds", oldValue: baseItem.presentStudentIds, newValue: att.presentStudentIds }
            ]
          });
        }
      }
    });

    // 5. EXAMS DIFF
    const localExams: ExamRecord[] = localState.exams || [];
    const baseExams: ExamRecord[] = baseline.exams || [];
    localExams.forEach(ex => {
      const baseItem = baseExams.find(b => b.id === ex.id);
      if (!baseItem) {
        entities.push({
          id: ex.id,
          name: `امتحان جديد: ${ex.title}`,
          type: "exam",
          operation: "ADD",
          payload: ex
        });
      } else {
        const attributeDiffs = getObjDiffs(baseItem, ex);
        // Also check if scores changed
        const scoresChanged = JSON.stringify(baseItem.scores) !== JSON.stringify(ex.scores);
        if (scoresChanged) {
          attributeDiffs.push({
            field: "scores",
            oldValue: baseItem.scores,
            newValue: ex.scores
          });
        }
        if (attributeDiffs.length > 0) {
          entities.push({
            id: ex.id,
            name: ex.title,
            type: "exam",
            operation: "UPDATE",
            diffs: attributeDiffs
          });
        }
      }
    });
    baseExams.forEach(baseItem => {
      if (!localExams.some(l => l.id === baseItem.id)) {
        entities.push({
          id: baseItem.id,
          name: `امتحان محذوف: ${baseItem.title}`,
          type: "exam",
          operation: "DELETE",
          payload: baseItem
        });
      }
    });

    // 6. RECITATIONS DIFF
    const localRec: RecitationRecord[] = localState.recitations || [];
    const baseRec: RecitationRecord[] = baseline.recitations || [];
    localRec.forEach(rec => {
      const baseItem = baseRec.find(b => b.id === rec.id);
      if (!baseItem) {
        entities.push({
          id: rec.id,
          name: `سجل تسميع جديد: ${rec.title}`,
          type: "recitation",
          operation: "ADD",
          payload: rec
        });
      } else {
        const attributeDiffs = getObjDiffs(baseItem, rec);
        const scoresChanged = JSON.stringify(baseItem.scores) !== JSON.stringify(rec.scores);
        if (scoresChanged) {
          attributeDiffs.push({
            field: "scores",
            oldValue: baseItem.scores,
            newValue: rec.scores
          });
        }
        if (attributeDiffs.length > 0) {
          entities.push({
            id: rec.id,
            name: rec.title,
            type: "recitation",
            operation: "UPDATE",
            diffs: attributeDiffs
          });
        }
      }
    });
    baseRec.forEach(baseItem => {
      if (!localRec.some(l => l.id === baseItem.id)) {
        entities.push({
          id: baseItem.id,
          name: `تسميع محذوف: ${baseItem.title}`,
          type: "recitation",
          operation: "DELETE",
          payload: baseItem
        });
      }
    });

    // 7. NOTES DIFF
    const localNotes: StudentNote[] = localState.studentNotes || [];
    const baseNotes: StudentNote[] = baseline.studentNotes || [];
    localNotes.forEach(n => {
      const baseItem = baseNotes.find(b => b.id === n.id);
      if (!baseItem) {
        const student = localStudents.find(s => s.id === n.studentId);
        entities.push({
          id: n.id,
          name: `ملاحظة أكاديمية للطالب ${student?.name || n.studentId}`,
          type: "studentNote",
          operation: "ADD",
          payload: n
        });
      }
    });
    baseNotes.forEach(baseItem => {
      if (!localNotes.some(l => l.id === baseItem.id)) {
        entities.push({
          id: baseItem.id,
          name: `ملاحظة محذوفة للطالب كود ${baseItem.studentId}`,
          type: "studentNote",
          operation: "DELETE",
          payload: baseItem
        });
      }
    });

    return {
      timestamp: new Date().toISOString(),
      totalChanges: entities.length,
      entities,
      pendingEventsCount: pendingEvents.length
    };
  },

  /**
   * Finalizes synchronization:
   * 1. Updates lastSynced baseline key to match the current actual state.
   * 2. Marks all local event queue elements as synchronized database-level.
   */
  async commitSync(localState: any, eventsToMark: string[]): Promise<void> {
    this.saveBaseline(localState);
    await markDeltaEventsAsSynced(eventsToMark);
  }
};
