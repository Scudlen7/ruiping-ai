import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Award,
  Brain,
  FileText,
  LogOut,
  NotebookTabs,
  Plus,
  Target,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { BindingRequestNotice, FamilyPanel, LinkChildForm } from "~/components/parent/FamilyBinding";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";
import { useToast } from "~/components/Toast";
import { getErrorMessage } from "~/utils/trpcError";
import { RequireAuth } from "~/components/RequireAuth";
import { useLogout } from "~/components/auth/useLogout";
import { ModalWrapper } from "~/components/ModalWrapper";
import { EnhancedAssignmentUpload } from "~/components/EnhancedAssignmentUpload";
import { StudentPerformanceChart } from "~/components/student/StudentPerformanceChart";
import {
  SubmissionAnalysisModal,
  type SubmissionRef,
} from "~/components/student/SubmissionAnalysisModal";
import {
  KnowledgeMasteryGrid,
  RecordListEmpty,
  SubmissionRecordList,
  type SubmissionRecordItem,
} from "~/components/student/SubmissionRecords";
import { EmptyState, MetricCard, Panel } from "~/components/dashboard/ui";
import { formatScore, SCORE_LEVEL_LABELS, scoreToLevel } from "~/lib/grading";

const ANALYSIS_POLL_INTERVAL_MS = 5000;

export const Route = createFileRoute("/parent-dashboard/")({
  component: ParentDashboardPage,
});

function ParentDashboardPage() {
  return (
    <RequireAuth role="parent">
      <ParentDashboard />
    </RequireAuth>
  );
}

function ParentDashboard() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { parent } = useAuthStore();
  const logout = useLogout();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const overviewQuery = useQuery({
    ...trpc.getParentOverview.queryOptions(),
    refetchInterval: (query) =>
      query.state.data?.children.some((child) => child.pendingAnalyses > 0)
        ? ANALYSIS_POLL_INTERVAL_MS
        : false,
  });

  const refetchOverview = overviewQuery.refetch;
  const handleSubmissionsChanged = useCallback(() => void refetchOverview(), [refetchOverview]);

  const children = overviewQuery.data?.children ?? [];
  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;

  const handleLogout = () => void logout();

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
              <NotebookTabs className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">睿评 AI</span>
            <span className="ml-2 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
              家长中心
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-slate-600 sm:inline">
              {overviewQuery.data?.parent.name ?? parent?.name}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {overviewQuery.isLoading ? (
          <div className="space-y-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : overviewQuery.isError ? (
          <EmptyState
            icon={Users}
            title="暂时无法加载家长中心"
            description={getErrorMessage(overviewQuery.error)}
          />
        ) : children.length === 0 ? (
          <div className="mx-auto max-w-md">
            <BindingRequestNotice requests={overviewQuery.data?.requests ?? []} />
            <Panel title="绑定孩子" subtitle="使用老师提供的班级邀请码，或家人分享的家庭邀请码">
              <LinkChildForm
                onLinked={() => void overviewQuery.refetch()}
                onRequested={() => void overviewQuery.refetch()}
              />
            </Panel>
          </div>
        ) : (
          <>
            <BindingRequestNotice requests={overviewQuery.data?.requests ?? []} />
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`rounded-lg border px-4 py-2 text-left transition ${
                    child.id === selectedChild?.id
                      ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                  }`}
                >
                  <div className="text-sm font-bold">{child.name}</div>
                  <div className={`text-xs ${child.id === selectedChild?.id ? "text-blue-100" : "text-slate-500"}`}>
                    {child.className ?? "未分班"}
                    {child.teacherName ? ` · ${child.teacherName}老师` : ""}
                  </div>
                </button>
              ))}
              <button
                onClick={() => setLinkOpen(true)}
                className="inline-flex h-[52px] items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-sm font-semibold text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" />
                添加孩子
              </button>
            </div>

            {selectedChild ? (
              <ChildReport
                key={selectedChild.id}
                childId={selectedChild.id}
                onSubmissionsChanged={handleSubmissionsChanged}
                family={
                  <FamilyPanel
                    childId={selectedChild.id}
                    childName={selectedChild.name}
                    family={selectedChild.family}
                    maxParents={overviewQuery.data?.maxParentsPerChild ?? 6}
                    onChanged={() => {
                      setSelectedChildId(null);
                      void overviewQuery.refetch();
                    }}
                  />
                }
              />
            ) : null}
          </>
        )}
      </main>

      <ModalWrapper isOpen={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-bold text-slate-950">添加孩子</h3>
          <p className="mt-1 mb-5 text-sm text-slate-500">使用老师提供的班级邀请码，或家人分享的家庭邀请码</p>
          <LinkChildForm
            onLinked={(childId) => {
              setLinkOpen(false);
              setSelectedChildId(childId);
              void overviewQuery.refetch();
            }}
            onRequested={() => {
              setLinkOpen(false);
              void overviewQuery.refetch();
            }}
          />
        </div>
      </ModalWrapper>
    </div>
  );
}

