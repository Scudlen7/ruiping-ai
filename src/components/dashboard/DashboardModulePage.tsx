import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Award, CheckCircle2, Target, Users } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { DashboardShell } from "./DashboardShell";
import { computeGradeBands, describeDelta, formatPercent } from "./metrics";
import { MetricCard } from "./ui";
import type { DashboardPageContext } from "./types";
import { moduleCopy, modulesWithClassMetrics, type DashboardModule } from "./modules/config";
import { ModuleActions } from "./modules/ModuleActions";
import {
  AssignmentAnalysis,
  ExamAnalysis,
  GradesManagement,
  KnowledgeMap,
  LearningAnalysis,
} from "./modules/AnalysisSections";
import { StudentManagement } from "./modules/StudentManagement";
import { ClassManagement, ReportCenter, SettingsCenter } from "./modules/WorkspaceSections";
import { MessageCenter } from "./modules/MessageCenter";

export type { DashboardModule };

export function DashboardModulePage({ module }: { module: DashboardModule }) {
  const copy = moduleCopy[module];

  return (
    <DashboardShell
      activeNav={module}
      title={copy.title}
      subtitle={copy.subtitle}
      actions={(ctx) => <ModuleActions module={module} ctx={ctx} />}
      showCreateClassButton={module !== "classes"}
    >
      {(ctx) => <ModuleContent module={module} ctx={ctx} />}
    </DashboardShell>
  );
}

function ModuleContent({ module, ctx }: { module: DashboardModule; ctx: DashboardPageContext }) {
  const gradeBands = useMemo(() => computeGradeBands(ctx.studentRanking), [ctx.studentRanking]);

  return (
    <>
      {modulesWithClassMetrics.has(module) ? <ClassMetricCards ctx={ctx} /> : null}

      {module === "learning-analysis" ? <LearningAnalysis ctx={ctx} gradeBands={gradeBands} /> : null}
      {module === "grades" ? <GradesManagement ctx={ctx} gradeBands={gradeBands} /> : null}
      {module === "assignments" ? <AssignmentModule ctx={ctx} /> : null}
      {module === "exams" ? <ExamAnalysis ctx={ctx} /> : null}
      {module === "knowledge-map" ? <KnowledgeMap ctx={ctx} /> : null}
      {module === "students" ? <StudentManagement ctx={ctx} /> : null}
      {module === "classes" ? <ClassManagement ctx={ctx} /> : null}
      {module === "reports" ? <ReportCenter ctx={ctx} /> : null}
      {module === "messages" ? <MessageCenter /> : null}
      {module === "settings" ? <SettingsCenter ctx={ctx} /> : null}
    </>
  );
}

function useClassStudents(ctx: DashboardPageContext) {
  const trpc = useTRPC();
  const studentsQuery = useQuery({
    ...trpc.getClassStudents.queryOptions({ classId: ctx.selectedClassId }),
    enabled: !!ctx.selectedClassId,
  });
  return studentsQuery.data?.students || [];
}

function AssignmentModule({ ctx }: { ctx: DashboardPageContext }) {
  const gradedAssignments = ctx.studentRanking.reduce((sum, student) => sum + student.assignmentCount, 0);
  const avgItemsPerStudent =
    ctx.selectedStudentCount > 0 ? gradedAssignments / ctx.selectedStudentCount : null;
  return <AssignmentAnalysis ctx={ctx} avgItemsPerStudent={avgItemsPerStudent} />;
}

function ClassMetricCards({ ctx }: { ctx: DashboardPageContext }) {
  const students = useClassStudents(ctx);
  const allTimeMistakes = students.reduce(
    (sum, student) => sum + student._count.mistakes + student._count.examMistakes,
    0,
  );
  const rangeMistakes = ctx.performanceData?.summary.totalMistakes ?? 0;
  const specialCount = students.filter((student) => student.specialAttention).length;

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="班级平均分"
        value={ctx.averageScore === null ? "--" : ctx.averageScore.toFixed(1)}
        caption={ctx.selectedClass?.name || "暂无班级"}
        {...describeDelta(ctx.deltas.averageScore, "分")}
        icon={Award}
        iconClassName="bg-blue-500"
      />
      <MetricCard
        title="及格率"
        value={formatPercent(ctx.passingRate)}
        caption="个人均分 60 分及以上"
        {...describeDelta(ctx.deltas.passingRate, "%")}
        icon={CheckCircle2}
        iconClassName="bg-emerald-500"
      />
      <MetricCard
        title="所选时段错题"
        value={`${rangeMistakes}`}
        caption="作业与试卷错题"
        trend={`累计 ${allTimeMistakes}`}
        tone="neutral"
        icon={Target}
        iconClassName="bg-orange-500"
      />
      <MetricCard
        title="特别关注"
        value={`${specialCount}`}
        caption="已标记的学生"
        trend={`全班 ${students.length} 人`}
        tone="neutral"
        icon={Users}
        iconClassName="bg-violet-500"
      />
    </section>
  );
}
