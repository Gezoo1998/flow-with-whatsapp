"use client";

import { useSyncExternalStore } from "react";

let isCurrentlySyncing = false;
let activeSyncPromise: Promise<void> | null = null;
let syncTimeout: any = null;

export function sanitizeAttendanceRecords(attendance: any[]): AttendanceRecord[] {
  if (!Array.isArray(attendance)) return [];
  const validRecords: AttendanceRecord[] = [];
  const corruptedToGroup: Record<string, any[]> = {};

  attendance.forEach((rec) => {
    if (!rec) return;
    if (Array.isArray(rec.presentStudentIds) && Array.isArray(rec.absentStudentIds)) {
      validRecords.push({
        id: rec.id || `att_${Date.now()}_${Math.random()}`,
        groupId: rec.groupId || "",
        date: rec.date || "",
        presentStudentIds: rec.presentStudentIds,
        absentStudentIds: rec.absentStudentIds,
        lateStudentIds: Array.isArray(rec.lateStudentIds) ? rec.lateStudentIds : [],
      });
    } else {
      const groupId = rec.groupId || "";
      const date = rec.date || "";
      if (groupId && date) {
        const key = `${groupId}_${date}`;
        if (!corruptedToGroup[key]) {
          corruptedToGroup[key] = [];
        }
        corruptedToGroup[key].push(rec);
      }
    }
  });

  Object.entries(corruptedToGroup).forEach(([key, toggles]) => {
    const [groupId, date] = key.split("_");
    const presentStudentIds = new Set<string>();
    const absentStudentIds = new Set<string>();
    const lateStudentIds = new Set<string>();

    toggles.forEach((t) => {
      const studentId = t.studentId || t.id;
      if (!studentId) return;
      if (t.present === true) {
        presentStudentIds.add(studentId);
        absentStudentIds.delete(studentId);
        if (t.late === true) {
          lateStudentIds.add(studentId);
        }
      } else if (t.present === false) {
        absentStudentIds.add(studentId);
        presentStudentIds.delete(studentId);
        lateStudentIds.delete(studentId);
      }
    });

    const existingIndex = validRecords.findIndex(
      (r) => r.groupId === groupId && r.date === date
    );

    if (existingIndex > -1) {
      const ext = validRecords[existingIndex];
      presentStudentIds.forEach((id) => {
        if (!ext.presentStudentIds.includes(id)) ext.presentStudentIds.push(id);
        ext.absentStudentIds = ext.absentStudentIds.filter((sid: string) => sid !== id);
      });
      absentStudentIds.forEach((id) => {
        if (!ext.absentStudentIds.includes(id)) ext.absentStudentIds.push(id);
        ext.presentStudentIds = ext.presentStudentIds.filter((sid: string) => sid !== id);
        if (ext.lateStudentIds) ext.lateStudentIds = ext.lateStudentIds.filter((sid: string) => sid !== id);
      });
      lateStudentIds.forEach((id) => {
        if (ext.lateStudentIds && !ext.lateStudentIds.includes(id)) ext.lateStudentIds.push(id);
      });
    } else {
      validRecords.push({
        id: `att_${groupId}_${date}`,
        groupId,
        date,
        presentStudentIds: Array.from(presentStudentIds),
        absentStudentIds: Array.from(absentStudentIds),
        lateStudentIds: Array.from(lateStudentIds),
      });
    }
  });

  return validRecords;
}

// Types definition matching Arabic terms and requirements.
export interface Student {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  groupId: string;
  address?: string;
  customFee?: number; // اشتراك مخصص
  notes: string;
  joinDate: string;
  status: "active" | "archived";
}

export interface Group {
  id: string;
  name: string; // اسم المجموعة
  monthlyFee: number; // الاشتراك الشهري الأساسي
  daysOfWeek: number[]; // أيام الأسبوع (0 = الأحد، 1 = الإثنين...)
  startTime: string; // وقت البدء (مثال: "16:00")
  endTime: string; // وقت الانتهاء (مثال: "17:30")
  description: string;
}

export interface AttendanceRecord {
  id: string;
  groupId: string;
  date: string; // YYYY-MM-DD
  presentStudentIds: string[];
  absentStudentIds: string[];
  lateStudentIds?: string[];
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  month: string; // YYYY-MM
  amount: number;
  date: string; // YYYY-MM-DD HH:mm
  notes: string;
  recordedBy: "teacher" | "secretary";
  recordedByName: string;
}

export interface RecitationRecord {
  id: string;
  groupId: string;
  title: string; // عنوان التسميع
  maxScore: number;
  date: string; // YYYY-MM-DD
  scores: Record<string, number>; // studentId -> key, score -> value
}

export interface ExamRecord {
  id: string;
  title: string;
  maxScore: number;
  date: string; // YYYY-MM-DD
  targetGroupIds: string[]; // المجموعات المستهدفة
  description: string;
  scores: Record<string, number>; // studentId -> key, score -> value
}

export interface StudentNote {
  id: string;
  studentId: string;
  type: "academic" | "behavior" | "private"; // دراسي، سلوكي، خاص
  content: string;
  date: string; // YYYY-MM-DD HH:mm
  recordedBy: "teacher" | "secretary";
  recordedByName: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string; // YYYY-MM-DD HH:mm
  recordedByName: string; // اسم المستخدم
  userRole: "teacher" | "secretary"; // الدور
  actionType: string; // نوع العملية (امتحان، دفعة، نقل طالب، تعديل، حذف، الخ)
  studentName?: string; // الطالب المستهدف (إن وجد)
  details: string; // تفاصيل إضافية للعملية
}

export interface Secretary {
  id: string;
  name: string;
  pin: string;
  active: boolean;
  createdAt: string;
  fullAccess?: boolean;
  exemptFromLock?: boolean;
}

export interface ArchiveRecord {
  id: string;
  archiveName: string; // اسم الأرشيف (مثال: "السنة الدراسية 2024-2025")
  archivedAt: string;
  studentsCount: number;
  groupsCount: number;
  paymentsSum: number;
  data: {
    students: Student[];
    groups: Group[];
    attendance: AttendanceRecord[];
    payments: PaymentRecord[];
    recitations: RecitationRecord[];
    exams: ExamRecord[];
    studentNotes: StudentNote[];
  };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  text: string;
}

