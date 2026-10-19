import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  LibraryBig,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { DashboardShell } from "~/components/dashboard/DashboardShell";
import { buildInsights } from "~/components/dashboard/insights";
import { describeDelta, formatPercent, pointAverage } from "~/components/dashboard/metrics";
import { TrendChart } from "~/components/dashboard/TrendChart";
import {
  EmptyState,
  MetricCard,
  MiniBars,
  ModuleButton,
  Panel,
  RankIndicator,
} from "~/components/dashboard/ui";
import type { DashboardPageContext } from "~/components/dashboard/types";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const navigate = useNavigate();

  return (
    <DashboardShell
      activeNav="overview"
      title="首页概览"
      actions={(ctx) => (
        <>
          <ModuleButton icon={LibraryBig} onClick={ctx.openTeachingMaterials}>
            教学资料
          </ModuleButton>
          <ModuleButton icon={Brain} onClick={ctx.openQuestionGenerator}>
            智能出题
          </ModuleButton>
          <ModuleButton icon={BarChart3} onClick={ctx.openDataAnalysis}>
            学情分析
          </ModuleButton>
        </>
      )}
    >
      {(ctx) => {
        const insights = buildInsights({
          selectedClassName: ctx.selectedClass?.name,
          averageScore: ctx.averageScore,
          scoreDelta: ctx.deltas.averageScore,
          coverageRate: ctx.coverageRate,
          lowScoreCount: ctx.studentRanking.filter(
            (student) => student.averageScore < 60,
          ).length,
          weakestArea: ctx.knowledgeAreas[0],
          hasPerformanceData: ctx.hasPerformanceData,
          navigation: ctx,
        });

        return (
          <>
            <section className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-950">
                  欢迎回来，{ctx.teacher.name.split(" ")[0]}
                  <span className="text-amber-400">👋</span>
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {ctx.selectedClass
                    ? `当前查看 ${ctx.selectedClass.name} 的近期学情。`
                    : "创建班级后，这里会自动汇总成绩、知识点和作业完成情况。"}
                </p>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="班级平均分"
                value={
                  ctx.averageScore === null ? "--" : ctx.averageScore.toFixed(1)
                }
                caption={
                  ctx.hasPerformanceData ? "所选时段全部已批改成绩" : "等待成绩分析"
                }
                {...describeDelta(ctx.deltas.averageScore, "分")}
                icon={Award}
                iconClassName="bg-blue-500"
              />
              <MetricCard
                title="优秀率"
                value={formatPercent(ctx.excellentRate)}
                caption="个人均分 90 分及以上"
                {...describeDelta(ctx.deltas.excellentRate, "%")}
                icon={Award}
                iconClassName="bg-violet-500"
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
                title="低分率"
                value={formatPercent(ctx.lowScoreRate)}
                caption="个人均分低于 60 分"
                {...describeDelta(ctx.deltas.lowScoreRate, "%", { lowerIsBetter: true })}
                icon={Target}
                iconClassName="bg-orange-500"
              />
              <MetricCard
                title="提交覆盖率"
                value={formatPercent(ctx.coverageRate)}
                caption="所选时段内有提交的学生占比"
                {...describeDelta(ctx.deltas.coverageRate, "%")}
                icon={ClipboardCheck}
                iconClassName="bg-indigo-500"
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Panel
                title="学生成绩趋势"
                subtitle="按天统计的作业与考试平均分"
                className="xl:col-span-7"
                action={
                  <div className="flex rounded-lg bg-slate-100 p-1">
                    {[
                      ["7d", "近7天"],
                      ["30d", "近30天"],
                      ["90d", "近90天"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() =>
                          ctx.setTimeRange(value as typeof ctx.timeRange)
                        }
                        className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                          ctx.timeRange === value
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <TrendChart data={ctx.trendChartData} />
                <TrendDigest ctx={ctx} />
              </Panel>

              <Panel
                title="学生综合表现排行"
                subtitle="前 10 名，柱条为最近 7 次得分"
                className="xl:col-span-5"
                action={
                  <button
                    onClick={ctx.openDataAnalysis}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-blue-600"
                  >
                    更多
                    <ChevronRight className="h-4 w-4" />
                  </button>
                }
              >
                {ctx.studentRanking.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full table-fixed text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="w-14 px-3 py-3 text-left font-bold">
                            排名
                          </th>
                          <th className="px-3 py-3 text-left font-bold">
                            学生姓名
                          </th>
                          <th className="w-20 px-3 py-3 text-right font-bold">
                            平均分
                          </th>
                          <th className="w-24 px-3 py-3 text-right font-bold">
                            最近得分
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ctx.studentRanking.slice(0, 10).map((student, index) => (
                          <tr
                            key={student.studentId}
                            onClick={() =>
                              ctx.openSelectedStudent(student.studentId)
                            }
                            className="cursor-pointer transition hover:bg-blue-50/60"
                          >
                            <td className="px-3 py-3">
                              <RankIndicator rank={index + 1} />
                            </td>
                            <td className="truncate px-3 py-3 font-semibold text-slate-700">
                              {student.studentName}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-slate-900">
                              {student.averageScore.toFixed(1)}
                            </td>
                            <td className="px-3 py-3">
                              <MiniBars scores={student.recentScores} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Award}
                    title="暂无排行数据"
                    description="上传并分析作业或试卷后，会自动生成学生表现排行。"
                  />
                )}
              </Panel>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Panel
                title="知识点掌握情况"
                subtitle="全班学生当前掌握度的平均值，最薄弱的排在前面"
                className="xl:col-span-7"
                action={
                  <button
                    onClick={ctx.openMistakeLibrary}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-blue-600"
                  >
                    更多
                    <ChevronRight className="h-4 w-4" />
                  </button>
                }
              >
                {ctx.knowledgeAreas.length > 0 ? (
                  <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
                    <div className="flex flex-col items-center justify-center">
                      <div
                        className="flex h-36 w-36 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#3b82f6 ${ctx.overallMastery || 0}%, #e2e8f0 0)`,
                        }}
                      >
                        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-2xl font-bold text-slate-950">
                            {formatPercent(ctx.overallMastery)}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            平均掌握
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {ctx.knowledgeAreas.slice(0, 5).map((area) => (
                        <div
                          key={area.knowledgeAreaId}
                          className="grid gap-3 rounded-lg border border-slate-100 px-4 py-3 sm:grid-cols-[1fr_160px_64px]"
                        >
                          <div>
                            <div className="truncate text-sm font-bold text-slate-800">
                              {area.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {area.masteryStudentCount} 名学生有记录
                              {area.mistakeCount > 0
                                ? `，所选时段错题 ${area.mistakeCount} 次`
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${area.mastery}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right text-sm font-bold text-slate-800">
                            {area.mastery.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={Brain}
                    title="暂无知识点数据"
                    description="AI 批改完成后会更新每名学生的知识点掌握度，这里展示全班平均。"
                  />
                )}
              </Panel>

              <Panel
                title="最新学情洞察"
                subtitle="可直接转为复习、出题或个别辅导动作"
                className="xl:col-span-5"
                action={
                  <button
                    onClick={ctx.openReviewSchedule}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-blue-600"
                  >
                    更多
                    <ChevronRight className="h-4 w-4" />
                  </button>
                }
              >
                <div className="space-y-3">
                  {insights.map((insight) => {
                    const Icon = insight.icon;
                    return (
                      <button
                        key={insight.title}
                        onClick={insight.onClick}
                        className="flex w-full items-start gap-3 rounded-lg bg-slate-50 px-4 py-3 text-left transition hover:bg-blue-50"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${insight.iconClassName}`}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="truncate text-sm font-bold text-slate-900">
                              {insight.title}
                            </h4>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">
                              {insight.tag}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {insight.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </section>

            <Panel
              title="我的班级"
              subtitle={`共 ${ctx.classes.length} 个班级，${ctx.totalStudents} 名学生，${
                ctx.totalAssignments + ctx.totalExams
              } 份作业/试卷记录`}
              action={
                <ModuleButton
                  icon={Plus}
                  tone="dark"
                  onClick={ctx.openCreateClass}
                >
                  创建班级
                </ModuleButton>
              }
            >
              {ctx.classes.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ctx.classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() =>
                        void navigate({
                          to: "/classes/$classId",
                          params: { classId: cls.id.toString() },
                        })
                      }
                      className="group rounded-lg border border-slate-100 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-700">
                            {cls.name}
                          </h4>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {cls.description || "暂无班级描述"}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500" />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">
                            {cls._count.students}
                          </div>
                          <div className="text-slate-500">学生</div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {cls._count.assignments}
                          </div>
                          <div className="text-slate-500">作业</div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {cls._count.exams}
                          </div>
                          <div className="text-slate-500">试卷</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="还没有班级"
                  description="创建第一个班级后，就可以导入学生、上传作业并生成学情分析。"
                />
              )}
            </Panel>
          </>
        );
      }}
    </DashboardShell>
  );
}

function TrendDigest({ ctx }: { ctx: DashboardPageContext }) {
  const dailyScores = ctx.trendChartData
    .map((point) => ({ date: point.date, score: pointAverage(point) }))
    .filter((point): point is { date: string; score: number } => point.score !== null);
  const latestPoint = dailyScores.at(-1);
  const scores = dailyScores.map((point) => point.score);
  const highestScore = scores.length ? Math.max(...scores) : null;
  const lowestScore = scores.length ? Math.min(...scores) : null;
  const scoreRange =
    highestScore !== null && lowestScore !== null
      ? highestScore - lowestScore
      : null;
  const weakestArea = ctx.knowledgeAreas[0];
  const scoreDelta = ctx.deltas.averageScore;
  const declining = scoreDelta !== null && scoreDelta < 0;
  const gradedCount = ctx.trendChartData.reduce(
    (sum, point) => sum + point.assignmentCount + point.examCount,
    0,
  );

  const guidance = ctx.hasPerformanceData
    ? [
        {
          title:
            scoreDelta === null
              ? "暂无上一时段可对比"
              : declining
                ? `均分较上期回落 ${Math.abs(scoreDelta).toFixed(1)} 分`
                : `均分较上期提升 ${scoreDelta.toFixed(1)} 分`,
          text:
            scoreDelta === null
              ? "继续积累一个周期的批改记录后，这里会给出升降对比。"
              : declining
                ? "建议从最近一次作业错题中抽 3-5 道同类题，安排一次短测回补。"
                : "可以把高分学生的解法整理为课堂讲评素材，巩固当前节奏。",
          icon: declining ? TrendingDown : TrendingUp,
          tone: declining
            ? "bg-rose-50 text-rose-700"
            : "bg-emerald-50 text-emerald-700",
          onClick: declining ? ctx.openMistakeLibrary : ctx.openDataAnalysis,
        },
        {
          title: weakestArea
            ? `「${weakestArea.name}」掌握度 ${weakestArea.mastery.toFixed(0)}%`
            : "暂无知识点掌握数据",
          text: weakestArea
            ? `全班最薄弱的知识点，${weakestArea.masteryStudentCount} 名学生有记录，适合安排一次 10 分钟针对复习。`
            : "AI 批改会为每名学生记录知识点掌握度，之后这里会提示最值得复习的内容。",
          icon: Target,
          tone: "bg-blue-50 text-blue-700",
          onClick: weakestArea ? ctx.openQuestionGenerator : ctx.openUploadForSelectedClass,
        },
      ]
    : [
        {
          title: "等待首批真实趋势",
          text: "上传并分析作业或试卷后，这里会展示近期变化、峰值和波动区间。",
          icon: Upload,
          tone: "bg-blue-50 text-blue-700",
          onClick: ctx.openUploadForSelectedClass,
        },
        {
          title: "先准备分析材料",
          text: "建议先导入学生名单，再上传一批作业，排行和知识点会同步生成。",
          icon: ClipboardCheck,
          tone: "bg-emerald-50 text-emerald-700",
          onClick: ctx.openSelectedClass,
        },
      ];

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <TrendDigestItem
          label="最新一日均分"
          value={latestPoint ? latestPoint.score.toFixed(1) : "--"}
          caption={latestPoint?.date || "暂无日期"}
          icon={Award}
        />
        <TrendDigestItem
          label="阶段最高"
          value={highestScore === null ? "--" : highestScore.toFixed(1)}
          caption="日均分峰值"
          icon={TrendingUp}
        />
        <TrendDigestItem
          label="波动区间"
          value={scoreRange === null ? "--" : `${scoreRange.toFixed(1)}分`}
          caption="日均分高低差"
          icon={TrendingDown}
        />
        <TrendDigestItem
          label="已批改"
          value={`${gradedCount}`}
          caption={`${dailyScores.length} 天有成绩`}
          icon={ClipboardCheck}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {guidance.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              onClick={item.onClick}
              className="flex min-h-24 items-start gap-3 rounded-lg bg-slate-50 px-4 py-4 text-left transition hover:bg-blue-50"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">
                  {item.title}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {item.text}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrendDigestItem({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Award;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-blue-500" />
      </div>
      <div className="text-xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{caption}</div>
    </div>
  );
}
