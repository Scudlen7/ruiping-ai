import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Search,
  Target,
  User,
  Users,
} from "lucide-react";
import { EmptyState, MetricCard, Panel } from "~/components/dashboard/ui";
import type { DashboardPageContext } from "~/components/dashboard/types";
import { useTRPC } from "~/trpc/react";

export function MistakeLibraryPage({ ctx }: { ctx: DashboardPageContext }) {
  const trpc = useTRPC();
  const [selectedKnowledgeAreaId, setSelectedKnowledgeAreaId] = useState<
    number | null
  >(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null,
  );
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setSelectedKnowledgeAreaId(null);
    setSelectedStudentId(null);
    setKeyword("");
    setPage(1);
  }, [ctx.selectedClassId]);

  const knowledgeAreasQuery = useQuery({
    ...trpc.getKnowledgeAreas.queryOptions(),
  });

  const studentsQuery = useQuery({
    ...trpc.getClassStudents.queryOptions({
      classId: ctx.selectedClassId,
    }),
    enabled: !!ctx.selectedClassId,
  });

  const mistakesQuery = useQuery({
    ...trpc.getMistakeLibrary.queryOptions({
      classId: ctx.selectedClassId,
      knowledgeAreaId: selectedKnowledgeAreaId || undefined,
      studentId: selectedStudentId || undefined,
      keyword: keyword.trim() || undefined,
      page,
      pageSize: 12,
    }),
    enabled: !!ctx.selectedClassId,
  });

  const knowledgeAreas = knowledgeAreasQuery.data?.knowledgeAreas || [];
  const students = studentsQuery.data?.students || [];
  const mistakesData = mistakesQuery.data;
  const topKnowledgeArea = mistakesData?.stats.byKnowledgeArea[0];
  const topStudent = mistakesData?.stats.byStudent[0];
  const activeFilterCount =
    Number(Boolean(selectedKnowledgeAreaId)) +
    Number(Boolean(selectedStudentId)) +
    Number(Boolean(keyword.trim()));

  const selectedStudentName = useMemo(
    () =>
      selectedStudentId
        ? students.find((student) => student.id === selectedStudentId)?.name
        : null,
    [selectedStudentId, students],
  );

  const resetFilters = () => {
    setSelectedKnowledgeAreaId(null);
    setSelectedStudentId(null);
    setKeyword("");
    setPage(1);
  };

  if (!ctx.selectedClass) {
    return (
      <EmptyState
        icon={BookOpen}
        title="请先选择班级"
        description="错题库会按班级聚合作业与试卷中的错题记录。"
      />
    );
  }

  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="错题总量"
          value={
            mistakesQuery.isLoading
              ? "--"
              : `${mistakesData?.stats.totalMistakes || 0}`
          }
          caption={ctx.selectedClass.name}
          trend={topKnowledgeArea ? topKnowledgeArea.name : "等待记录"}
          tone={
            (mistakesData?.stats.totalMistakes || 0) > 0 ? "down" : "neutral"
          }
          icon={Target}
          iconClassName="bg-orange-500"
        />
        <MetricCard
          title="涉及学生"
          value={
            mistakesQuery.isLoading
              ? "--"
              : `${mistakesData?.stats.byStudent.length || 0}`
          }
          caption="有错题记录的学生"
          trend={
            topStudent
              ? `${topStudent.name} ${topStudent.count} 题`
              : "暂无排行"
          }
          tone="neutral"
          icon={Users}
          iconClassName="bg-blue-500"
        />
        <MetricCard
          title="知识点覆盖"
          value={
            mistakesQuery.isLoading
              ? "--"
              : `${mistakesData?.stats.byKnowledgeArea.length || 0}`
          }
          caption="已归类知识点"
          trend={topKnowledgeArea ? `${topKnowledgeArea.count} 次` : "暂无分类"}
          tone="neutral"
          icon={Brain}
          iconClassName="bg-violet-500"
        />
        <MetricCard
          title="当前筛选"
          value={`${activeFilterCount}`}
          caption="知识点 / 学生 / 关键词"
          trend={activeFilterCount > 0 ? "筛选生效中" : "查看全部"}
          tone={activeFilterCount > 0 ? "up" : "neutral"}
          icon={Search}
          iconClassName="bg-emerald-500"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <Panel title="筛选条件" subtitle="按知识点、学生和关键词快速定位错题">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  知识点
                </span>
                <select
                  value={selectedKnowledgeAreaId || ""}
                  onChange={(event) => {
                    setSelectedKnowledgeAreaId(
                      event.target.value ? Number(event.target.value) : null,
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">全部知识点</option>
                  {knowledgeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  学生
                </span>
                <select
                  value={selectedStudentId || ""}
                  onChange={(event) => {
                    setSelectedStudentId(
                      event.target.value ? Number(event.target.value) : null,
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">全部学生</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  关键词
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜索题干、答案、学生或来源"
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </label>

              <button
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                重置筛选
              </button>
            </div>
          </Panel>

          <Panel title="班级观察" subtitle="帮助老师快速锁定高频问题">
            <div className="space-y-4">
              <QuickInfo
                label="当前班级"
                value={ctx.selectedClass.name}
                tone="text-slate-900"
              />
              <QuickInfo
                label="高频知识点"
                value={topKnowledgeArea?.name || "暂无"}
                tone="text-orange-600"
              />
              <QuickInfo
                label="重点学生"
                value={topStudent?.name || "暂无"}
                tone="text-blue-600"
              />
              <QuickInfo
                label="当前学生筛选"
                value={selectedStudentName || "全部学生"}
                tone="text-violet-600"
              />
            </div>
          </Panel>

          <Panel title="知识点热点" subtitle="按当前筛选查看错题最密集的知识点">
            {mistakesData?.stats.byKnowledgeArea.length ? (
              <div className="space-y-3">
                {mistakesData.stats.byKnowledgeArea.slice(0, 5).map((area) => (
                  <div
                    key={area.name}
                    className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                          <Brain className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {area.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            错题聚合结果
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-600">
                        {area.count} 题
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Brain}
                title="暂无热点知识点"
                description="上传并分析作业或试卷后，这里会显示高频错题知识点。"
              />
            )}
          </Panel>
        </div>

        <div className="xl:col-span-8">
          <Panel
            title="错题明细"
            subtitle="当前页聚合作业与试卷中的错题，可直接跳到对应学生"
            action={
              mistakesData ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  共 {mistakesData.total} 条
                </span>
              ) : null
            }
          >
            {mistakesQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : mistakesData?.mistakes.length ? (
              <>
                <div className="space-y-4">
                  {mistakesData.mistakes.map((mistake) => (
                    <article
                      key={`${mistake.source}-${mistake.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition hover:border-blue-200 hover:bg-white"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                mistake.source === "exam"
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {mistake.source === "exam"
                                ? "试卷错题"
                                : "作业错题"}
                            </span>
                            {mistake.knowledgeArea ? (
                              <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                {mistake.knowledgeArea.name}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                              {new Date(mistake.createdAt).toLocaleDateString(
                                "zh-CN",
                              )}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold leading-6 text-slate-950">
                            {mistake.description || "未提供错题描述"}
                          </h3>

                          {mistake.originalQuestionText ? (
                            <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-100">
                              {mistake.originalQuestionText}
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {mistake.sourceTitle || "未命名来源"}
                            </span>
                            {mistake.correctAnswer ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <Target className="h-3.5 w-3.5" />
                                正确答案：{mistake.correctAnswer}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-52">
                          <div className="rounded-lg bg-white px-4 py-4 ring-1 ring-slate-100">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              学生
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">
                              {mistake.student?.name || "未关联学生"}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (!mistake.student?.id) return;
                              ctx.openSelectedStudent(mistake.student.id);
                            }}
                            disabled={!mistake.student?.id}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <User className="h-4 w-4" />
                            查看学生档案
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    第 {mistakesData.page} / {mistakesData.totalPages} 页，共{" "}
                    {mistakesData.total} 条错题记录
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      disabled={mistakesData.page <= 1}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </button>
                    <button
                      onClick={() =>
                        setPage((current) =>
                          Math.min(mistakesData.totalPages, current + 1),
                        )
                      }
                      disabled={mistakesData.page >= mistakesData.totalPages}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title="当前没有匹配的错题记录"
                description="可以切换班级，或者放宽筛选条件后再看一眼。"
              />
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}

function QuickInfo({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