export interface AppState {
  subject: "mathematics" | "physics" | "chemistry" | "science" | "science_en" | "math" | "arabic" | "english" | "social_studies";
  teacherPin: string;
  teacherName?: string;
  secretaries: Secretary[];
  groups: Group[];
  students: Student[];
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  recitations: RecitationRecord[];
  exams: ExamRecord[];
  studentNotes: StudentNote[];
  activityLogs: ActivityLog[];
  archives: ArchiveRecord[];
  academicYear: string;
  whatsappTemplates: WhatsAppTemplate[];

  // Access scheduling locks
  lockAccessStart: string; // "19:00"
  lockAccessEnd: string; // "07:00"
  isLockAccessEnabled: boolean;
  
  // Auth state
  currentUserRole: "teacher" | "secretary" | null;
  currentUserId: string | null; // Secretary ID if Role is Secretary
  currentUserName: string | null;
  syncStatus: "online" | "syncing" | "offline" | "auth_error" | "server_error";
}

const DEFAULT_TEACHER_PIN = "2026";
const STORAGE_KEY = "teacher_center_manager_state_v1";

const INITIAL_STATE: AppState = {
  subject: "mathematics",
  teacherPin: DEFAULT_TEACHER_PIN,
  teacherName: "المعلم الفاضل",
  whatsappTemplates: [
    {
      id: "tpl_followup",
      name: "تقرير المتابعة والتقييم الدوري",
      text: "مرحبا بولي أمر الطالب: *[اسم_الطالب]* 🌸\nنرسل لحضراتكم تقرير متابعة مادة *[المادة]* لمجموعة *[المجموعة]*:\n\n📌 الحضور والمواظبة:\n- نسبة الالتزام: [الحالة]\n- حضر: [حضر] حصة | غاب: [غاب] حصة\n\n📊 آخر نتائج التقييم والامتحانات:\n[الدرجة]\n\nنشكر حسن تعاونكم للمصلحة الدراسية لولدنا. ❤️"
    },
    {
      id: "tpl_absence",
      name: "إشعار غياب فوري عن الحصة",
      text: "تنبيه غياب من *مكتب الأستاذ / [المادة]* 📣\nنود إحاطتكم علماً بأن الطالب(ة): *[اسم_الطالب]* المقيد بمجموعة: *[المجموعة]* قد غاب اليوم عن حضور موعد الحصة.\n\nيرجى التواصل معنا لتوضيح سبب الغياب، نظراً لأهمية الدروس لضمان عدم تأثر مستواه اللغوي/العلمي.\nشاكرين ومقدرين اهتمامكم ومتابعتكم. 🌸"
    },
    {
      id: "tpl_exam_score",
      name: "إشعار منفصل بنتيجة امتحان",
      text: "نتيجة امتحان مادة *[المادة]* 🎉\nإلى ولي أمر بطلنا المتميز: *[اسم_الطالب]*\nالمقيد في مجموعة: *[المجموعة]*\n\nبفضل الله، حصل ولدنا اليوم في الامتحان على درجات:\n[الدرجة]\n\nنسأل الله له دوام التوفيق والنجاح الباهر! 🌟"
    }
  ],
  secretaries: [
    {
      id: "sec_1",
      name: "الأستاذة سارة أحمد",
      pin: "1111",
      active: true,
      createdAt: "2026-06-18",
    },
    {
      id: "sec_2",
      name: "الأستاذة ياسمين خالد",
      pin: "2222",
      active: true,
      createdAt: "2026-06-18",
    }
  ],
  groups: [],
  students: [],
  attendance: [],
  payments: [],
  recitations: [],
  exams: [],
  studentNotes: [],
  activityLogs: [],
  archives: [],
  academicYear: "2026/2027",
  lockAccessStart: "19:00",
  lockAccessEnd: "07:00",
  isLockAccessEnabled: true,
  currentUserRole: null,
  currentUserId: null,
  currentUserName: null,
  syncStatus: "online",
};

