import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendChartPoint } from "./types";
import { EmptyState } from "./ui";

const SERIES = {
  assignmentAverage: { label: "作业均分", color: "#3b82f6", countKey: "assignmentCount" },
  examAverage: { label: "考试均分", color: "#8b5cf6", countKey: "examCount" },
} as const;

type SeriesKey = keyof typeof SERIES;

const ALL_SERIES = Object.keys(SERIES) as SeriesKey[];

export function TrendChart({
  data: allData,
  series = ALL_SERIES,
}: {
  data: TrendChartPoint[];
  series?: SeriesKey[];
}) {
  const data = allData.filter((point) => series.some((key) => point[key] !== null));
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <EmptyState
          icon={LineChartIcon}
          title="所选时间段暂无成绩"
          description="上传并完成 AI 批改后，这里会按天展示作业和考试的平均分。"
        />
      </div>
    );
  }

  const scores = data.flatMap((point) =>
    series.map((key) => point[key]).filter((score): score is number => score !== null),
  );
  const lowest = Math.min(...scores);
  const yMin = Math.max(0, Math.floor((lowest - 10) / 10) * 10);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
        {series.map((key) => (
          <span key={key} className="flex items-center gap-2">
            <span className="h-2 w-6 rounded-full" style={{ backgroundColor: SERIES[key].color }} />
            {SERIES[key].label}
            {data.every((point) => point[key] === null) ? (
              <span className="font-normal text-slate-400">（暂无）</span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 4 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis
              domain={[yMin, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <Tooltip content={<TrendTooltip />} />
            {series.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                connectNulls
                stroke={SERIES[key].color}
                strokeWidth={3}
                dot={{ r: 3, fill: SERIES[key].color, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: SERIES[key].color }}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; dataKey?: string; value?: number; payload?: TrendChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      <div className="space-y-1">
        {payload.map((entry) => {
          const series = SERIES[entry.dataKey as SeriesKey];
          if (!series || typeof entry.value !== "number") return null;
          const count = entry.payload?.[series.countKey] ?? 0;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-600">
                {series.label}
                <span className="ml-1 text-xs text-slate-400">{count} 份</span>
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
