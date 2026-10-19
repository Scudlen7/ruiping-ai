import { describe, expect, it } from "vitest";
import {
  buildTrendChartData,
  computeDashboardMetrics,
  computeGradeBands,
  describeDelta,
  formatDelta,
  formatPercent,
  formatShortDate,
  pointAverage,
} from "~/components/dashboard/metrics";
import type { ClassPerformance, StudentRankingRow } from "~/components/dashboard/types";
import type { PeriodStats } from "~/lib/classStats";

const student = (studentId: number, averageScore: number, totalItems = 2): StudentRankingRow =>
  ({
    studentId,
    studentName: `学生${studentId}`,
    averageScore,
    assignmentAvg: averageScore,
    examAvg: averageScore,
    totalItems,
    recentScores: [averageScore],
  }) as StudentRankingRow;

const stats = (overrides: Partial<PeriodStats>): PeriodStats => ({
  averageScore: null,
  excellentRate: null,
  passingRate: null,
  lowScoreRate: null,
  coverageRate: null,
  gradedStudents: 0,
  submittedStudents: 0,
  gradedItems: 0,
  ...overrides,
});

describe("dashboard metrics", () => {
  it("formats percentages, deltas and day keys", () => {
    expect(formatPercent(null)).toBe("--");
    expect(formatPercent(123)).toBe("100.0%");
    expect(formatDelta(2.345, "分")).toBe("+2.3分");
    expect(formatDelta(-1, "分")).toBe("-1.0分");
    expect(formatDelta(null, "分")).toBe("暂无");
    expect(formatShortDate("2026-09-05")).toBe("09/05");
  });

  it("describes changes, treating a falling low-score rate as an improvement", () => {
    expect(describeDelta(null, "分")).toEqual({ trend: "暂无对比", tone: "neutral", direction: null });
    expect(describeDelta(0.04, "分")).toEqual({ trend: "较上期持平", tone: "neutral", direction: null });
    expect(describeDelta(3.25, "分")).toMatchObject({ trend: "较上期 +3.3分", tone: "up", direction: "up" });
    expect(describeDelta(-5, "%", { lowerIsBetter: true })).toMatchObject({ tone: "up", direction: "down" });
    expect(describeDelta(5, "%", { lowerIsBetter: true })).toMatchObject({ tone: "down", direction: "up" });
  });

  it("weights the combined daily average by how many items were graded", () => {
    expect(pointAverage({ date: "09/01", assignmentAverage: 90, assignmentCount: 3, examAverage: 50, examCount: 1 })).toBe(80);
    expect(pointAverage({ date: "09/01", assignmentAverage: null, assignmentCount: 0, examAverage: 70, examCount: 2 })).toBe(70);
    expect(pointAverage({ date: "09/01", assignmentAverage: null, assignmentCount: 0, examAverage: null, examCount: 0 })).toBeNull();
  });

  it("returns no chart points instead of a preview curve when there is no data", () => {
    expect(buildTrendChartData([])).toEqual([]);
    expect(buildTrendChartData(undefined)).toEqual([]);
  });

  it("buckets students into grade bands from the top", () => {
    const bands = computeGradeBands([student(1, 95), student(2, 90), student(3, 81), student(4, 70), student(5, 10)]);
    expect(bands.map((b) => b.count)).toEqual([2, 1, 1, 1]);
  });

  it("uses server period stats and compares with the previous period", () => {
    const performance = {
      performanceTrends: [{ date: "2026-09-01", averageScore: 80, count: 2, type: "assignment" }],
      daily: [{ date: "2026-09-01", assignmentAverage: 80, assignmentCount: 2, examAverage: null, examCount: 0 }],
      studentRanking: [student(1, 95), student(2, 55), student(3, 70), student(4, 0, 0)],
      knowledgeAreaAnalysis: [
        { knowledgeAreaId: 1, name: "分数", mastery: 42, masteryStudentCount: 3, mistakeCount: 4, affectedStudentCount: 2 },
        { knowledgeAreaId: 2, name: "几何", mastery: null, masteryStudentCount: 0, mistakeCount: 1, affectedStudentCount: 1 },
      ],
      comparison: {
        current: stats({ averageScore: 80, excellentRate: 30, passingRate: 70, lowScoreRate: 30, coverageRate: 50 }),
        previous: stats({ averageScore: 75, excellentRate: 40, passingRate: 60, lowScoreRate: 40, coverageRate: 50 }),
      },
      summary: { overallMastery: 61.5 },
    } as unknown as ClassPerformance;

    const metrics = computeDashboardMetrics(performance);
    expect(metrics.studentRanking).toHaveLength(3);
    expect(metrics.averageScore).toBe(80);
    expect(metrics.coverageRate).toBe(50);
    expect(metrics.deltas).toEqual({
      averageScore: 5,
      excellentRate: -10,
      passingRate: 10,
      lowScoreRate: -10,
      coverageRate: 0,
    });
    expect(metrics.hasPreviousPeriod).toBe(true);
    expect(metrics.knowledgeAreas.map((area) => area.name)).toEqual(["分数"]);
    expect(metrics.overallMastery).toBe(61.5);
    expect(metrics.trendChartData[0]?.date).toBe("09/01");
  });

  it("has no deltas without a previous period", () => {
    const performance = {
      performanceTrends: [],
      daily: [],
      studentRanking: [],
      knowledgeAreaAnalysis: [],
      comparison: { current: stats({ averageScore: 70 }), previous: null },
      summary: { overallMastery: null },
    } as unknown as ClassPerformance;
    const metrics = computeDashboardMetrics(performance);
    expect(metrics.deltas.averageScore).toBeNull();
    expect(metrics.hasPreviousPeriod).toBe(false);
  });

  it("returns empty metrics without performance data", () => {
    const metrics = computeDashboardMetrics(undefined);
    expect(metrics.averageScore).toBeNull();
    expect(metrics.passingRate).toBeNull();
    expect(metrics.trendChartData).toEqual([]);
    expect(metrics.hasPerformanceData).toBe(false);
  });
});