export function isTimeInInterval(timeStr: string, startStr: string, endStr: string): boolean {
  const parseToMinutes = (str: string): number => {
    const [h, m] = str.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  
  const current = parseToMinutes(timeStr);
  const start = parseToMinutes(startStr);
  const end = parseToMinutes(endStr);
  
  if (start <= end) {
    // Normal interval (e.g. 08:00 to 17:00)
    return current >= start && current < end;
  } else {
    // Over midnight interval (e.g. 19:00 to 07:00)
    return current >= start || current < end;
  }
}

let storeInstanceCounter = 0;

class StateStore {
  private state: AppState;
  private listeners = new Set<(state: AppState) => void>();
  private instanceId: number;

  constructor() {
    storeInstanceCounter++;
    this.instanceId = storeInstanceCounter;
    console.log(`[STORE INSTANCE #${this.instanceId}] StateStore instantiated. Total instances: ${storeInstanceCounter}`);
    this.state = INITIAL_STATE;
    if (typeof window !== "undefined") {
      // Register online/offline event listeners for automatic reconnection sync
      window.addEventListener("online", () => {
        console.log("[Network] Connectivity restored. Re-synchronizing with Neon PostgreSQL...");
        triggerBackgroundSync(true);
      });

      window.addEventListener("offline", () => {
        console.log("[Network] Disconnected from internet event received.");
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          this.setState({ syncStatus: "offline" });
        }
      });
    }
  }

  private async loadFromIndexedDB(): Promise<void> {
    // No-op for primary state - state is driven directly by Neon cloud DB
    return Promise.resolve();
  }

  private async syncWithNeonOnLoad(): Promise<void> {
    if (!this.state.currentUserRole) {
      console.log("[OnLoad Sync] No authenticated user session in store. Skipping sync.");
      return Promise.resolve();
    }

    if (activeSyncPromise) {
      return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
      const requestId = `ONLOAD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[DIAGNOSTIC CALL] RequestID: ${requestId} | Caller: OnLoad Sync | StoreInstance: #${this.instanceId} | Origin: ${typeof window !== "undefined" ? window.location.origin : "N/A"} | Href: ${typeof window !== "undefined" ? window.location.href : "N/A"} | Visibility: ${typeof document !== "undefined" ? document.visibilityState : "N/A"} | Credentials: same-origin`);

      isCurrentlySyncing = true;
      this.setState({ syncStatus: "syncing" });
      try {
        const { getPendingDeltaSyncEvents, persistWholeStateToIndexedDB, getPersistedStateFromIndexedDB, markDeltaEventsAsSynced } = await import("./db");
        const { SyncService } = await import("./syncService");

        const storeState = this.getState();
        const pendingEvents = await getPendingDeltaSyncEvents();

        let response: Response;
        if (pendingEvents.length > 0) {
          console.log(`[${requestId}] Found ${pendingEvents.length} pending events from offline state. Pushing first...`);
          response = await fetch("/api/sync", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-sync-request-id": requestId,
            },
            credentials: "same-origin",
            body: JSON.stringify({
              localState: storeState,
              pendingEvents: pendingEvents,
            }),
          });
        } else {
          console.log(`[${requestId}] Fetching latest authoritative state from Neon DB...`);
          response = await fetch("/api/sync", {
            headers: { 
              "Content-Type": "application/json",
              "x-sync-request-id": requestId,
            },
            credentials: "same-origin",
          });
        }

        console.log(`[DIAGNOSTIC RESPONSE] RequestID: ${requestId} | HTTP Status: ${response.status} ${response.statusText}`);

        if (!this.getState().currentUserRole) {
          console.log(`[${requestId}] User logged out during sync request. Aborting sync result application.`);
          return;
        }

        if (response.ok) {
          const result = await response.json();
          if (!this.getState().currentUserRole) return;
          if (result.status === "success" && result.payload) {
            const authoritativeState = result.payload;
            const currentState = this.getState();
            const mergedState = {
              ...authoritativeState,
              currentUserRole: currentState.currentUserRole,
              currentUserId: currentState.currentUserId,
              currentUserName: currentState.currentUserName,
              syncStatus: "online" as const,
            };

            this.setState(mergedState);
            SyncService.saveBaseline(mergedState);
            await persistWholeStateToIndexedDB(mergedState);

            if (pendingEvents.length > 0) {
              const eventIds = pendingEvents.map((e) => e.id);
              await markDeltaEventsAsSynced(eventIds);
            }
            console.log("[OnLoad Sync] Successfully fetched and loaded active state from Neon DB!");
          } else if (result.status === "empty") {
            console.log("[OnLoad Sync] Neon DB is empty. Initializing with local data...");
            const currentState = this.getState();
            if (currentState.students.length > 0 || currentState.groups.length > 0) {
              await fetch("/api/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ localState: currentState, pendingEvents: [] }),
              });
              console.log("[OnLoad Sync] Populated empty Neon DB with local state!");
            }
            this.setState({ syncStatus: "online" });
          } else {
            this.setState({ syncStatus: "online" });
          }
        } else if (response.status === 401 || response.status === 403) {
          console.warn(`[OnLoad Sync] Session unauthenticated or unauthorized (HTTP ${response.status}). Setting auth_error.`);
          const cachedState = await getPersistedStateFromIndexedDB();
          if (cachedState) {
            const currentState = this.getState();
            this.setState({
              ...cachedState,
              currentUserRole: currentState.currentUserRole,
              currentUserId: currentState.currentUserId,
              currentUserName: currentState.currentUserName,
              syncStatus: "auth_error",
            });
          } else {
            this.setState({ syncStatus: "auth_error" });
          }
        } else {
          console.warn(`[OnLoad Sync] Server responded with HTTP status ${response.status}. Setting server_error.`);
          const cachedState = await getPersistedStateFromIndexedDB();
          if (cachedState) {
            const currentState = this.getState();
            this.setState({
              ...cachedState,
              currentUserRole: currentState.currentUserRole,
              currentUserId: currentState.currentUserId,
              currentUserName: currentState.currentUserName,
              syncStatus: "server_error",
            });
          } else {
            this.setState({ syncStatus: "server_error" });
          }
        }
      } catch (err) {
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        const targetStatus = isOffline ? "offline" : "server_error";
        console.warn(`[OnLoad Sync] Network exception during sync (navigator.onLine=${!isOffline}):`, err);

        try {
          const { getPersistedStateFromIndexedDB } = await import("./db");
          const cachedState = await getPersistedStateFromIndexedDB();
          if (cachedState) {
            const currentState = this.getState();
            this.setState({
              ...cachedState,
              currentUserRole: currentState.currentUserRole,
              currentUserId: currentState.currentUserId,
              currentUserName: currentState.currentUserName,
              syncStatus: targetStatus,
            });
            return;
          }
        } catch (e) {
          console.warn("[OnLoad Sync] Unable to load cached state:", e);
        }
        this.setState({ syncStatus: targetStatus });
      } finally {
        isCurrentlySyncing = false;
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
  }

  public getState = (): AppState => {
    return this.state;
  };

  public setState = (next: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => {
    const changes = typeof next === "function" ? next(this.state) : next;
    
    if (changes.attendance) {
      changes.attendance = sanitizeAttendanceRecords(changes.attendance);
    }
    const arrays: (keyof AppState)[] = ["secretaries", "groups", "students", "attendance", "payments", "recitations", "exams", "studentNotes", "activityLogs", "whatsappTemplates", "archives"];
    arrays.forEach((key) => {
      if (changes[key] !== undefined && !Array.isArray(changes[key])) {
        (changes as any)[key] = [];
      }
    });

    this.state = { ...this.state, ...changes };

    this.listeners.forEach((listener) => listener(this.state));
  };

  public subscribe = (listener: (state: AppState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public hasFullAccess = (): boolean => {
    if (this.state.currentUserRole === "teacher") return true;
    if (this.state.currentUserRole === "secretary" && this.state.currentUserId) {
      const sec = this.state.secretaries.find((s) => s.id === this.state.currentUserId);
      return !!sec?.fullAccess;
    }
    return false;
  };

  public logActivity = (actionType: string, details: string, studentName?: string) => {
    const userRole = this.state.currentUserRole || "teacher";
    const userName = this.state.currentUserName || "المعلم";
    const timeStr = new Date().toLocaleString("sv-SE", { timeZone: "Africa/Cairo" }).replace("T", " ").substring(0, 16);
    
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      recordedByName: userName,
      userRole,
      actionType,
      details,
      studentName,
    };
    
    this.setState({
      activityLogs: [newLog, ...(this.state.activityLogs || [])],
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("LOG_ACTIVITY", newLog);
    });
  };

  // --- ACTIONS ---

  // AUTH ACTIONS
  public isSecretaryAccessLocked = (secId: string): boolean => {
    if (!this.state.isLockAccessEnabled) return false;
    
    const sec = this.state.secretaries.find(s => s.id === secId);
    if (!sec) return false;
    if (sec.exemptFromLock) return false; // Allowed anytime
    
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    
    return isTimeInInterval(
      currentTimeStr,
      this.state.lockAccessStart || "19:00",
      this.state.lockAccessEnd || "07:00"
    );
  };

  public setLockAccessSettings = (isEnabled: boolean, start: string, end: string) => {
    if (this.state.currentUserRole !== "teacher") return;
    this.setState({
      isLockAccessEnabled: isEnabled,
      lockAccessStart: start,
      lockAccessEnd: end
    });
    this.logActivity("تحديث الإعدادات", `تعديل جدول إغلاق دخول السكرتارية إلى: ${isEnabled ? 'مفعل' : 'معطل'} من ${start} إلى ${end}`);
  };

  public toggleSecretaryExemptFromLock = (id: string) => {
    if (this.state.currentUserRole !== "teacher") return;
    this.setState({
      secretaries: this.state.secretaries.map((sec) =>
        sec.id === id ? { ...sec, exemptFromLock: !sec.exemptFromLock } : sec
      ),
    });
    triggerBackgroundSync(true);
    const target = this.state.secretaries.find(s => s.id === id);
    if (target) {
      this.logActivity("تحديث صلاحيات", `تعديل استثناء قفل المرور للمساعد [${target.name}] إلى ${target.exemptFromLock ? 'مفعل (يمكن الدخول دائماً)' : 'معطل (يخضع للقفل الحصصي)'}`);
    }
  };

  public checkLockoutAndAutoLogout = (): boolean => {
    if (this.state.currentUserRole === "secretary" && this.state.currentUserId) {
      if (this.isSecretaryAccessLocked(this.state.currentUserId)) {
        this.logout();
        return true; // Auto-logged out
      }
    }
    return false;
  };

  public setAuthUser = (role: "teacher" | "secretary", id: string, name: string) => {
    this.setState({
      currentUserRole: role,
      currentUserId: id,
      currentUserName: name,
    });
    this.syncWithNeonOnLoad();
  };

  public login = (pin: string): { success: boolean; message: string; role?: "teacher" | "secretary" } => {
    // 1. Check teacher PIN
    if (pin === this.state.teacherPin) {
      this.setState({
        currentUserRole: "teacher",
        currentUserId: "teacher",
        currentUserName: "المعلم (مسؤول الأستاذ)",
      });
      return { success: true, message: "تم تسجيل الدخول كمعلم بنجاح", role: "teacher" };
    }

    // 2. Check secretary PIN
    const activeSecretary = this.state.secretaries.find(
      (sec) => sec.pin === pin && sec.active
    );
    if (activeSecretary) {
      if (this.isSecretaryAccessLocked(activeSecretary.id)) {
        const formatTimeArabic = (timeStr: string) => {
          const [h, m] = timeStr.split(":").map(Number);
          const suffix = h >= 12 ? "مساءً" : "صباحاً";
          const displayHour = h % 12 === 0 ? 12 : h % 12;
          const displayMin = String(m).padStart(2, '0');
          return `${displayHour}:${displayMin} ${suffix}`;
        };
        const startFriendly = formatTimeArabic(this.state.lockAccessStart || "19:00");
        const endFriendly = formatTimeArabic(this.state.lockAccessEnd || "07:00");
        return {
          success: false,
          message: `عذراً، يمنع تسجيل الدخول خارج الأوقات المسموحة. تم قفل النظام تلقائياً من الساعة ${startFriendly} وحتى الساعة ${endFriendly} بقرار من المدير الخاص بالمنصة.`
        };
      }

      this.setState({
        currentUserRole: "secretary",
        currentUserId: activeSecretary.id,
        currentUserName: activeSecretary.name,
      });
      return { success: true, message: `تم تسجيل الدخول بالسكرتارية: ${activeSecretary.name}`, role: "secretary" };
    }

    return { success: false, message: "الرمز السري (PIN) غير صحيح!" };
  };

  public logout = () => {
    this.setState({
      currentUserRole: null,
      currentUserId: null,
      currentUserName: null,
      syncStatus: "offline",
    });
  };

  // SUBJECT CONFIG
  public setSubject = (subject: "mathematics" | "physics" | "chemistry" | "science" | "science_en" | "math" | "arabic" | "english" | "social_studies") => {
    this.setState({ subject });
    triggerBackgroundSync(true);
  };

  public setTeacherName = (name: string) => {
    this.setState({ teacherName: name });
    triggerBackgroundSync(true);
  };

  // SECRETARY ACTIONS
  public addSecretary = (name: string, pin: string, fullAccess: boolean = false) => {
    if (this.state.currentUserRole !== "teacher") {
      return { success: false, message: "عذراً! هذا الإجراء متاح للمعلم (الأدمن) فقط!" };
    }
    // Basic verification of unique pins
    const exists = this.state.secretaries.some((s) => s.pin === pin) || pin === this.state.teacherPin;
    if (exists) return { success: false, message: "الرمز السري مستخدم بالفعل!" };

    const newSec: Secretary = {
      id: `sec_${Date.now()}`,
      name,
      pin,
      active: true,
      createdAt: new Date().toISOString().split("T")[0],
      fullAccess,
    };

    this.setState({
      secretaries: [...this.state.secretaries, newSec],
    });
    triggerBackgroundSync(true);
    return { success: true, message: "تمت إضافة السكرتير بنجاح" };
  };

  public toggleSecretaryFullAccess = (id: string) => {
    if (this.state.currentUserRole !== "teacher") return;
    this.setState({
      secretaries: this.state.secretaries.map((sec) =>
        sec.id === id ? { ...sec, fullAccess: !sec.fullAccess } : sec
      ),
    });
    triggerBackgroundSync(true);
    const target = this.state.secretaries.find(s => s.id === id);
    if (target) {
      this.logActivity("تحديث صلاحيات", `تعديل صلاحيات الوصول الكامل للمساعد [${target.name}] إلى ${!target.fullAccess ? 'مفعل' : 'معطل'}`);
    }
  };

  public toggleSecretaryStatus = (id: string) => {
    if (this.state.currentUserRole !== "teacher") return;
    this.setState({
      secretaries: this.state.secretaries.map((sec) =>
        sec.id === id ? { ...sec, active: !sec.active } : sec
      ),
    });
    triggerBackgroundSync(true);
  };

  public deleteSecretary = (id: string) => {
    if (this.state.currentUserRole !== "teacher") return;
    this.setState({
      secretaries: this.state.secretaries.filter((sec) => sec.id !== id),
    });
    triggerBackgroundSync(true);
  };

  public updateTeacherPin = (newPin: string) => {
    if (!newPin || newPin.length < 3) return { success: false, message: "يجب أن يتكون الرمز من 3 أرقام على الأقل" };
    const secExists = this.state.secretaries.some((s) => s.pin === newPin);
    if (secExists) return { success: false, message: "الرمز السري مستخدم بالفعل من قِبل سكرتارية!" };
    
    this.setState({ teacherPin: newPin });
    triggerBackgroundSync(true);
    return { success: true, message: "تم تغيير رمز المعلم بنجاح" };
  };

  // GROUP ACTIONS
  public addGroup = (group: Omit<Group, "id">) => {
    const newGroup: Group = {
      ...group,
      id: `g_${Date.now()}`,
    };
    this.setState({
      groups: [...this.state.groups, newGroup],
    });
    
    // Log sync delta event
    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_GROUP", newGroup);
    });

    return newGroup;
  };

  public updateGroup = (id: string, updated: Partial<Group>) => {
    this.setState({
      groups: this.state.groups.map((g) => (g.id === id ? { ...g, ...updated } : g)),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_GROUP", { id, ...updated });
    });
  };

  public deleteGroup = (id: string) => {
    this.setState({
      groups: this.state.groups.filter((g) => g.id !== id),
      // Clean up student group references by moving to empty or keeping them
      students: this.state.students.map((st) => (st.groupId === id ? { ...st, groupId: "" } : st)),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_GROUP", { id });
    });
  };

  // STUDENT ACTIONS
  public addStudent = (student: Omit<Student, "id" | "status" | "joinDate"> & { id?: string }) => {
    let finalId = student.id;
    if (!finalId) {
      const activeIds = this.state.students || [];
      const numericPartList = activeIds
        .map((st) => {
          const match = st.id.match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter((n): n is number => n !== null && n < 100000);
      const maxId = numericPartList.length > 0 ? Math.max(...numericPartList) : 1000;
      const nextId = Math.max(1001, maxId + 1);
      finalId = `ST-${nextId}`;
    }

    const newStudent: Student = {
      ...student,
      id: finalId,
      status: "active",
      joinDate: new Date().toISOString().split("T")[0],
    };
    this.setState({
      students: [...this.state.students, newStudent],
    });

    this.logActivity("إضافة طالب", "تم إضافة الطالب بنجاح ونسبه للمجموعة", newStudent.name);

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_STUDENT", newStudent);
    });

    return newStudent;
  };

  public updateStudent = (id: string, updated: Partial<Student>) => {
    this.setState({
      students: this.state.students.map((st) => (st.id === id ? { ...st, ...updated } : st)),
    });

    const student = this.state.students.find(s => s.id === id);
    if (student) {
      this.logActivity("تعديل بيانات طالب", "تم تعديل بيانات الملف الشخصي ورقم الهاتف والأب", student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_STUDENT", { id, ...updated });
    });
  };

  public deleteStudent = (id: string) => {
    const student = this.state.students.find(s => s.id === id);
    if (student) {
      this.logActivity("حذف طالب", "حذف الطالب نهائياً من كافة سجلات المركز وحذف دفوعاته", student.name);
    }

    this.setState({
      students: this.state.students.filter((st) => st.id !== id),
      // Clean payments, exams, recitations, attendance
      payments: this.state.payments.filter((p) => p.studentId !== id),
      studentNotes: this.state.studentNotes.filter((n) => n.studentId !== id),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_STUDENT", { id });
    });
  };

  public archiveStudent = (id: string) => {
    this.setState({
      students: this.state.students.map((st) => (st.id === id ? { ...st, status: "archived" } : st)),
    });

    const student = this.state.students.find(s => s.id === id);
    if (student) {
      this.logActivity("أرشفة طالب", "نقل ملف الطالب النشط لقائمة الأرشيف العام", student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_STUDENT", { id, status: "archived" });
    });
  };

  public unarchiveStudent = (id: string) => {
    this.setState({
      students: this.state.students.map((st) => (st.id === id ? { ...st, status: "active" } : st)),
    });

    const student = this.state.students.find(s => s.id === id);
    if (student) {
      this.logActivity("إلغاء أرشفة طالب", "استعادة الطالب من الأرشيف وإعادته لوضعية النشاط", student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_STUDENT", { id, status: "active" });
    });
  };

  public transferStudent = (id: string, targetGroupId: string) => {
    this.setState({
      students: this.state.students.map((st) => (st.id === id ? { ...st, groupId: targetGroupId } : st)),
    });

    const student = this.state.students.find(s => s.id === id);
    const targetGroup = this.state.groups.find(g => g.id === targetGroupId);
    if (student) {
      const gName = targetGroup ? targetGroup.name : "بلا مجموعة";
      this.logActivity("نقلت طالب", `نقل الطالب إلى مجموعة دراسية أخرى: ${gName}`, student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_STUDENT", { id, groupId: targetGroupId });
    });
  };

  // ATTENDANCE ACTIONS
  public recordAttendance = (groupId: string, date: string, presentIds: string[], absentIds: string[], lateIds: string[] = []) => {
    const existingIndex = this.state.attendance.findIndex((att) => att.groupId === groupId && att.date === date);
    
    if (existingIndex > -1) {
      // Update
      const updatedList = [...this.state.attendance];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        lateStudentIds: lateIds,
      };
      this.setState({ attendance: updatedList });
    } else {
      // Create new
      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}`,
        groupId,
        date,
        presentStudentIds: presentIds,
        absentStudentIds: absentIds,
        lateStudentIds: lateIds,
      };
      this.setState({ attendance: [...this.state.attendance, newRecord] });
    }

    // Log Delta actions for each individual student toggle event to support event-collation sync resolving conflicts
    import("./db").then(({ queueDeltaSyncEvent }) => {
      presentIds.forEach((stId) => {
        queueDeltaSyncEvent("TOGGLE_ATTENDANCE", { id: stId, studentId: stId, date, groupId, present: true });
      });
      absentIds.forEach((stId) => {
        queueDeltaSyncEvent("TOGGLE_ATTENDANCE", { id: stId, studentId: stId, date, groupId, present: false });
      });
      lateIds.forEach((stId) => {
        queueDeltaSyncEvent("TOGGLE_ATTENDANCE", { id: stId, studentId: stId, date, groupId, present: true, late: true });
      });
    });
  };

  // PAYMENT ACTIONS
  public addPayment = (studentId: string, month: string, amount: number, notes: string) => {
    const recorderCode = this.state.currentUserRole || "teacher";
    const recorderName = this.state.currentUserName || "المعلم";

    const newPayment: PaymentRecord = {
      id: `p_${Date.now()}`,
      studentId,
      month,
      amount,
      date: new Date().toLocaleString("sv-SE", { timeZone: "Africa/Cairo" }).replace("T", " ").substring(0, 16),
      notes,
      recordedBy: recorderCode,
      recordedByName: recorderName,
    };

    this.setState({
      payments: [...this.state.payments, newPayment],
    });

    const student = this.state.students.find((s) => s.id === studentId);
    if (student) {
      this.logActivity("سجلت دفعة", `سداد اشتراك شهر [${month}]، بمبلغ ${amount} ج.م`, student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_PAYMENT", newPayment);
    });

    return newPayment;
  };

  public deletePayment = (id: string) => {
    if (this.state.currentUserRole !== "teacher") {
      return { success: false, message: "فقط المعلم يملك الصلاحية لحذف الحسابات والقسائم المالية!" };
    }

    const payment = this.state.payments.find((p) => p.id === id);
    if (payment) {
      const student = this.state.students.find((s) => s.id === payment.studentId);
      this.logActivity("حذف دفعة مالية", `إلغاء دفعة سداد بقيمة ${payment.amount} ج.م لشهر [${payment.month}]`, student?.name || "طالب محذوف");
    }

    this.setState({
      payments: this.state.payments.filter((p) => p.id !== id),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_PAYMENT", { id });
    });

    return { success: true, message: "تم حذف المعاملة المالية بنجاح!" };
  };

  // RECITATION ACTIONS (تسميع)
  public recordRecitation = (groupId: string, title: string, maxScore: number, date: string, scores: Record<string, number>) => {
    const newRec: RecitationRecord = {
      id: `rec_${Date.now()}`,
      groupId,
      title,
      maxScore,
      date,
      scores,
    };
    this.setState({
      recitations: [...this.state.recitations, newRec],
    });

    const studentCount = Object.keys(scores).length;
    this.logActivity("رصد درجات تسميع", `رصد درجات عدد ${studentCount} طلاب في تسميع [${title}] (الدرجة النهائية من ${maxScore})`);

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_RECITATION", newRec);
    });

    return newRec;
  };

  public saveRecitationScores = (recitationId: string, scores: Record<string, number>) => {
    this.setState({
      recitations: this.state.recitations.map((rec) =>
        rec.id === recitationId ? { ...rec, scores: { ...rec.scores, ...scores } } : rec
      ),
    });

    const rec = this.state.recitations.find((r) => r.id === recitationId);
    if (rec) {
      const studentCount = Object.keys(scores).length;
      this.logActivity("رصد/تحديث درجات تسميع", `رصد/تحديث درجات لـ ${studentCount} طلاب في تسميع [${rec.title}]`);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("SAVE_RECITATION_SCORES", { id: recitationId, recitationId, scores });
    });
  };

  public updateRecitation = (id: string, updates: Partial<RecitationRecord>) => {
    this.setState({
      recitations: this.state.recitations.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_RECITATION", { id, ...updates });
    });
  };

  public deleteRecitation = (id: string) => {
    if (!this.hasFullAccess()) {
      return { success: false, message: "ليس لديك صلاحية لحذف سجلات التسميع!" };
    }

    const rec = this.state.recitations.find((r) => r.id === id);
    if (rec) {
      this.logActivity("حذف سجل تسميع", `حذف سجل التسميع [${rec.title}] نهائياً مع كافة درجات الطلاب المنسوبة له`);
    }

    this.setState({
      recitations: this.state.recitations.filter((r) => r.id !== id),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_RECITATION", { id });
    });

    return { success: true, message: "تم حذف سجل التسميع بنجاح" };
  };

  // EXAM ACTIONS
  public createExam = (title: string, maxScore: number, date: string, targetGroupIds: string[], description: string) => {
    const newExam: ExamRecord = {
      id: `ex_${Date.now()}`,
      title,
      maxScore,
      date,
      targetGroupIds,
      description,
      scores: {},
    };
    this.setState({
      exams: [...this.state.exams, newExam],
    });

    this.logActivity("إنشاء اختبار تفتيشي", `إنشاء اختبار جديد بعنوان [${title}] (الدرجة النهائية من ${maxScore})`);

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_EXAM", newExam);
    });

    return newExam;
  };

  public updateExam = (id: string, updates: Partial<ExamRecord>) => {
    this.setState({
      exams: this.state.exams.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex)),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("UPDATE_EXAM", { id, ...updates });
    });
  };

  public saveExamScores = (examId: string, scores: Record<string, number>) => {
    this.setState({
      exams: this.state.exams.map((ex) => (ex.id === examId ? { ...ex, scores: { ...ex.scores, ...scores } } : ex)),
    });

    const exam = this.state.exams.find((e) => e.id === examId);
    if (exam) {
      const studentCount = Object.keys(scores).length;
      this.logActivity("عدلت درجة", `رصد/تحديث درجات لـ ${studentCount} طلاب في امتحان [${exam.title}]`);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("SAVE_EXAM_SCORES", { id: examId, scores });
    });
  };

  public deleteExam = (id: string) => {
    if (!this.hasFullAccess()) {
      return { success: false, message: "فقط المعلم يمكنه حذف الامتحانات المسجلة!" };
    }

    const exam = this.state.exams.find((e) => e.id === id);
    if (exam) {
      this.logActivity("حذف اختبار", `حذف سجل الدرجات للاختبار [${exam.title}] نهائياً`);
    }

    this.setState({
      exams: this.state.exams.filter((ex) => ex.id !== id),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_EXAM", { id });
    });

    return { success: true, message: "تم حذف الامتحان وسجل الدرجات بنجاح" };
  };

  // STUDENT NOTES
  public addStudentNote = (studentId: string, type: "academic" | "behavior" | "private", content: string) => {
    const trackerRole = this.state.currentUserRole || "teacher";
    const trackerName = this.state.currentUserName || "المعلم";

    const newNote: StudentNote = {
      id: `note_${Date.now()}`,
      studentId,
      type,
      content,
      date: new Date().toLocaleString("sv-SE", { timeZone: "Africa/Cairo" }).replace("T", " ").substring(0, 16),
      recordedBy: trackerRole,
      recordedByName: trackerName,
    };
    this.setState({
      studentNotes: [...this.state.studentNotes, newNote],
    });

    const student = this.state.students.find((s) => s.id === studentId);
    const arabicType = type === "academic" ? "أكاديمي" : type === "behavior" ? "سلوكي" : "خاص";
    if (student) {
      this.logActivity("إضافة ملاحظة", `إضافة تقرير/ملاحظة [${arabicType}]: ${content.substring(0, 30)}${content.length > 30 ? "..." : ""}`, student.name);
    }

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("ADD_NOTE", newNote);
    });

    return newNote;
  };

  public deleteStudentNote = (id: string) => {
    this.setState({
      studentNotes: this.state.studentNotes.filter((n) => n.id !== id),
    });

    import("./db").then(({ queueDeltaSyncEvent }) => {
      queueDeltaSyncEvent("DELETE_NOTE", { id });
    });
  };

  // SYSTEM ACTIONS

  // RESET ACADEMIC YEAR (إعادة تهيئة السنة الدراسية مع بقاء الطلاب أو نقلهم)
  public resetAcademicYear = (
    archiveName: string,
    studentAction: "keep" | "delete" | "archive_all",
    transferMap?: Record<string, string> // studentId -> newGroupId
  ) => {
    if (!this.hasFullAccess()) {
      return { success: false, message: "هذا الإجراء مقيد بالمعلم فقط كإجراء إنسحابي وحشي!" };
    }

    // 1. Calculate stats of data about to be archived
    const paymentsSum = this.state.payments.reduce((acc, p) => acc + p.amount, 0);
    
    // 2. Archive record creation
    const archive: ArchiveRecord = {
      id: `arch_${Date.now()}`,
      archiveName,
      archivedAt: new Date().toISOString().split("T")[0],
      studentsCount: this.state.students.length,
      groupsCount: this.state.groups.length,
      paymentsSum,
      data: {
        students: JSON.parse(JSON.stringify(this.state.students)),
        groups: JSON.parse(JSON.stringify(this.state.groups)),
        attendance: JSON.parse(JSON.stringify(this.state.attendance)),
        payments: JSON.parse(JSON.stringify(this.state.payments)),
        recitations: JSON.parse(JSON.stringify(this.state.recitations)),
        exams: JSON.parse(JSON.stringify(this.state.exams)),
        studentNotes: JSON.parse(JSON.stringify(this.state.studentNotes)),
      },
    };

    // 3. Keep, archive, delete students behavior handler
    let nextStudents: Student[] = [];
    if (studentAction === "keep") {
      nextStudents = this.state.students.map((st) => {
        const nextGroupId = transferMap && transferMap[st.id] !== undefined ? transferMap[st.id] : st.groupId;
        return {
          ...st,
          groupId: nextGroupId,
          status: "active" as const,
        };
      });
    } else if (studentAction === "archive_all") {
      nextStudents = this.state.students.map((st) => ({
        ...st,
        status: "archived" as const,
      }));
    } else {
      nextStudents = [];
    }

    // 4. Update core state clearing daily records but keeping users & groups settings
    this.setState({
      students: nextStudents,
      attendance: [],
      payments: [],
      recitations: [],
      exams: [],
      studentNotes: [],
      archives: [...this.state.archives, archive],
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    });

    this.forceSyncWholeState();
    return { success: true, message: "تمت إعادة المتغيرات وبدء السنة الدراسية ومزامنة الأرشيف التراكمي بنجاح" };
  };

  public deleteArchive = (id: string) => {
    if (!this.hasFullAccess()) {
      return { success: false, message: "المعلم وحده مسموح له حذف سجلات الأرشيف المالي والتاريخي!" };
    }
    this.setState({
      archives: this.state.archives.filter((arch) => arch.id !== id),
    });
    this.forceSyncWholeState();
    return { success: true, message: "تم حذف الأرشيف بنجاح" };
  };

  // WhatsApp Template Actions
  public updateWhatsAppTemplate = (id: string, text: string) => {
    const updated = (this.state.whatsappTemplates || []).map((t) =>
      t.id === id ? { ...t, text } : t
    );
    this.setState({ whatsappTemplates: updated });
    triggerBackgroundSync(true);
    this.logActivity("تعديل قالب رسالة", `تم تحديث قالب الرسالة للـ WhatsApp: ${id}`);
    return { success: true, message: "تم تحديث قالب الرسالة بنجاح!" };
  };

  public resetWhatsAppTemplates = () => {
    this.setState({ whatsappTemplates: INITIAL_STATE.whatsappTemplates });
    triggerBackgroundSync(true);
    this.logActivity("إعادة تعيين القوالب", "تمت استعادة قوالب رسائل واتساب الافتراضية");
    return { success: true, message: "تم استرداد قوالب واتساب الافتراضية بنجاح!" };
  };

  // RESTORE backup/json
  public restoreSystemData = (backupJson: string) => {
    try {
      const parsed = typeof backupJson === "string" ? JSON.parse(backupJson) : backupJson;
      if (
        parsed &&
        (Array.isArray(parsed.students) ||
          Array.isArray(parsed.groups) ||
          Array.isArray(parsed.recitations) ||
          Array.isArray(parsed.exams) ||
          Array.isArray(parsed.secretaries))
      ) {
        const restoredTemplates = parsed.whatsappTemplates || this.state.whatsappTemplates || INITIAL_STATE.whatsappTemplates;
        const restoredTeacherPin = parsed.teacherPin || this.state.teacherPin || INITIAL_STATE.teacherPin;

        this.setState({
          ...parsed,
          teacherPin: restoredTeacherPin,
          whatsappTemplates: restoredTemplates
        });
        this.forceSyncWholeState();
        this.logActivity("استرجاع سجلات النظام", "تمت استعادة البيانات من ملف النسخة الاحتياطية بنجاح");
        return { success: true, message: "تم استيراد نسخة البيانات الاحتياطية وتحديث النظام بنجاح!" };
      }
      return { success: false, message: "صيغة الملف المستورد غير متطابقة مع مصفوفة النظام." };
    } catch (e) {
      return { success: false, message: "فشل الاستيراد: ملف تالف أو غير صالح." };
    }
  };

  // RESET SYSTEM FOR PRODUCTION
  public resetSystemForProduction = () => {
    this.setState(INITIAL_STATE);
    this.forceSyncWholeState();
    return { success: true, message: "تم تصفير كشوف السيستم وتهيئة قاعدة البيانات للإنتاج بنجاح!" };
  };

  // Force push full state to Neon DB
  public forceSyncWholeState = async () => {
    if (typeof window === "undefined") return;
    if (!this.state.currentUserRole) {
      console.log("[ForceSync] No authenticated user session in store. Skipping force sync.");
      return;
    }
    const requestId = `FORCE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[DIAGNOSTIC CALL] RequestID: ${requestId} | Caller: forceSyncWholeState | StoreInstance: #${this.instanceId} | Origin: ${window.location.origin} | Href: ${window.location.href} | Visibility: ${document.visibilityState} | Credentials: same-origin`);
    try {
      console.log(`[${requestId}] Initiating force overwrite synchronization...`);
      const storeState = this.getState();
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-request-id": requestId,
        },
        credentials: "same-origin",
        body: JSON.stringify({
          localState: storeState,
          pendingEvents: [],
          forceOverwrite: true,
        }),
      });
      console.log(`[DIAGNOSTIC RESPONSE] RequestID: ${requestId} | HTTP Status: ${response.status} ${response.statusText}`);
      const result = await response.json();
      if (response.ok && result.status !== "fallback") {
        console.log(`[${requestId}] Entire state successfully synchronized and overwritten in Neon DB.`);
      } else {
        console.warn(`[${requestId}] Failed to force sync:`, result?.message);
      }
    } catch (e) {
      console.error(`[${requestId}] Force synchronization failed:`, e);
    }
  };
}

