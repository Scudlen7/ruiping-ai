import React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Brain, TrendingUp } from "lucide-react";

interface ProficiencyDataPoint {
  date: string;
  knowledgeArea: string;
  /** 0-100 */
  proficiency: number;
  proficiencyLabel: string;
}

interface KnowledgeAreaChartProps {
  data: ProficiencyDataPoint[];
  className?: string;
  height?: number;
  viewType?: "radar" | "trend";
}

export const KnowledgeAreaChart: React.FC<KnowledgeAreaChartProps> = ({
  data,
  className = "",
  height = 320,
  viewType: initialViewType = "radar",
}) => {
  const [viewType, setViewType] = React.useState<"radar" | "trend">(
    initialViewType,
  );

  const radarData = React.useMemo(() => {
    const latestByArea = new Map<
      string,
      { date: string; proficiency: number }
    >();

    data.forEach((point) => {
      const existing = latestByArea.get(point.knowledgeArea);
      if (!existing || new Date(point.date) > new Date(existing.date)) {
        latestByArea.set(point.knowledgeArea, {
          date: point.date,
          proficiency: point.proficiency,
        });
      }
    });

    return Array.from(latestByArea.entries()).map(([area, latest]) => ({
      knowledgeArea: area,
      proficiency: latest.proficiency,
      fullMark: 100,
    }));
  }, [data]);

  const trendData = React.useMemo(() => {
    const dateMap = new Map<string, Record<string, string | number>>();

    data.forEach((point) => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      const dateData = dateMap.get(point.date);
      if (!dateData) return;
      dateData[point.knowledgeArea] = point.proficiency;
    });

    return Array.from(dateMap.values()).sort(
      (a, b) =>
        new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime(),
    );
  }, [data]);

  const knowledgeAreas = React.useMemo(
    () => Array.from(new Set(data.map((item) => item.knowledgeArea))),
    [data],
  );

  const colors = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#84cc16",
    "#f97316",
  ];

  const RadarTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload?: { knowledgeArea: string; proficiency: number };
    }>;
  }) => {
    if (!active || !payload?.length || !payload[0]?.payload) return null;
    const point = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
        <div className="text-sm font-semibold text-slate-900">
          {point.knowledgeArea}
        </div>
        <div className="mt-1 text-sm text-blue-600">
          熟练度 {point.proficiency.toFixed(1)}%
        </div>
      </div>
    );
  };

  const TrendTooltip = ({
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
      <div className="max-w-xs rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
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
                {entry.dataKey}
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value?.toFixed(1)}%
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
        <div className="text-base font-bold text-slate-950">知识掌握结构</div>
        <div className="flex min-h-72 flex-col items-center justify-center text-center">
          <Brain className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            暂无知识点掌握数据
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-950">知识掌握结构</h3>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            观察学生在不同知识点上的掌握强弱和变化轨迹。
          </p>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setViewType("radar")}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              viewType === "radar"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            雷达图
          </button>
          <button
            onClick={() => setViewType("trend")}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
              viewType === "trend"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            趋势图
          </button>
        </div>
      </div>

      {viewType === "radar" ? (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="knowledgeArea" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis
              angle={0}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Radar
              name="熟练度"
              dataKey="proficiency"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={trendData}>
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
            <Tooltip content={<TrendTooltip />} />
            <Legend />
            {knowledgeAreas.map((area, index) => (
              <Line
                key={area}
                type="monotone"
                dataKey={area}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: colors[index % colors.length],
                  strokeWidth: 0,
                }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
        <MiniStat label="知识点数" value={`${knowledgeAreas.length}`} />
        <MiniStat
          label="平均熟练度"
          value={`${
            radarData.length > 0
              ? Math.round(
                  radarData.reduce((sum, item) => sum + item.proficiency, 0) /
                    radarData.length,
                )
              : 0
          }%`}
        />
        <MiniStat
          label="优势知识点"
          value={`${radarData.filter((item) => item.proficiency >= 80).length}`}
        />
      </div>
    </section>
  );
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}
