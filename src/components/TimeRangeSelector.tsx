import React from "react";
import { Clock } from "lucide-react";

interface TimeRangeSelectorProps {
  value: "7d" | "30d" | "90d" | "1y" | "all";
  onChange: (value: "7d" | "30d" | "90d" | "1y" | "all") => void;
  className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const options = [
    { value: "7d" as const, label: "7天" },
    { value: "30d" as const, label: "30天" },
    { value: "90d" as const, label: "90天" },
    { value: "1y" as const, label: "1年" },
    { value: "all" as const, label: "全部" },
  ];

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 ${className}`}
    >
      <span className="inline-flex items-center gap-1 px-2 py-2 text-xs font-semibold text-slate-500">
        <Clock className="h-3.5 w-3.5" />
        时间范围
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
            value === option.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
