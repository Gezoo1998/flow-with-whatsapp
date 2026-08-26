import { describe, it, expect } from "vitest";
import { store } from "../lib/store";

describe("Full System Backup Restoration Unit Tests", () => {
  const dummyBackup = {
    students: [
      {
        id: "st_restore_1",
        name: "طالب مسترجع 1",
        phone: "01000001111",
        parentPhone: "01000002222",
        groupId: "grp_restore_1",
        status: "active"
      }
    ],
    groups: [
      {
        id: "grp_restore_1",
        name: "مجموعة المسترجعين",
        monthlyFee: 200,
        startTime: "14:00",
        endTime: "15:30",
        daysOfWeek: [1, 3]
      }
    ],
    recitations: [
      {
        id: "rec_restore_1",
        groupId: "grp_restore_1",
        title: "تسميع المسترجع 1",
        maxScore: 10,
        date: "2026-08-26",
        scores: { st_restore_1: 10 }
      }
    ],
    exams: [
      {
        id: "ex_restore_1",
        title: "امتحان مسترجع",
        targetGroupIds: ["grp_restore_1"],
        maxScore: 100,
        date: "2026-08-26",
        scores: { st_restore_1: 95 }
      }
    ],
    secretaries: []
  };

  it("should successfully parse and restore full system data from JSON backup", () => {
    const jsonString = JSON.stringify(dummyBackup);
    const result = store.restoreSystemData(jsonString);

    expect(result.success).toBe(true);
    expect(result.message).toContain("تم استيراد نسخة البيانات الاحتياطية وتحديث النظام بنجاح");

    const state = store.getState();
    const restoredStudent = state.students.find((s) => s.id === "st_restore_1");
    expect(restoredStudent).toBeDefined();
    expect(restoredStudent?.name).toBe("طالب مسترجع 1");

    const restoredGroup = state.groups.find((g) => g.id === "grp_restore_1");
    expect(restoredGroup).toBeDefined();
    expect(restoredGroup?.name).toBe("مجموعة المسترجعين");
  });

  it("should reject corrupted or invalid JSON backup strings gracefully", () => {
    const invalidJson = "{ invalid_json: ";
    const result = store.restoreSystemData(invalidJson);

    expect(result.success).toBe(false);
    expect(result.message).toContain("فشل الاستيراد");
  });

  it("should reject JSON files missing required system array entities", () => {
    const emptyJson = JSON.stringify({ randomKey: "value" });
    const result = store.restoreSystemData(emptyJson);

    expect(result.success).toBe(false);
    expect(result.message).toContain("صيغة الملف المستورد غير متطابقة");
  });
});
