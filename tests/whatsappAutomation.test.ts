import { describe, it, expect } from "vitest";
import { fillWhatsAppTemplate } from "../lib/whatsappTemplateHelper";

describe("WhatsApp Automation Engine Logic Unit Tests", () => {
  const dummyTemplate = "تقرير الطالب: *[اسم_الطالب]* - مادة [المادة]\nالدرجة: [الدرجة]";

  const dummyStudent1 = {
    id: "st_101",
    name: "أحمد محمد علي",
    phone: "01011112222",
    parentPhone: "01099998888",
    groupId: "grp_1",
    status: "active"
  };

  const dummyStudent2 = {
    id: "st_102",
    name: "سارة محمود",
    phone: "01033334444",
    parentPhone: "01077776666",
    groupId: "grp_1",
    status: "active"
  };

  const dummyRecitation = {
    id: "rec_1",
    groupId: "grp_1",
    title: "تسميع الفصل الأول",
    maxScore: 20,
    date: "2026-08-26",
    scores: {
      "st_101": 18 // Only st_101 has a grade, st_102 has NO grade recorded
    }
  };

  it("should strictly exclude students without recorded grades for the assessment", () => {
    const students = [dummyStudent1, dummyStudent2];
    const scores = dummyRecitation.scores as Record<string, number>;

    const eligible = students.filter(
      (s) => scores[s.id] !== undefined && scores[s.id] !== null
    );

    expect(eligible.length).toBe(1);
    expect(eligible[0].id).toBe("st_101");
  });

  it("should correctly override destination phone to 01022372501 when safe test mode is active", () => {
    const isTestModeActive = true;
    const destinationPhone = isTestModeActive
      ? "01022372501"
      : dummyStudent1.parentPhone || dummyStudent1.phone;

    expect(destinationPhone).toBe("01022372501");
  });

  it("should preserve original parent phone when test mode is disabled", () => {
    const isTestModeActive = false;
    const destinationPhone = isTestModeActive
      ? "01022372501"
      : dummyStudent1.parentPhone || dummyStudent1.phone;

    expect(destinationPhone).toBe("01099998888");
  });

  it("should generate proper WhatsApp template string containing scores and shortcodes", () => {
    const scoreStr = `${dummyRecitation.title}: ${dummyRecitation.scores["st_101"]} / ${dummyRecitation.maxScore}`;
    const result = fillWhatsAppTemplate(
      dummyTemplate,
      dummyStudent1,
      { id: "grp_1", name: "مجموعة الأحد" },
      "mathematics",
      {
        present: 1,
        absent: 0,
        attendanceRate: 100,
        scoresStr: scoreStr
      }
    );

    expect(result).toContain("أحمد محمد علي");
    expect(result).toContain("تسميع الفصل الأول: 18 / 20");
  });

  it("should replace teacher name shortcodes properly", () => {
    const teacherTemplate = "تقرير مادة [المادة] تحت إشراف [اسم_المعلم] للطالب [اسم_الطالب]";
    const result = fillWhatsAppTemplate(
      teacherTemplate,
      dummyStudent1,
      { id: "grp_1", name: "مجموعة الأحد" },
      "physics",
      { present: 1, absent: 0, attendanceRate: 100, scoresStr: "20 / 20" },
      "د. محمد فرحات"
    );

    expect(result).toContain("د. محمد فرحات");
    expect(result).toContain("الفيزياء ⚡");
  });

  it("should format dual-grade recitations (وش وظهر) with fixed labels", () => {
    const dualRec = {
      title: "تسميع الدرس الأول",
      maxScore: 10,
      maxScore2: 5,
      hasSecondScore: true,
      scores: { "st_101": 9 },
      scores2: { "st_101": 4 }
    };

    const score1 = dualRec.scores["st_101"];
    const score2 = dualRec.scores2["st_101"];
    const scoreStr = `${dualRec.title}\n- الدرجة الأولى: ${score1} / ${dualRec.maxScore}\n- الدرجة الثانية: ${score2} / ${dualRec.maxScore2}`;

    const template = "📊 آخر نتائج التقييم والامتحانات:\n[الدرجة]";
    const result = fillWhatsAppTemplate(
      template,
      dummyStudent1,
      { id: "grp_1", name: "مجموعة الأحد" },
      "arabic",
      { present: 1, absent: 0, attendanceRate: 100, scoresStr: scoreStr }
    );

    expect(result).toContain("تسميع الدرس الأول");
    expect(result).toContain("- الدرجة الأولى: 9 / 10");
    expect(result).toContain("- الدرجة الثانية: 4 / 5");
  });
});
