import { describe, expect, it } from "vitest";
import { assignMissingStudentIds, type RosterEntry } from "~/lib/rosterIds";

const entry = (studentName: string, studentId?: string): RosterEntry => ({
  studentName,
  studentId,
  confidence: 0.9,
  reasoning: "test",
});

describe("assignMissingStudentIds", () => {
  it("continues the detected zero-padded numbering", () => {
    const result = assignMissingStudentIds([entry("张三", "007"), entry("李四"), entry("王五", "008"), entry("赵六")]);
    expect(result.students.map((s) => s.studentId)).toEqual(["007", "009", "008", "010"]);
    expect(result.autoAssignedStudentIds).toEqual(["009", "010"]);
  });

  it("uses plain numbers when detected ids are not padded", () => {
    const result = assignMissingStudentIds([entry("张三", "2023001"), entry("李四")]);
    expect(result.students[1]?.studentId).toBe("2023002");
  });

  it("defaults to 001 when nothing was recognized", () => {
    const result = assignMissingStudentIds([entry("张三"), entry("李四")]);
    expect(result.autoAssignedStudentIds).toEqual(["001", "002"]);
  });

  it("drops blank and duplicate names", () => {
    const result = assignMissingStudentIds([entry("张三", "1"), entry("  "), entry("张三 ", "2"), entry("李四")]);
    expect(result.students.map((s) => s.studentName)).toEqual(["张三", "李四"]);
  });

  it("never hands out an id that is already taken", () => {
    const result = assignMissingStudentIds([entry("甲", "1"), entry("乙", "3"), entry("丙"), entry("丁")]);
    expect(result.students.map((s) => s.studentId)).toEqual(["1", "3", "4", "5"]);
  });
});
