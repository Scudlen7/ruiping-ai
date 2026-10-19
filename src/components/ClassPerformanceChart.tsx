import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target, TrendingUp, Users } from "lucide-react";

interface ClassPerformanceData {
  performanceTrends: Array<{
    date: string;
    averageScore: number;
    count: number;
    type: "assignment" | "exam";
  }>;
  participationTrends: Array<{
    date: string;
    activeStudents: number;
    participationRate: number;
  }>;
  mistakeTrends: Array<{
    date: string;
    mistakes: number;
  }>;
}

interface ClassPerformanceChartProps {
  data: ClassPerformanceData;
  className?: string;
  height?: number;
}

type ChartTab = "performance" | "participation" | "mistakes";

export const ClassPerformanceChart: React.FC<ClassPerformanceChartProps> = ({
  data,
  className = "",
  height = 340,
}) => {
  const [activeTab, setActiveTab] = React.useState<ChartTab>("performance");

  const combinedPerformanceData = React.useMemo(() => {
    const dateMap = new Map<
      string,
      { date: string; assignment?: number; exam?: number }
    >();

    data.performanceTrends.forEach((trend) => {
      const existing = dateMap.get(trend.date) || { date: trend.date };
      if (trend.type === "assignment") {
        existing.assignment = trend.averageScore;
      } else {
        existing.exam = trend.averageScore;
      }
      dateMap.set(trend.date, existing);
    });

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [data.performanceTrends]);

  const tabs = [
    { id: "performance" as const, label: "成绩趋势", icon: TrendingUp },
    { id: "participation" as const, label: "参与度", icon: Users },
    { id: "mistakes" as const, label: "错题波动", icon: Target },
  ];

  const summary = {
    performanceAverage:
      combinedPerformanceData.length > 0
        ? Math.round(
            combinedPerformanceData.reduce(
              (sum, item) => sum + (item.assignment || 0) + (item.exam || 0),
              0,
            ) / Math.max(1, combinedPerformanceData.length * 2),
          )
        : 0,
    participationAverage:
      data.participationTrends.length > 0
        ? Math.round(
            data.participationTrends.reduce(
              (sum, item) => sum + item.participationRate,
              0,
            ) / data.participationTrends.length,
          )
        : 0,
    mistakeTotal: data.mistakeTrends.reduce(
      (sum, item) => sum + item.mistakes,
      0,
    ),
  };

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ color?: string; dataKey?: string; value?: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
        <div className="mb-2 text-xs font-bold text-slate-500">
          {label ? new Date(label).toLocaleDateString("zh-CN") : "暂无日期"}
        </div>
        <div className="space-y-1.5">
          {payload.map((entry) => {
            const unit =
              entry.dataKey === "participationRate"
                ? "%"
                : entry.dataKey === "mistakes"
                  ? "个"
                  : "分";
            const copy =
              entry.dataKey === "assignment"
                ? "作业平均分"
                : entry.dataKey === "exam"
                  ? "试卷平均分"
                  : entry.dataKey === "participationRate"
                    ? "参与率"
                    : "错题数";
            return (
              <div
                key={entry.dataKey}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="font-medium text-slate-600">{copy}</span>
                <span className="font-bold" style={{ color: entry.color }}>
                  {entry.value}
                  {unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (activeTab === "performance") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={combinedPerformanceData}>
            <CartesianGrid
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(value) =>
                new Date(String(value)).toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })
              }
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) =>
                value === "assignment" ? "作业平均分" : "试卷平均分"
              }
            />
            <Area
              type="monotone"
              dataKey="assignment"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.18}
              strokeWidth={2.5}
            />
            <Area
              type="monotone"
              dataKey="exam"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.14}
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (activeTab === "participation") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data.participationTrends}>
            <CartesianGrid
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(value) =>
                new Date(String(value)).toLocaleDateString("zh-CN", {
                  month: "2-digit",
                  day: "2-digit",
                })
              }
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="participationRate"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.18}
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data.mistakeTrends}>
          <CartesianGrid
            stroke="#e2e8f0"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickFormatter={(value) =>
              new Date(String(value)).toLocaleDateString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
              })
            }
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="mistakes" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-950">班级表现趋势</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            从成绩、参与度和错题波动中判断当前班级学习状态。
          </p>
        </div>

        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {renderChart()}

      <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
        <StatItem
          label={
            activeTab === "performance"
              ? "近期平均分"
              : activeTab === "participation"
                ? "平均参与率"
                : "错题总量"
          }
          value={
            activeTab === "performance"
              ? `${summary.performanceAverage}分`
              : activeTab === "participation"
                ? `${summary.participationAverage}%`
                : `${summary.mistakeTotal}个`
          }
        />
        <StatItem
          label={
            activeTab === "performance"
              ? "记录次数"
              : activeTab === "participation"
                ? "活跃天数"
                : "波动天数"
          }
          value={
            activeTab === "performance"
              ? `${data.performanceTrends.length}次`
              : activeTab === "participation"
                ? `${data.participationTrends.length}天`
                : `${data.mistakeTrends.length}天`
          }
        />
        <StatItem
          label="当前查看"
          value={
            activeTab === "performance"
              ? "成绩趋势"
              : activeTab === "participation"
                ? "参与趋势"
                : "错题趋势"
          }
        />
      </div>
    </section>
  );
};

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
