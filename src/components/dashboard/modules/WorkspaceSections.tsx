import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import {
  Archive,
  Award,
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  FileText,
  Gauge,
  GraduationCap,
  KeyRound,
  PieChart,
  ShieldCheck,
  TrendingDown,
  Users,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { ModalWrapper } from "~/components/ModalWrapper";
import { formatPercent } from "../metrics";
import { ActionList, CompactStat, EmptyState, MetricCard, Panel } from "../ui";
import type { DashboardPageContext } from "../types";

const ReportGenerationModal = lazy(() =>
  import("~/components/ReportGenerationModal").then((m) => ({
    default: m.ReportGenerationModal,
  })),
);

export function ClassManagement({ ctx }: { ctx: DashboardPageContext }) {
  const navigate = useNavigate();
  return (
    <>
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="班级总数"
          value={`${ctx.classes.length}`}
          caption="当前教师账号"
          icon={BookOpen}
          iconClassName="bg-blue-500"
        />
        <MetricCard
          title="学生总数"
          value={`${ctx.totalStudents}`}
          caption="所有班级合计"
          trend={
            ctx.classes.length > 0
              ? `平均每班 ${Math.round(ctx.totalStudents / ctx.classes.length)} 人`
              : undefined
          }
          icon={Users}
          iconClassName="bg-emerald-500"
        />
        <MetricCard
          title="学习记录"
          value={`${ctx.totalAssignments + ctx.totalExams}`}
          caption="作业与试卷累计"
          trend={`作业 ${ctx.totalAssignments} · 试卷 ${ctx.totalExams}`}
          icon={Archive}
          iconClassName="bg-violet-500"
        />
      </section>

      <Panel title="班级列表" subtitle="点击进入班级详情">
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
                className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{cls.name}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{cls.description || "暂无班级描述"}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <span>{cls._count.students} 学生</span>
                  <span>{cls._count.assignments} 作业</span>
                  <span>{cls._count.exams} 试卷</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="暂无班级" description="创建班级后，班级管理会展示档案与入口。" />
        )}
      </Panel>
    </>
  );
}

export function ReportCenter({ ctx }: { ctx: DashboardPageContext }) {
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel title="报告生成" subtitle="面向课堂复盘和家校沟通" className="xl:col-span-5">
          <ActionList
            items={[
              {
                icon: FileText,
                title: "生成班级报告",
                text: ctx.selectedClass?.name || "请选择班级",
                onClick: () => setShowReportModal(true),
              },
              {
                icon: PieChart,
                title: "查看学情分析",
                text: "进入完整学情分析页面。",
                onClick: ctx.openDataAnalysis,
              },
              {
                icon: Users,
                title: "查看学生管理",
                text: "从学生页直接查看画像、分组和关注状态。",
                onClick: ctx.openStudentsDashboard,
              },
            ]}
          />
        </Panel>
        <Panel title="报告摘要" subtitle="当前班级关键指标" className="xl:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <CompactStat
              label="班级平均分"
              value={ctx.averageScore === null ? "--" : ctx.averageScore.toFixed(1)}
              icon={Award}
            />
            <CompactStat label="知识点平均掌握" value={formatPercent(ctx.overallMastery)} icon={Brain} />
            <CompactStat label="提交覆盖率" value={formatPercent(ctx.coverageRate)} icon={ClipboardCheck} />
            <CompactStat label="低分率" value={formatPercent(ctx.lowScoreRate)} icon={TrendingDown} />
          </div>
        </Panel>
      </section>

      {ctx.selectedClass ? (
        <ModalWrapper isOpen={showReportModal} onClose={() => setShowReportModal(false)} maxWidth="max-w-4xl">
          <Suspense fallback={<div className="flex items-center justify-center p-8 text-slate-500">加载中...</div>}>
            <ReportGenerationModal
              isOpen={showReportModal}
              onClose={() => setShowReportModal(false)}
              classId={ctx.selectedClass.id}
              className={ctx.selectedClass.name}
            />
          </Suspense>
        </ModalWrapper>
      ) : null}
    </>
  );
}

export function SettingsCenter({ ctx }: { ctx: DashboardPageContext }) {
  const trpc = useTRPC();
  const usageQuery = useQuery(trpc.getAiUsageSummary.queryOptions());
  const modelsQuery = useQuery(trpc.getAvailableModels.queryOptions());
  const policyQuery = useQuery(trpc.getRegistrationPolicy.queryOptions());
  const usage = usageQuery.data;
  const models = modelsQuery.data?.models ?? [];
  const usedRatio = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="账号信息" subtitle="当前登录的教师账号" className="xl:col-span-5">
        <div className="space-y-3">
          <CompactStat label="教师姓名" value={ctx.teacher.name} icon={GraduationCap} />
          <CompactStat label="手机号" value={ctx.teacher.phoneNumber} icon={ShieldCheck} />
          <CompactStat label="班级数量" value={`${ctx.classes.length}`} icon={BookOpen} />
        </div>
      </Panel>
      <Panel title="系统信息" subtitle="由服务器配置决定，仅供查看" className="xl:col-span-7">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                今日 AI 额度
              </span>
              {usage ? (
                <span>
                  {new Date(usage.resetsAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  重置
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {usage ? `已用 ${usage.used} / 上限 ${usage.limit} 次` : "加载中..."}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${usedRatio >= 90 ? "bg-rose-500" : "bg-blue-500"}`}
                style={{ width: `${usedRatio}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Cpu className="h-3.5 w-3.5" />
              可用识别模型
            </div>
            {models.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {models.map((model) => (
                  <span
                    key={model.key}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                      model.isDefault
                        ? "bg-blue-50 text-blue-700 ring-blue-200"
                        : "bg-white text-slate-600 ring-slate-200"
                    }`}
                  >
                    {model.name}
                    {model.isDefault ? "（默认）" : ""}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-sm font-bold text-slate-900">
                {modelsQuery.isLoading ? "加载中..." : "未配置 AI 服务"}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <KeyRound className="h-3.5 w-3.5" />
              教师注册方式
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {policyQuery.data
                ? policyQuery.data.teacherInvitationCodeRequired
                  ? "需要教师邀请码"
                  : "开放注册（无需邀请码）"
                : "加载中..."}
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
