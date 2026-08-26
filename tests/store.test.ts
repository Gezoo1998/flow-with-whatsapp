import { vi, describe, it, expect, beforeEach } from "vitest";
import { store, AppState, Student, Group } from "../lib/store";

// Mock IndexedDB file because it uses browser-only APIs
vi.mock("../lib/db", () => {
  return {
    getAllFromStore: vi.fn(() => Promise.resolve([])),
    queueDeltaSyncEvent: vi.fn(),
    persistWholeStateToIndexedDB: vi.fn(),
    initDB: vi.fn(() => Promise.resolve({})),
  };
});

// Mock sync background service
vi.mock("../lib/syncService", () => {
  return {
    SyncService: {
      initializeBaseline: vi.fn(),
      isClient: vi.fn(() => false),
    },
  };
});

describe("StateStore Core Actions", () => {
  const cleanState: AppState = {
    subject: "mathematics",
    academicYear: "2026",
    teacherPin: "2026",
    secretaries: [
      {
        id: "sec_1",
        name: "منى أحمد",
        pin: "1234",
        active: true,
        createdAt: "2026-06-01",
      },
    ],
    groups: [
      {
        id: "g_1",
        name: "الصف الأول الثانوي",
        monthlyFee: 150,
        daysOfWeek: [0, 4],
        startTime: "16:00",
        endTime: "17:30",
        description: "مجموعة تأسيسية",
      },
    ],
    students: [
      {
        id: "s_1",
        name: "أحمد السعدني",
        phone: "01012345678",
        parentPhone: "01198765432",
        groupId: "g_1",
        notes: "طالب متفوق",
        joinDate: "2026-06-01",
        status: "active",
      },
    ],
    attendance: [],
    payments: [],
    recitations: [],
    exams: [],
    studentNotes: [],
    activityLogs: [],
    archives: [],
    whatsappTemplates: [],
    currentUserRole: null,
    currentUserId: null,
    currentUserName: null,
    lockAccessStart: "19:00",
    lockAccessEnd: "07:00",
    isLockAccessEnabled: false,
    syncStatus: "online",
  };

  beforeEach(() => {
    // Reset store state to clean template state before each test
    store.setState(cleanState);
  });

  describe("Authentication Procedures", () => {
    it("should allow teacher to login with correct PIN", () => {
      const res = store.login("2026");
      expect(res.success).toBe(true);
      expect(res.role).toBe("teacher");
      expect(store.getState().currentUserRole).toBe("teacher");
      expect(store.getState().currentUserName).toBe("المعلم (مسؤول الأستاذ)");
    });

    it("should allow active secretary to login with correct PIN", () => {
      const res = store.login("1234");
      expect(res.success).toBe(true);
      expect(res.role).toBe("secretary");
      expect(store.getState().currentUserRole).toBe("secretary");
      expect(store.getState().currentUserId).toBe("sec_1");
    });

    it("should block dynamic authentication if PIN is wrong", () => {
      const res = store.login("wrong_pin");
      expect(res.success).toBe(false);
      expect(store.getState().currentUserRole).toBeNull();
    });

    it("should successfully logout active user", () => {
      store.login("2026");
      expect(store.getState().currentUserRole).toBe("teacher");

      store.logout();
      expect(store.getState().currentUserRole).toBeNull();
      expect(store.getState().currentUserId).toBeNull();
    });
  });

  describe("Secretary Registry Operations", () => {
    it("should add a new secretary only if PIN is unique", () => {
      // Login as teacher first
      store.login("2026");
      // Add unique secretary
      const res = store.addSecretary("عصام عمر", "8888");
      expect(res.success).toBe(true);
      expect(store.getState().secretaries).toHaveLength(2);
      expect(store.getState().secretaries[1].name).toBe("عصام عمر");

      // Attempt to add duplicate PIN
      const failRes = store.addSecretary("مكرر", "8888");
      expect(failRes.success).toBe(false);
    });

    it("should successfully toggle activity status of secretary", () => {
      expect(store.getState().secretaries[0].active).toBe(true);

      // Login as teacher first
      store.login("2026");
      store.toggleSecretaryStatus("sec_1");
      expect(store.getState().secretaries[0].active).toBe(false);
    });

    it("should successfully delete a registered secretary", () => {
      // Login as teacher first
      store.login("2026");
      store.deleteSecretary("sec_1");
      expect(store.getState().secretaries).toHaveLength(0);
    });

    it("should successfully change the teacher PIN", () => {
      const res = store.updateTeacherPin("9999");
      expect(res.success).toBe(true);
      expect(store.getState().teacherPin).toBe("9999");
    });
  });

  describe("Academic Group Operations", () => {
    it("should add a new group with custom details", () => {
      const groupData = {
        name: "الصف الثالث الثانوي",
        monthlyFee: 250,
        daysOfWeek: [1, 3, 5],
        startTime: "12:00",
        endTime: "14:00",
        description: "مجموعة مكثفة",
      };

      const groupAdded = store.addGroup(groupData);
      expect(groupAdded.id).toBeDefined();
      expect(store.getState().groups).toHaveLength(2);
      expect(store.getState().groups[1].name).toBe("الصف الثالث الثانوي");
    });

    it("should update an existing group description", () => {
      store.updateGroup("g_1", { name: "تعديل المسمى", monthlyFee: 175 });
      const target = store.getState().groups.find((g) => g.id === "g_1");
      expect(target).toBeDefined();
      expect(target?.name).toBe("تعديل المسمى");
      expect(target?.monthlyFee).toBe(175);
    });

    it("should delete group and detach students from it", () => {
      expect(store.getState().students[0].groupId).toBe("g_1");
      
      store.deleteGroup("g_1");
      expect(store.getState().groups).toHaveLength(0);
      expect(store.getState().students[0].groupId).toBe("");
    });
  });

  describe("Student Registry Actions", () => {
    const freshStudent = {
      name: "جهاد عبد العزيز",
      phone: "01511112222",
      parentPhone: "01033334444",
      groupId: "g_1",
      notes: "مستوى جيد",
    };

    it("should enroll/add a student with active status", () => {
      const student = store.addStudent(freshStudent);
      expect(student.id).toBeDefined();
      expect(student.status).toBe("active");
      expect(store.getState().students).toHaveLength(2);
      expect(store.getState().students[1].name).toBe("جهاد عبد العزيز");
    });

    it("should update student phone numbers and address details", () => {
      store.updateStudent("s_1", { phone: "01288889999", notes: "تعديل تقييم" });
      const modified = store.getState().students.find((s) => s.id === "s_1");
      expect(modified?.phone).toBe("01288889999");
      expect(modified?.notes).toBe("تعديل تقييم");
    });

    it("should archive and restore a student successfully", () => {
      // Archive student
      store.archiveStudent("s_1");
      expect(store.getState().students[0].status).toBe("archived");

      // Restore student
      store.unarchiveStudent("s_1");
      expect(store.getState().students[0].status).toBe("active");
    });
  });

  describe("Subject Settings", () => {
    it("should change educational subject successfully", () => {
      store.setSubject("physics");
      expect(store.getState().subject).toBe("physics");

      store.setSubject("chemistry");
      expect(store.getState().subject).toBe("chemistry");
    });
  });
});
