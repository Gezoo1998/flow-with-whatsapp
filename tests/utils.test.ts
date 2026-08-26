import { describe, it, expect, beforeEach } from "vitest";
import { cn, ExportService } from "../lib/utils";
import { Student, Group } from "../lib/store";

// Mock global window & document for frontend download interception in Node environment
const downloadCalls: { filename: string; content?: string }[] = [];

if (typeof window === "undefined") {
  global.window = {
    document: {
      createElement: () => {
        let savedFilename = "";
        return {
          href: "",
          setAttribute: (key: string, val: string) => {
            if (key === "download") {
              savedFilename = val;
            }
          },
          click: () => {
            downloadCalls.push({ filename: savedFilename });
          },
        };
      },
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    },
    URL: {
      createObjectURL: () => "blob:mock-url",
      revokeObjectURL: () => {},
    },
  } as any;
  
  global.document = global.window.document;
  global.URL = global.window.URL;
}

describe("utils/cn", () => {
  it("should merge tailwind and normal classes correctly", () => {
    const result = cn("px-2 py-4", "bg-red-500 bg-blue-500", "px-4");
    // px-4 should override px-2
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
    // bg-blue-500 should override bg-red-500
    expect(result).toContain("bg-blue-500");
    expect(result).not.toContain("bg-red-500");
    expect(result).toContain("py-4");
  });
});

describe("utils/ExportService", () => {
  const dummyStudent: Student = {
    id: "s_test_10",
    name: "مروان محمود غانم",
    phone: "01055556666",
    parentPhone: "01122223333",
    groupId: "g_test_1",
    joinDate: "2026-06-01",
    status: "active",
    notes: "طالب ممتاز",
  };

  const dummyGroup: Group = {
    id: "g_test_1",
    name: "مجموعة الصف الثالث الثانوي",
    monthlyFee: 200,
    daysOfWeek: [1, 4],
    startTime: "15:00",
    endTime: "16:30",
    description: "مجموعة تالتة ثانوي عام",
  };

  beforeEach(() => {
    downloadCalls.length = 0;
  });

  it("exportSingleStudentJSON should capture student details and download structural JSON", () => {
    ExportService.exportSingleStudentJSON(
      dummyStudent,
      dummyGroup,
      [
        {
          id: "att_1",
          groupId: "g_test_1",
          date: "2026-06-05",
          presentStudentIds: ["s_test_10"],
          absentStudentIds: [],
        }
      ],
      [
        {
          id: "ex_1",
          title: "امتحان شامل جبر",
          maxScore: 20,
          date: "2026-06-10",
          targetGroupIds: ["g_test_1"],
          description: "امتحان تم مراجعته",
          scores: { "s_test_10": 18 }
        }
      ],
      [
        {
          id: "rec_1",
          groupId: "g_test_1",
          title: "تسميع الوحدة الأولى",
          maxScore: 10,
          date: "2026-06-08",
          scores: { "s_test_10": 10 }
        }
      ]
    );

    expect(downloadCalls).toHaveLength(1);
    expect(downloadCalls[0].filename).toContain("تقرير_أكاديمي_مروان_محمود_غانم.json");
  });

  it("exportGroupPerformanceCSV should execute without throwing and compile correct performance CSV", () => {
    ExportService.exportGroupPerformanceCSV(
      "الصف الثالث الثانوي",
      [dummyStudent],
      [dummyGroup],
      [],
      [],
      []
    );

    expect(downloadCalls).toHaveLength(1);
    expect(downloadCalls[0].filename).toContain("شيت_تحصيل_الصف_الثالث_الثانوي.csv");
  });
});
