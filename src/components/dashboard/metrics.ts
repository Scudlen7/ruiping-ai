import type {
  ClassPerformance,
  DashboardMetrics,
  KnowledgeAreaSummary,
  MetricDeltas,
  TimeRange,
  TrendChartPoint,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

export function formatDelta(value: number | null, unit: string) {
  if (value === null) return "暂无";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}${unit}`;
}

/** "MM/DD" for a YYYY-MM-DD day key (already a China-local calendar day). */
export function formatShortDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) return `${match[2]}/${match[3]}`;
  return new Date(date).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export function dateRangeText(timeRange: TimeRange, now = new Date()) {
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - (days - 1) * DAY_MS);
  const label = (date: Date) => date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  return `${label(start)} ~ ${label(now)}`;
}

export function buildTrendChartData(daily: ClassPerformance["daily"] | undefined): TrendChartPoint[] {
  return (daily ?? []).map((day) => ({ ...day, date: formatShortDate(day.date) })).slice(-30);
}

/** Combined daily average with assignments and exams weighted by how many were graded. */
export function pointAverage(point: TrendChartPoint): number | null {
  const total = point.assignmentCount + point.examCount;
  if (total === 0) return null;
  return (
    ((point.assignmentAverage ?? 0) * point.assignmentCount + (point.examAverage ?? 0) * point.examCount) / total
  );
}

export type DeltaTone = "up" | "down" | "neutral";

/** Caption and colour for a metric card compared with the previous period. */
export function describeDelta(
  delta: number | null,
  unit: string,
  { lowerIsBetter = false }: { lowerIsBetter?: boolean } = {},
): { trend: string; tone: DeltaTone; direction: "up" | "down" | null } {
  if (delta === null) return { trend: "暂无对比", tone: "neutral", direction: null };
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return { trend: "较上期持平", tone: "neutral", direction: null };
  const improved = lowerIsBetter ? rounded < 0 : rounded > 0;
  return {
    trend: `较上期 ${formatDelta(rounded, unit)}`,
    tone: improved ? "up" : "down",
    direction: rounded > 0 ? "up" : "down",
  };
}

export type GradeBand = { label: string; min: number; color: string; count: number };

/** Buckets students by recent average score (bands are checked from the top down). */
export function computeGradeBands(ranking: Array<{ averageScore: number }>): GradeBand[] {
  const bands: GradeBand[] = [
    { label: "优秀", min: 90, color: "bg-emerald-500", count: 0 },
    { label: "良好", min: 80, color: "bg-blue-500", count: 0 },
    { label: "中等", min: 70, color: "bg-violet-500", count: 0 },
    { label: "待提升", min: 0, color: "bg-orange-500", count: 0 },
  ];
  for (const student of ranking) {
    const band = bands.find((item) => student.averageScore >= item.min);
    if (band) band.count += 1;
  }
  return bands;
}

const NO_DELTAS: MetricDeltas = {
  averageScore: null,
  excellentRate: null,
  passingRate: null,
  lowScoreRate: null,
  coverageRate: null,
};

/** All derived dashboard figures for the selected class. */
export function computeDashboardMetrics(performanceData: ClassPerformance | undefined): DashboardMetrics {
  const performanceTrends = performanceData?.performanceTrends || [];
  const studentRanking = (performanceData?.studentRanking || []).filter((student) => student.totalItems > 0);
  const knowledgeAreas = (performanceData?.knowledgeAreaAnalysis || []).filter(
    (area): area is KnowledgeAreaSummary => area.mastery !== null,
  );
  const current = performanceData?.comparison.current;
  const previous = performanceData?.comparison.previous ?? null;

  const diff = (key: keyof MetricDeltas) => {
    const now = current?.[key] ?? null;
    const before = previous?.[key] ?? null;
    return now === null || before === null ? null : now - before;
  };

  return {
    performanceTrends,
    trendChartData: buildTrendChartData(performanceData?.daily),
    studentRanking,
    knowledgeAreas,
    averageScore: current?.averageScore ?? null,
    excellentRate: current?.excellentRate ?? null,
    passingRate: current?.passingRate ?? null,
    lowScoreRate: current?.lowScoreRate ?? null,
    coverageRate: current?.coverageRate ?? null,
    overallMastery: performanceData?.summary.overallMastery ?? null,
    deltas: previous
      ? {
          averageScore: diff("averageScore"),
          excellentRate: diff("excellentRate"),
          passingRate: diff("passingRate"),
          lowScoreRate: diff("lowScoreRate"),
          coverageRate: diff("coverageRate"),
        }
      : NO_DELTAS,
    hasPreviousPeriod: previous !== null,
    hasPerformanceData: performanceTrends.length > 0,
  };
}
