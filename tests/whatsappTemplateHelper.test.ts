import { describe, it, expect } from "vitest";
import { fillWhatsAppTemplate } from "../lib/whatsappTemplateHelper";

describe("fillWhatsAppTemplate", () => {
  const dummyStudent = {
    id: "s_test",
    name: "خالد عبد الرحمن",
    groupId: "g_test",
  };

  const dummyGroup = {
    id: "g_test",
    name: "مجموعة الصف الأول الثانوي",
  };

  it("should replace name, group, and subject templates correctly", () => {
    const templateText = "مرحبا يا [اسم_الطالب]، في مجموعة [المجموعة]، مادة [المادة]";
    const result = fillWhatsAppTemplate(templateText, dummyStudent, dummyGroup, "mathematics", {
      present: 5,
      absent: 1,
      attendanceRate: 83,
      scoresStr: "امتحان: 9 من 10"
    });

    expect(result).toContain("خالد عبد الرحمن");
    expect(result).toContain("مجموعة الصف الأول الثانوي");
    expect(result).toContain("الرياضيات 📐");
  });

  it("should handle other subjects properly", () => {
    const templateText = "المادة: [المادة]";
    
    const physicsResult = fillWhatsAppTemplate(templateText, dummyStudent, dummyGroup, "physics", {
      present: 3,
      absent: 0,
      attendanceRate: 100,
      scoresStr: ""
    });
    expect(physicsResult).toContain("الفيزياء ⚡");

    const chemistryResult = fillWhatsAppTemplate(templateText, dummyStudent, dummyGroup, "chemistry", {
      present: 3,
      absent: 0,
      attendanceRate: 100,
      scoresStr: ""
    });
    expect(chemistryResult).toContain("الكيمياء 🧪");
  });

  it("should substitute stats and score placeholders accurately", () => {
    const templateText = "النسبة: [الحالة] | حضور: [حضر] | غياب: [غاب] | الدرجة:\n[الدرجة]";
    const scoresStr = "- امتحان شهر 6: 18 من 20\n- تسميع الجزء الأول: 9 من 10";
    
    const result = fillWhatsAppTemplate(templateText, dummyStudent, dummyGroup, "mathematics", {
      present: 10,
      absent: 2,
      attendanceRate: 83,
      scoresStr
    });

    expect(result).toContain("النسبة: 83%");
    expect(result).toContain("حضور: 10");
    expect(result).toContain("غياب: 2");
    expect(result).toContain(scoresStr);
  });

  it("should return fallback message for empty score string", () => {
    const templateText = "[الدرجة]";
    const result = fillWhatsAppTemplate(templateText, dummyStudent, dummyGroup, "mathematics", {
      present: 1,
      absent: 1,
      attendanceRate: 50,
      scoresStr: ""
    });

    expect(result).toBe("لا توجد درجات مسجلة للفترة المحددة.");
  });

  it("should fallback to 'غير محدد' if group is undefined", () => {
    const templateText = "المجموعة: [المجموعة]";
    const result = fillWhatsAppTemplate(templateText, dummyStudent, undefined, "mathematics", {
      present: 1,
      absent: 1,
      attendanceRate: 50,
      scoresStr: ""
    });

    expect(result).toContain("غير محدد");
  });
});
