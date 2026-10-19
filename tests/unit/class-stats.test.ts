import { describe, expect, it } from "vitest";
import { buildDailyScores, chinaDayKey, computePeriodStats, periodBounds } from "~/lib/classStats";

describe("class stats", () => {
  it("keys days by China Standard Time", () => {
    expect(chinaDayKey(new Date("2026-09-01T15:59:00Z"))).toBe("2026-09-01");
    expect(chinaDayKey(new Date("2026-09-01T16:00:00Z"))).toBe("2026-09-02");
  });

  it("gives an equally long previous window, and none for all time", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    const { start, previousStart } = periodBounds("7d", now);
    expect(start.toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(previousStart?.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(periodBounds("all", now).previousStart).toBeNull();
  });

  it("computes rates over every graded student, not a top-N slice", () => {
    const scored = [
      { studentId: 1, score: 95 },
      { studentId: 1, score: 85 },
      { studentId: 2, score: 50 },
      ...Array.from({ length: 12 }, (_, index) => ({ studentId: 10 + index, score: 70 })),
    ];
    const stats = computePeriodStats(scored, [1, 2, ...Array.from({ length: 12 }, (_, index) => 10 + index), 99], 20);

    expect(stats.gradedStudents).toBe(14);
    expect(stats.submittedStudents).toBe(15);
    expect(stats.coverageRate).toBe(75);
    expect(stats.excellentRate).toBeCloseTo((1 / 14) * 100, 5);
    expect(stats.passingRate).toBeCloseTo((13 / 14) * 100, 5);
    expect(stats.lowScoreRate).toBeCloseTo((1 / 14) * 100, 5);
    expect(stats.averageScore).toBeCloseTo((95 + 85 + 50 + 12 * 70) / 15, 5);
  });

  it("returns nulls when nothing was graded", () => {
    const stats = computePeriodStats([], [], 0);
    expect(stats).toMatchObject({ averageScore: null, passingRate: null, coverageRate: null });
  });

  it("keeps assignment and exam averages separate per day", () => {
    const daily = buildDailyScores([
      { createdAt: new Date("2026-09-01T02:00:00Z"), score: 80, kind: "assignment" },
      { createdAt: new Date("2026-09-01T03:00:00Z"), score: 90, kind: "assignment" },
      { createdAt: new Date("2026-09-01T17:00:00Z"), score: 60, kind: "exam" },
    ]);
    expect(daily).toEqual([
      { date: "2026-09-01", assignmentAverage: 85, assignmentCount: 2, examAverage: null, examCount: 0 },
      { date: "2026-09-02", assignmentAverage: null, assignmentCount: 0, examAverage: 60, examCount: 1 },
    ]);
  });
});
