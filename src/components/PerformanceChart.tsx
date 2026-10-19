import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface PerformanceDataPoint {
  date: string;
  score: number;
  title?: string;
  type: "assignment" | "exam";
}

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  title = "成绩趋势",
  height = 280,
  showLegend = true,
  className = "",
}) => {
  const processedData = React.useMemo(() => {
    const groupedByDate = new Map<
      string,
      { date: string; assignment?: number; exam?: number }
    >();

    data.forEach((point) => {
      const existing = groupedByDate.get(point.date) || { date: point.date };
      if (point.type === "assignment") {
        existing.assignment = point.score;
      } else {
        existing.exam = point.score;
      }
      groupedByDate.set(point.date, existing);
    });

    return Array.from(groupedByDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [data]);

  const trend = React.useMemo(() => {
    if (data.length < 2) return "stable" as const;

    const allScores = data.map((item) => item.score);
    const midpoint = Math.floor(allScores.length / 2);
    const firstHalf = allScores.slice(0, midpoint);
    const secondHalf = allScores.slice(midpoint);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return "stable" as const;
    }

    const firstAvg =
      firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;

    if (diff > 5) return "improving" as const;
    if (diff < -5) return "declining" as const;
    return "stable" as const;
  }, [data]);

  const averageScore =
    data.length > 0
      ? (data.reduce((sum, item) => sum + item.score, 0) / data.length).toFixed(
          1,
        )
      : "0";

  const TrendIcon =
    trend === "improving"
      ? TrendingUp
      : trend === "declining"
        ? TrendingDown
        : Minus;
  const trendColor =
    trend === "improving"
      ? "text-emerald-600"
      : trend === "declining"
        ? "text-rose-600"
        : "text-slate-500";

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
          {payload.map((entry) => (
            <div
              key={entry.dataKey}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="font-medium text-slate-600">
                {entry.dataKey === "assignment" ? "作业" : "考试"}
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value}分
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <section
        className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div className="text-base font-bold text-slate-950">{title}</div>
        <div className="flex min-h-64 flex-col items-center justify-center text-center">
          <TrendingUp className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            暂无成绩趋势数据
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            对比作业和试卷的阶段变化
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-xs font-medium text-slate-500">平均分</div>
            <div className="mt-1 text-xl font-bold text-slate-950">
              {averageScore}
            </div>
          </div>
          <div
            className={`flex items-center gap-1 text-sm font-semibold ${trendColor}`}
          >
            <TrendIcon className="h-4 w-4" />
            {trend === "improving"
              ? "上升"
              : trend === "declining"
                ? "下降"
                : "稳定"}
          </div>
        </div>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={processedData}>
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
            {showLegend ? (
              <Legend
                formatter={(value) =>
                  value === "assignment" ? "作业" : "考试"
                }
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="assignment"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#3b82f6" }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="exam"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#8b5cf6" }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
