import type { ComponentProps } from "react";
import { LineChart } from "lucide-react";
import { KnowledgeAreaChart } from "~/components/KnowledgeAreaChart";
import { PerformanceChart } from "~/components/PerformanceChart";
import { TimeRangeSelector } from "~/components/TimeRangeSelector";

interface PerformanceTrendsData {
  performanceTrends?: ComponentProps<typeof PerformanceChart>["data"];
  proficiencyTrends?: ComponentProps<typeof KnowledgeAreaChart>["data"];
  summary?: {
    averageAssignmentScore: number;
    averageExamScore: number;
    totalAssignments: number;
    totalMistakes: number;
  };
}

interface StudentPerformanceChartProps {
  timeRange: "7d" | "30d" | "90d" | "1y" | "all";
  onTimeRangeChange: (range: "7d" | "30d" | "90d" | "1y" | "all") => void;
  data?: PerformanceTrendsData;
}

export function StudentPerformanceChart({
  timeRange,
  onTimeRangeChange,
  data,
}: StudentPerformanceChartProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <LineChart className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-950">学习趋势分析</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              对照作业成绩与知识掌握变化，判断学生最近的学习状态。
            </p>
          </div>
        </div>

        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PerformanceChart
          data={data?.performanceTrends || []}
          title="成绩趋势"
        />
        <KnowledgeAreaChart data={data?.proficiencyTrends || []} />
      </div>

      {data?.summary ? (
        <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="平均作业分"
            value={data.summary.averageAssignmentScore.toFixed(1)}
            tone="text-blue-600"
          />
          <SummaryCard
            label="平均试卷分"
            value={data.summary.averageExamScore.toFixed(1)}
            tone="text-violet-600"
          />
          <SummaryCard
            label="作业记录"
            value={`${data.summary.totalAssignments}`}
            tone="text-emerald-600"
          />
          <SummaryCard
            label="累计错题"
            value={`${data.summary.totalMistakes}`}
            tone="text-orange-600"
          />
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({
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
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
