import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";
import { getErrorMessage } from "~/utils/trpcError";
import { useToast } from "~/components/Toast";
import { formatScore, SCORE_LEVEL_LABELS, scoreToLevel } from "~/lib/grading";
import {
  SubmissionAnalysisModal,
  type SubmissionRef,
} from "~/components/student/SubmissionAnalysisModal";
import {
  KnowledgeMasteryGrid,
  RecordListEmpty,
  SubmissionRecordList,
} from "~/components/student/SubmissionRecords";
import { DashboardShell } from "~/components/dashboard/DashboardShell";
import { EmptyState, MetricCard, ModuleButton, Panel } from "~/components/dashboard/ui";
import { StudentPerformanceChart } from "~/components/student/StudentPerformanceChart";
import { LinkedParentsPanel } from "~/components/student/LinkedParentsPanel";
import {
  Award,
  BookOpen,
  Brain,
  FileText,
  Target,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";

const ANALYSIS_POLL_INTERVAL_MS = 5000;

const studentProfileParamsSchema = z.object({
  classId: z.string(),
  studentId: z.string(),
});

export const Route = createFileRoute("/classes/$classId/students/$studentId/")({
  component: StudentProfile,
});

function StudentProfile() {
  const navigate = useNavigate();
  const { classId, studentId } = studentProfileParamsSchema.parse(
    Route.useParams(),
  );
  const classIdNumber = Number.parseInt(classId, 10);
  const studentIdNumber = Number.parseInt(studentId, 10);
  const { teacher } = useAuthStore();
  const trpc = useTRPC();
  const toast = useToast();
  const [timeRange, setTimeRange] = useState<
    "7d" | "30d" | "90d" | "1y" | "all"
  >("30d");
  const [openSubmission, setOpenSubmission] = useState<SubmissionRef | null>(
    null,
  );

  const studentQuery = useQuery({
    ...trpc.getStudentProfileData.queryOptions({
      studentId: studentIdNumber,
    }),
    retry: false,
    enabled:
      Number.isFinite(studentIdNumber) &&
      Number.isFinite(classIdNumber),
    refetchInterval: (query) =>
      (query.state.data?.statistics.pendingAnalyses ?? 0) > 0
        ? ANALYSIS_POLL_INTERVAL_MS
        : false,
  });

  const reanalyzeMutation = useMutation(
    trpc.analyzeSubmission.mutationOptions({
      onSuccess: () => {
        toast.success("已重新提交 AI 批改");
        void studentQuery.refetch();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const reanalyze = (submission: SubmissionRef) => {
    reanalyzeMutation.mutate({ ...submission });
  };

  const performanceTrendsQuery = useQuery({
    ...trpc.getStudentPerformanceTrends.queryOptions({
      studentId: studentIdNumber,
      timeRange,
    }),
    retry: false,
    enabled:
      Number.isFinite(studentIdNumber) &&
      Number.isFinite(classIdNumber),
  });

  // When background grading finishes, the score/mastery trends change too.
  const pendingAnalyses = studentQuery.data?.statistics.pendingAnalyses ?? 0;
  const previousPendingRef = useRef(pendingAnalyses);
  const refetchTrends = performanceTrendsQuery.refetch;
  useEffect(() => {
    if (pendingAnalyses < previousPendingRef.current) {
      void refetchTrends();
    }
    previousPendingRef.current = pendingAnalyses;
  }, [pendingAnalyses, refetchTrends]);

  if (!teacher) {
    return null;
  }

  const studentData = studentQuery.data?.student;
  const statistics = studentQuery.data?.statistics;
  const studentErrorMessage = studentQuery.isError
    ? getErrorMessage(studentQuery.error)
    : null;
  const studentErrorDescription =
    studentErrorMessage === "请求的资源不存在"
      ? "当前学生不存在，或当前演示账号没有权限访问这份学生档案。你可以先返回班级页，从该班学生列表进入。"
      : studentErrorMessage ||
        "当前学生不存在，或者当前演示账号没有权限访问这份学生档案。你可以先返回班级页，从该班学生列表进入。";
  const masteryPercent =
    statistics?.averageMastery != null
      ? Math.round(statistics.averageMastery * 100)
      : null;
  const averageScore = statistics?.averageScore ?? null;

  return (
    <DashboardShell
      activeNav="students"
      title={studentData?.name || "学生档案"}
      subtitle={
        studentData?.class?.name
          ? `${studentData.class.name} · 查看作业、考试、错题和知识点变化。`
          : "查看学生的学习趋势、知识掌握和阶段记录。"
      }
      selectedClassIdOverride={classIdNumber}
      onSelectedClassChange={(nextClassId) => {
        void navigate({
          to: "/classes/$classId",
          params: { classId: nextClassId.toString() },
        });
      }}
      showDateRangeBadge={false}
      actions={(ctx) => (
        <>
          <ModuleButton
            icon={BookOpen}
            onClick={() =>
              void navigate({
                to: "/classes/$classId",
                params: { classId },
              })
            }
          >
            返回班级
          </ModuleButton>
          <ModuleButton icon={Upload} onClick={ctx.openUploadForSelectedClass}>
            上传作业
          </ModuleButton>
          <ModuleButton icon={Brain} onClick={ctx.openQuestionGenerator}>
            题目生成
          </ModuleButton>
        </>
      )}
    >
      {() => {
        if (studentQuery.isLoading && !studentData && !studentQuery.isError) {
          return (
            <div className="space-y-6">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white"
                />
              ))}
            </div>
          );
        }

        if (studentQuery.isError) {
          return (
            <EmptyState
              icon={User}
              title="无法查看该学生资料"
              description={studentErrorDescription}
            />
          );
        }

        if (!studentData) {
          return (
            <EmptyState
              icon={User}
              title="未找到学生"
              description="当前学生不存在，或者你没有访问该学生资料的权限。"
            />
          );
        }

        return (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="提交记录"
                value={`${(statistics?.totalAssignments || 0) + (statistics?.totalExams || 0)}`}
                caption={`作业 ${statistics?.totalAssignments || 0} · 试卷 ${statistics?.totalExams || 0}`}
                trend={
                  pendingAnalyses > 0
                    ? `${pendingAnalyses} 份批改中`
                    : "全部已处理"
                }
                tone={pendingAnalyses > 0 ? "neutral" : "up"}
                icon={FileText}
                iconClassName="bg-blue-500"
              />
              <MetricCard
                title="平均得分"
                value={formatScore(averageScore)}
                caption="百分制，作业与试卷合并"
                trend={
                  averageScore !== null
                    ? SCORE_LEVEL_LABELS[scoreToLevel(averageScore)]
                    : "暂无已批改记录"
                }
                tone={
                  averageScore === null
                    ? "neutral"
                    : averageScore >= 80
                      ? "up"
                      : averageScore < 60
                        ? "down"
                        : "neutral"
                }
                icon={Award}
                iconClassName="bg-violet-500"
              />
              <MetricCard
                title="错题总数"
                value={`${statistics?.totalMistakes || 0}`}
                caption="需要继续跟进"
                trend={
                  (statistics?.totalMistakes || 0) > 0 ? "建议复盘" : "状态稳定"
                }
                tone={(statistics?.totalMistakes || 0) > 0 ? "down" : "up"}
                icon={Target}
                iconClassName="bg-orange-500"
              />
              <MetricCard
                title="平均掌握度"
                value={masteryPercent !== null ? `${masteryPercent}%` : "—"}
                caption="知识点整体水平"
                trend={
                  masteryPercent === null
                    ? "暂无数据"
                    : masteryPercent >= 70
                      ? "保持巩固"
                      : "继续提升"
                }
                tone={
                  masteryPercent !== null && masteryPercent >= 70
                    ? "up"
                    : "neutral"
                }
                icon={TrendingUp}
                iconClassName="bg-emerald-500"
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <StudentPerformanceChart
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  data={performanceTrendsQuery.data}
                />
              </div>

              <div className="space-y-6 xl:col-span-4">
                <Panel title="学生信息" subtitle="基础资料与当前归属班级">
                  <div className="space-y-4 text-sm">
                    <DetailRow label="姓名" value={studentData.name} />
                    <DetailRow
                      label="学号"
                      value={studentData.studentId || "暂无学号"}
                    />
                    <DetailRow
                      label="班级"
                      value={studentData.class?.name || "-"}
                    />
                    <DetailRow
                      label="邮箱"
                      value={studentData.email || "暂无邮箱"}
                    />
                    <DetailRow
                      label="加入时间"
                      value={new Date(studentData.createdAt).toLocaleDateString(
                        "zh-CN",
                      )}
                    />
                  </div>
                </Panel>

                {studentQuery.data?.linkedParents ? (
                  <LinkedParentsPanel
                    studentId={studentData.id}
                    studentName={studentData.name}
                    parents={studentQuery.data.linkedParents}
                    onChanged={() => void studentQuery.refetch()}
                  />
                ) : null}

                <Panel title="错题高频" subtitle="近期最需要优先复盘的知识点">
                  {statistics?.mistakesByKnowledgeArea &&
                  statistics.mistakesByKnowledgeArea.length > 0 ? (
                    <div className="space-y-3">
                      {statistics.mistakesByKnowledgeArea
                        .slice(0, 5)
                        .map((area) => (
                          <div
                            key={area.name}
                            className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                                  <Brain className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                  {area.name}
                                </span>
                              </div>
                              <span className="text-sm font-bold text-orange-600">
                                {area.count} 次
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
                      <Target className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        暂无错题记录
                      </p>
                    </div>
                  )}
                </Panel>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Panel
                title="最近作业"
                subtitle="最近 5 份作业的批改状态与得分"
                className="xl:col-span-6"
              >
                {studentData.assignments.length > 0 ? (
                  <SubmissionRecordList
                    items={studentData.assignments
                      .slice(0, 5)
                      .map((assignment) => ({
                        id: assignment.id,
                        kind: "assignment" as const,
                        title: assignment.title,
                        date: new Date(assignment.createdAt).toLocaleDateString(
                          "zh-CN",
                        ),
                        status: assignment.analysisStatus,
                        error: assignment.analysisError,
                        score: assignment.analysis?.score ?? null,
                        type: "作业",
                      }))}
                    onOpen={setOpenSubmission}
                    onReanalyze={reanalyze}
                    reanalyzing={reanalyzeMutation.isPending}
                  />
                ) : (
                  <RecordListEmpty icon={FileText} label="暂无作业记录" />
                )}
              </Panel>

              <Panel
                title="最近试卷"
                subtitle="最近 5 份试卷的批改状态与得分"
                className="xl:col-span-6"
              >
                {studentData.exams.length > 0 ? (
                  <SubmissionRecordList
                    items={studentData.exams.slice(0, 5).map((exam) => ({
                      id: exam.id,
                      kind: "exam" as const,
                      title: exam.title,
                      date: new Date(exam.createdAt).toLocaleDateString(
                        "zh-CN",
                      ),
                      status: exam.analysisStatus,
                      error: exam.analysisError,
                      score: exam.analysis?.score ?? null,
                      type: "试卷",
                    }))}
                    onOpen={setOpenSubmission}
                    onReanalyze={reanalyze}
                    reanalyzing={reanalyzeMutation.isPending}
                  />
                ) : (
                  <RecordListEmpty icon={Award} label="暂无试卷记录" />
                )}
              </Panel>
            </section>

            <Panel
              title="知识掌握清单"
              subtitle="根据每次批改的对错持续更新，薄弱知识点排在前面"
            >
              <KnowledgeMasteryGrid items={studentData.studentKnowledgeAreas} />
            </Panel>
            <SubmissionAnalysisModal
              submission={openSubmission}
              onClose={() => setOpenSubmission(null)}
            />
          </>
        );
      }}
    </DashboardShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[70%] text-right font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}
