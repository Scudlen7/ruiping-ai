const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StatsTimeRange = "7d" | "30d" | "90d" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<StatsTimeRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

/** Calendar day (YYYY-MM-DD) in China Standard Time, so evening uploads land on the right day. */
export function chinaDayKey(date: Date): string {
  return new Date(date.getTime() + CHINA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Current window and the equally long window right before it.
 * `previousStart` is null for "all", which has nothing to compare against.
 */
export function periodBounds(timeRange: StatsTimeRange, now = new Date()) {
  if (timeRange === "all") {
    return { start: new Date(0), previousStart: null };
  }
  const length = RANGE_DAYS[timeRange] * DAY_MS;
  return {
    start: new Date(now.getTime() - length),
    previousStart: new Date(now.getTime() - 2 * length),
  };
}

export type ScoredItem = { studentId: number; score: number };

export type PeriodStats = {
  /** Mean of every graded score, so each submission weighs the same. */
  averageScore: number | null;
  /** Shares of students (with at least one graded score) by their own average. */
  excellentRate: number | null;
  passingRate: number | null;
  lowScoreRate: number | null;
  /** Share of the class that submitted at least once in the window. */
  coverageRate: number | null;
  gradedStudents: number;
  submittedStudents: number;
  gradedItems: number;
};

export function computePeriodStats(
  scored: ScoredItem[],
  submittedStudentIds: Iterable<number>,
  totalStudents: number,
): PeriodStats {
  const perStudent = new Map<number, number[]>();
  for (const item of scored) {
    const scores = perStudent.get(item.studentId) ?? [];
    scores.push(item.score);
    perStudent.set(item.studentId, scores);
  }
  const studentAverages = [...perStudent.values()].map(
    (scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
  const share = (predicate: (score: number) => boolean) =>
    studentAverages.length > 0
      ? (studentAverages.filter(predicate).length / studentAverages.length) * 100
      : null;
  const submitted = new Set(submittedStudentIds).size;

  return {
    averageScore:
      scored.length > 0 ? scored.reduce((sum, item) => sum + item.score, 0) / scored.length : null,
    excellentRate: share((score) => score >= 90),
    passingRate: share((score) => score >= 60),
    lowScoreRate: share((score) => score < 60),
    coverageRate: totalStudents > 0 ? (submitted / totalStudents) * 100 : null,
    gradedStudents: studentAverages.length,
    submittedStudents: submitted,
    gradedItems: scored.length,
  };
}

export type DailyScorePoint = {
  date: string;
  assignmentAverage: number | null;
  assignmentCount: number;
  examAverage: number | null;
  examCount: number;
};

/** Per China-local day averages, kept separate for assignments and exams. */
export function buildDailyScores(
  items: Array<{ createdAt: Date; score: number; kind: "assignment" | "exam" }>,
): DailyScorePoint[] {
  const days = new Map<string, { assignment: number[]; exam: number[] }>();
  for (const item of items) {
    const key = chinaDayKey(item.createdAt);
    const day = days.get(key) ?? { assignment: [], exam: [] };
    day[item.kind].push(item.score);
    days.set(key, day);
  }
  const mean = (scores: number[]) =>
    scores.length > 0
      ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
      : null;

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      assignmentAverage: mean(day.assignment),
      assignmentCount: day.assignment.length,
      examAverage: mean(day.exam),
      examCount: day.exam.length,
    }));
}
