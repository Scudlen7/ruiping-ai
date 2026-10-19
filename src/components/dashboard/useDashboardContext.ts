import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "~/components/Toast";
import { useAuthStore } from "~/stores/authStore";
import { useTRPC } from "~/trpc/react";
import { computeDashboardMetrics } from "./metrics";
import type { DashboardNavigation, DashboardPageContext, TimeRange } from "./types";

/**
 * Loads the teacher's classes and the selected class's performance data and
 * derives everything dashboard pages render. Returns `ctx: null` until the
 * teacher profile and class list are available.
 */
export function useDashboardContext({
  selectedClassIdOverride,
  openCreateClass,
  openReviewSchedule,
}: {
  selectedClassIdOverride?: number | null;
  openCreateClass: () => void;
  openReviewSchedule: () => void;
}): { ctx: DashboardPageContext | null; isLoading: boolean } {
  const navigate = useNavigate();
  const { teacher } = useAuthStore();
  const trpc = useTRPC();
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const classesQuery = useQuery({
    ...trpc.getTeacherClasses.queryOptions(),
    enabled: !!teacher,
  });

  const classes = useMemo(() => classesQuery.data?.classes || [], [classesQuery.data]);
  const resolvedSelectedClassId = selectedClassIdOverride ?? selectedClassId;
  const selectedClass =
    classes.find((cls) => cls.id === resolvedSelectedClassId) ||
    classes.find((cls) => cls.id === selectedClassId) ||
    classes[0] ||
    null;
  const selectedClassIdForQuery = selectedClass?.id || 0;

  useEffect(() => {
    if (selectedClassIdOverride != null) {
      if (selectedClassIdOverride !== selectedClassId) setSelectedClassId(selectedClassIdOverride);
      return;
    }
    const firstClass = classes[0];
    if (!selectedClassId && firstClass) setSelectedClassId(firstClass.id);
  }, [classes, selectedClassId, selectedClassIdOverride]);

  const performanceQuery = useQuery({
    ...trpc.getClassPerformanceTrends.queryOptions({
      classId: selectedClassIdForQuery,
      timeRange,
    }),
    enabled: !!selectedClassIdForQuery,
  });

  const selectedStudentCount = selectedClass?._count.students || 0;
  const performanceData = performanceQuery.data;
  const metrics = useMemo(() => computeDashboardMetrics(performanceData), [performanceData]);

  if (!teacher || classesQuery.isLoading) {
    return { ctx: null, isLoading: !!teacher };
  }

  const withSelectedClass = (action: (classId: string) => void) => () => {
    if (!selectedClass) {
      toast.info("请先创建一个班级");
      return;
    }
    action(selectedClass.id.toString());
  };
  const classSearch = selectedClass ? { classId: selectedClass.id } : {};

  const navigation: DashboardNavigation = {
    openSelectedClass: withSelectedClass((classId) => {
      void navigate({ to: "/classes/$classId", params: { classId } });
    }),
    openUploadForSelectedClass: withSelectedClass((classId) => {
      void navigate({ to: "/classes/$classId", params: { classId }, search: { open: "upload" } });
    }),
    openSelectedStudent: (studentId) => {
      if (!selectedClass) return;
      void navigate({
        to: "/classes/$classId/students/$studentId",
        params: { classId: selectedClass.id.toString(), studentId: studentId.toString() },
      });
    },
    openCreateClass,
    openStudentsDashboard: () => void navigate({ to: "/dashboard/students" }),
    openClassesDashboard: () => void navigate({ to: "/dashboard/classes" }),
    openReportsDashboard: () => void navigate({ to: "/dashboard/reports" }),
    openTeachingMaterials: () => void navigate({ to: "/dashboard/materials" }),
    openQuestionGenerator: () => void navigate({ to: "/dashboard/question-generator", search: classSearch }),
    openDataAnalysis: () => void navigate({ to: "/dashboard/learning-analysis", search: classSearch }),
    openMistakeLibrary: () => void navigate({ to: "/dashboard/mistakes", search: classSearch }),
    openReviewSchedule,
  };

  return {
    isLoading: false,
    ctx: {
      ...metrics,
      ...navigation,
      teacher,
      classes,
      selectedClass,
      selectedClassId: selectedClassIdForQuery,
      setSelectedClassId,
      timeRange,
      setTimeRange,
      performanceData,
      totalStudents: classes.reduce((sum, cls) => sum + cls._count.students, 0),
      totalAssignments: classes.reduce((sum, cls) => sum + cls._count.assignments, 0),
      totalExams: classes.reduce((sum, cls) => sum + cls._count.exams, 0),
      selectedStudentCount,
      isPerformanceLoading: performanceQuery.isLoading,
    },
  };
}
