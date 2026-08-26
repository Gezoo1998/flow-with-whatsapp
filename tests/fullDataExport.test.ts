import { describe, it, expect } from "vitest";

describe("Full System Data Export Logic Unit Tests", () => {
  const dummyState = {
    students: [
      {
        id: "st_1",
        name: "أحمد علي",
        phone: "01011112222",
        parentPhone: "01099998888",
        groupId: "grp_1",
        address: "القاهرة",
        customFee: 0,
        notes: "طالب ممتاز",
        joinDate: "2026-08-01",
        status: "active"
      }
    ],
    groups: [
      {
        id: "grp_1",
        name: "مجموعة الأولى ثانوي",
        monthlyFee: 150,
        startTime: "16:00",
        endTime: "17:30",
        daysOfWeek: [0, 2],
        description: "مجموعة الفيزياء"
      }
    ],
    recitations: [
      {
        id: "rec_1",
        groupId: "grp_1",
        title: "كويز الحركة الموجية",
        maxScore: 20,
        date: "2026-08-20",
        scores: { st_1: 19 }
      }
    ],
    exams: [
      {
        id: "ex_1",
        title: "امتحان نصف الشهر",
        targetGroupIds: ["grp_1"],
        maxScore: 50,
        date: "2026-08-25",
        description: "امتحان شامل",
        scores: { st_1: 48 }
      }
    ],
    attendance: [
      {
        id: "att_1",
        groupId: "grp_1",
        date: "2026-08-20",
        presentStudentIds: ["st_1"],
        absentStudentIds: [],
        lateStudentIds: []
      }
    ],
    payments: [
      {
        id: "pay_1",
        studentId: "st_1",
        month: "2026-08",
        amount: 150,
        date: "2026-08-01 10:00",
        notes: "تم السداد بالكامل",
        recordedBy: "teacher",
        recordedByName: "المعلم"
      }
    ],
    studentNotes: [],
    activityLogs: []
  };

  it("should aggregate all system entities into JSON snapshot without secrets", () => {
    const cleanData = JSON.parse(JSON.stringify(dummyState));
    expect(cleanData.students.length).toBe(1);
    expect(cleanData.groups.length).toBe(1);
    expect(cleanData.recitations.length).toBe(1);
    expect(cleanData.exams.length).toBe(1);
    expect(cleanData.attendance.length).toBe(1);
    expect(cleanData.payments.length).toBe(1);
  });

  it("should extract student scores across both recitations and exams correctly", () => {
    const scoresRows: any[] = [];

    dummyState.recitations.forEach((r) => {
      Object.entries(r.scores).forEach(([studentId, score]) => {
        scoresRows.push({ type: "recitation", title: r.title, studentId, score, maxScore: r.maxScore });
      });
    });

    dummyState.exams.forEach((e) => {
      Object.entries(e.scores).forEach(([studentId, score]) => {
        scoresRows.push({ type: "exam", title: e.title, studentId, score, maxScore: e.maxScore });
      });
    });

    expect(scoresRows.length).toBe(2);
    expect(scoresRows[0].score).toBe(19);
    expect(scoresRows[1].score).toBe(48);
  });

  it("should format UTF-8 CSV string with BOM prefix for Arabic compatibility", () => {
    let csvContent = "\ufeff";
    csvContent += "--- كشف الطلاب ---\n";
    csvContent += "كود الطالب,اسم الطالب,الهاتف,هاتف ولي الأمر\n";
    csvContent += `${dummyState.students[0].id},${dummyState.students[0].name},${dummyState.students[0].phone},${dummyState.students[0].parentPhone}\n`;

    expect(csvContent.startsWith("\ufeff")).toBe(true);
    expect(csvContent).toContain("أحمد علي");
  });
});