// Instantiate store
export const store = new StateStore();

export function hasFullAccess(state: AppState): boolean {
  if (state.currentUserRole === "teacher") return true;
  if (state.currentUserRole === "secretary" && state.currentUserId) {
    const sec = state.secretaries.find((s) => s.id === state.currentUserId);
    return !!sec?.fullAccess;
  }
  return false;
}

// UI React hook wrapper
export function useAppStore<S>(selector: (state: AppState) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

export function triggerBackgroundSync(forceMetadataSync = false) {
  if (typeof window === "undefined") return;
  if (!store.getState().currentUserRole) {
    console.log("[Background Sync] No authenticated user session in store. Skipping background sync.");
    return;
  }

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  const runSync = async () => {
    if (activeSyncPromise) {
      try {
        await activeSyncPromise;
      } catch {
        // ignore errors from active sync
      }
      if (!forceMetadataSync) return;
    }

    activeSyncPromise = (async () => {
      const requestId = `BACKGROUND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      console.log(`[DIAGNOSTIC CALL] RequestID: ${requestId} | Caller: triggerBackgroundSync | Origin: ${window.location.origin} | Href: ${window.location.href} | Visibility: ${document.visibilityState} | Credentials: same-origin`);

      isCurrentlySyncing = true;
      store.setState({ syncStatus: "syncing" });
      try {
        const { getPendingDeltaSyncEvents, markDeltaEventsAsSynced, persistWholeStateToIndexedDB } = await import("./db");

        const pendingEvents = await getPendingDeltaSyncEvents();
        if (pendingEvents.length === 0 && !forceMetadataSync) {
          store.setState({ syncStatus: "online" });
          return;
        }

        console.log(`[${requestId}] Initiating background autosync for ${pendingEvents.length} pending events (forceMetadataSync=${forceMetadataSync})...`);
        const storeState = store.getState();

        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-sync-request-id": requestId,
          },
          credentials: "same-origin",
          body: JSON.stringify({
            localState: storeState,
            pendingEvents: pendingEvents,
          }),
        });

        console.log(`[DIAGNOSTIC RESPONSE] RequestID: ${requestId} | HTTP Status: ${response.status} ${response.statusText}`);

        if (!store.getState().currentUserRole) {
          console.log(`[${requestId}] User logged out during background sync request. Aborting sync result application.`);
          return;
        }

        if (response.ok) {
          const result = await response.json();
          if (!store.getState().currentUserRole) return;
          if (result.status === "success" && result.payload) {
            const authoritativeState = result.payload;

            const mergedState = {
              ...authoritativeState,
              currentUserRole: storeState.currentUserRole,
              currentUserId: storeState.currentUserId,
              currentUserName: storeState.currentUserName,
              syncStatus: "online" as const,
            };

            // Update local state with merged database output without firing infinite background sync
            store.setState(mergedState);
            await persistWholeStateToIndexedDB(mergedState);

            const eventIds = pendingEvents.map((e) => e.id);
            if (eventIds.length > 0) {
              await markDeltaEventsAsSynced(eventIds);
            }
            console.log("[Auto-Sync] Automatically synchronized and merged with Neon PostgreSQL.");
          } else {
            console.warn("[Auto-Sync] DB non-success state returned:", result?.message);
            store.setState({ syncStatus: "server_error" });
          }
        } else if (response.status === 401 || response.status === 403) {
          console.warn(`[Auto-Sync] Server returned HTTP ${response.status}. Setting auth_error.`);
          store.setState({ syncStatus: "auth_error" });
        } else {
          console.warn(`[Auto-Sync] Server errored with status ${response.status}`);
          store.setState({ syncStatus: "server_error" });
        }
      } catch (e) {
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        const targetStatus = isOffline ? "offline" : "server_error";
        console.error(`[Auto-Sync] Automated direct background sync failed (navigator.onLine=${!isOffline}):`, e);
        store.setState({ syncStatus: targetStatus });
      } finally {
        isCurrentlySyncing = false;
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
  };

  runSync();
}

