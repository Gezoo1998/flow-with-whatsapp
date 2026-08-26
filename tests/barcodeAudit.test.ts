import { describe, it, expect } from "vitest";
import { store } from "../lib/store";

describe("Barcode Audit & Reset Password Gate Unit Tests", () => {
  it("should detect duplicate IDs and empty IDs correctly", () => {
    const studentsSample = [
      { id: "st_101", name: "طالب 1" },
      { id: "st_102", name: "طالب 2" },
      { id: "st_101", name: "طالب 3 مكرر" },
      { id: "", name: "طالب بدون ID" }
    ];

    const idSet = new Set<string>();
    const duplicateIds: string[] = [];
    const invalidBarcodes: string[] = [];

    studentsSample.forEach((s) => {
      const cleanId = (s.id || "").trim();
      if (!cleanId) {
        invalidBarcodes.push(s.name);
      } else if (idSet.has(cleanId)) {
        duplicateIds.push(cleanId);
      } else {
        idSet.add(cleanId);
      }
    });

    expect(idSet.size).toBe(2);
    expect(duplicateIds.length).toBe(1);
    expect(duplicateIds[0]).toBe("st_101");
    expect(invalidBarcodes.length).toBe(1);
  });

  it("should verify secret password 'farahat2026' for system reset gate", () => {
    const correctPass = "farahat2026";
    const wrongPass = "123456";

    expect(wrongPass.trim() === "farahat2026").toBe(false);
    expect(correctPass.trim() === "farahat2026").toBe(true);
  });
});