function ChildReport({
  childId,
  onSubmissionsChanged,
  family,
}: {
  childId: number;
  onSubmissionsChanged: () => void;
  family: ReactNode;
}) {
  const trpc = useTRPC();
  const toast = useToast();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y" | "all">("30d");
  const [openSubmission, setOpenSubmission] = useState<SubmissionRef | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const profileQuery = useQuery({
    ...trpc.getStudentProfileData.queryOptions({ studentId: childId }),
    retry: false,
    refetchInterval: (query) =>
      (query.state.data?.statistics.pendingAnalyses ?? 0) > 0 ? ANALYSIS_POLL_INTERVAL_MS : false,
  });

  const trendsQuery = useQuery({
    ...trpc.getStudentPerformanceTrends.queryOptions({ studentId: childId, timeRange }),
    retry: false,
  });

  const reanalyzeMutation = useMutation(
    trpc.analyzeSubmission.mutationOptions({
      onSuccess: () => {
        toast.success("已重新提交 AI 批改");
        void profileQuery.refetch();
        onSubmissionsChanged();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const pendingAnalyses = profileQuery.data?.statistics.pendingAnalyses ?? 0;
  const previousPendingRef = useRef(pendingAnalyses);
  const refetchTrends = trendsQuery.refetch;
  useEffect(() => {
    if (pendingAnalyses < previousPendingRef.current) {
      void refetchTrends();
      onSubmissionsChanged();
    }
    previousPendingRef.current = pendingAnalyses;
  }, [pendingAnalyses, refetchTrends, onSubmissionsChanged]);

  if (profileQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <EmptyState
        icon={Users}
        title="无法加载孩子的学习报告"
        description={profileQuery.isError ? getErrorMessage(profileQuery.error) : "请稍后重试"}
      />
    );
  }

  const { student, statistics } = profileQuery.data;
  const averageScore = statistics.averageScore;
  const masteryPercent = statistics.averageMastery != null ? Math.round(statistics.averageMastery * 100) : null;

  const records: SubmissionRecordItem[] = [
    ...student.assignments.map((a) => ({
      id: a.id,
      kind: "assignment" as const,
      title: a.title,
      createdAt: new Date(a.createdAt),
      status: a.analysisStatus,
      error: a.analysisError,
      score: a.analysis?.score ?? null,
      type: a.uploadedBy === "parent" ? "作业 · 家长上传" : "作业",
    })),
    ...student.exams.map((e) => ({
      id: e.id,
      kind: "exam" as const,
      title: e.title,
      createdAt: new Date(e.createdAt),
      status: e.analysisStatus,
      error: e.analysisError,
      score: e.analysis?.score ?? null,
      type: "试卷",
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(({ createdAt, ...item }) => ({ ...item, date: createdAt.toLocaleDateString("zh-CN") }));

  const recentMistakes = [
    ...student.mistakes.map((m) => ({ ...m, key: `assignment-${m.id}` })),
    ...student.examMistakes.map((m) => ({ ...m, key: `exam-${m.id}` })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{student.name}的学习报告</h1>
          <p className="mt-1 text-sm text-slate-500">
            {student.class?.name ?? "未分班"} · 老师和您上传的作业都会由 AI 自动批改，结果实时更新
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          上传作业
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="提交记录"
          value={`${statistics.totalAssignments + statistics.totalExams}`}
          caption={`作业 ${statistics.totalAssignments} · 试卷 ${statistics.totalExams}`}
          trend={pendingAnalyses > 0 ? `${pendingAnalyses} 份批改中` : "全部已处理"}
          tone={pendingAnalyses > 0 ? "neutral" : "up"}
          icon={FileText}
          iconClassName="bg-blue-500"
        />
        <MetricCard
          title="平均得分"
          value={formatScore(averageScore)}
          caption="百分制，作业与试卷合并"
          trend={averageScore !== null ? SCORE_LEVEL_LABELS[scoreToLevel(averageScore)] : "暂无已批改记录"}
          tone={averageScore === null ? "neutral" : averageScore >= 80 ? "up" : averageScore < 60 ? "down" : "neutral"}
          icon={Award}
          iconClassName="bg-violet-500"
        />
        <MetricCard
          title="错题总数"
          value={`${statistics.totalMistakes}`}
          caption="AI 批改中识别出的错误"
          trend={statistics.totalMistakes > 0 ? "建议陪孩子复盘" : "状态稳定"}
          tone={statistics.totalMistakes > 0 ? "down" : "up"}
          icon={Target}
          iconClassName="bg-orange-500"
        />
        <MetricCard
          title="平均掌握度"
          value={masteryPercent !== null ? `${masteryPercent}%` : "—"}
          caption="各知识点掌握程度的平均"
          trend={masteryPercent === null ? "暂无数据" : masteryPercent >= 70 ? "保持巩固" : "继续提升"}
          tone={masteryPercent !== null && masteryPercent >= 70 ? "up" : "neutral"}
          icon={TrendingUp}
          iconClassName="bg-emerald-500"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <StudentPerformanceChart timeRange={timeRange} onTimeRangeChange={setTimeRange} data={trendsQuery.data} />
        </div>
        <Panel title="最近提交" subtitle="最近 10 份作业与试卷的批改状态" className="xl:col-span-5">
          {records.length > 0 ? (
            <SubmissionRecordList
              items={records}
              onOpen={setOpenSubmission}
              onReanalyze={(submission) => reanalyzeMutation.mutate(submission)}
              reanalyzing={reanalyzeMutation.isPending}
            />
          ) : (
            <RecordListEmpty icon={FileText} label="还没有提交记录，点击右上角上传作业" />
          )}
        </Panel>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel title="知识掌握情况" subtitle="根据每次批改的对错持续更新，薄弱知识点排在前面" className="xl:col-span-7">
          <KnowledgeMasteryGrid items={student.studentKnowledgeAreas} />
        </Panel>
        <Panel title="最近错题" subtitle="建议和孩子一起订正" className="xl:col-span-5">
          {recentMistakes.length > 0 ? (
            <div className="space-y-3">
              {recentMistakes.map((mistake) => (
                <div key={mistake.key} className="rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{mistake.description}</p>
                    {mistake.knowledgeArea ? (
                      <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        {mistake.knowledgeArea.name}
                      </span>
                    ) : null}
                  </div>
                  {mistake.studentAnswer || mistake.correctAnswer ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <span className="text-rose-600">孩子的答案：{mistake.studentAnswer ?? "—"}</span>
                      <span className="text-emerald-700">正确答案：{mistake.correctAnswer ?? "—"}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <RecordListEmpty icon={Brain} label="暂无错题记录" />
          )}
        </Panel>
      </section>

      <section className="mb-6">{family}</section>

      <SubmissionAnalysisModal submission={openSubmission} onClose={() => setOpenSubmission(null)} />

      <ModalWrapper isOpen={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="max-w-4xl">
        <div className="max-h-[90vh] overflow-y-auto">
          <EnhancedAssignmentUpload
            childId={childId}
            onClose={() => setUploadOpen(false)}
            onSuccess={() => {
              void profileQuery.refetch();
              onSubmissionsChanged();
            }}
          />
        </div>
      </ModalWrapper>
    </>
  );
}