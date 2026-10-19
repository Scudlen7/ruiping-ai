import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/trpc/root";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type TimeRange = "7d" | "30d" | "90d";

export type DashboardNavKey =
  | "overview"
  | "learning-analysis"
  | "grades"
  | "assignments"
  | "exams"
  | "knowledge-map"
  | "mistakes"
  | "materials"
  | "question-generator"
  | "students"
  | "classes"
  | "reports"
  | "messages"
  | "settings";

export type TeacherClass = RouterOutputs["getTeacherClasses"]["classes"][number];
export type ClassPerformance = RouterOutputs["getClassPerformanceTrends"];
export type PerformanceTrend = ClassPerformance["performanceTrends"][number];
export type StudentRankingRow = ClassPerformance["studentRanking"][number];
export type KnowledgeAreaSummary = ClassPerformance["knowledgeAreaAnalysis"][number] & {
  mastery: number;
};

export type TrendChartPoint = {
  date: string;
  assignmentAverage: number | null;
  assignmentCount: number;
  examAverage: number | null;
  examCount: number;
};

/** Change against the previous period of equal length; null when either side has no data. */
export type MetricDeltas = {
  averageScore: number | null;
  excellentRate: number | null;
  passingRate: number | null;
  lowScoreRate: number | null;
  coverageRate: number | null;
};

export type DashboardMetrics = {
  performanceTrends: PerformanceTrend[];
  trendChartData: TrendChartPoint[];
  /** Every student with at least one graded submission in range, best first. */
  studentRanking: StudentRankingRow[];
  /** Knowledge areas with mastery evidence, weakest first. */
  knowledgeAreas: KnowledgeAreaSummary[];
  averageScore: number | null;
  excellentRate: number | null;
  passingRate: number | null;
  lowScoreRate: number | null;
  coverageRate: number | null;
  overallMastery: number | null;
  deltas: MetricDeltas;
  hasPreviousPeriod: boolean;
  hasPerformanceData: boolean;
};

export type DashboardNavigation = {
  openSelectedClass: () => void;
  openUploadForSelectedClass: () => void;
  openSelectedStudent: (studentId: number) => void;
  openCreateClass: () => void;
  openStudentsDashboard: () => void;
  openClassesDashboard: () => void;
  openReportsDashboard: () => void;
  openTeachingMaterials: () => void;
  openQuestionGenerator: () => void;
  openDataAnalysis: () => void;
  openMistakeLibrary: () => void;
  openReviewSchedule: () => void;
};

export type DashboardPageContext = DashboardMetrics &
  DashboardNavigation & {
    teacher: { id: number; phoneNumber: string; name: string };
    classes: TeacherClass[];
    selectedClass: TeacherClass | null;
    selectedClassId: number;
    setSelectedClassId: (classId: number | null) => void;
    timeRange: TimeRange;
    setTimeRange: (range: TimeRange) => void;
    performanceData: ClassPerformance | undefined;
    totalStudents: number;
    totalAssignments: number;
    totalExams: number;
    selectedStudentCount: number;
    isPerformanceLoading: boolean;
  };
