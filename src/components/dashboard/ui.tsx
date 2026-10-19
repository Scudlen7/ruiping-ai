import type { ReactNode } from "react";
import { ChevronRight, Medal, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ModuleButton({
  children,
  icon: Icon,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "primary" | "dark";
}) {
  const className =
    tone === "primary"
      ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
      : tone === "dark"
        ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
        : "border-slate-200 bg-white text-slate-600 shadow-sm hover:text-blue-600";

  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${className}`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

export function MetricCard({
  title,
  value,
  caption,
  trend,
  tone = "neutral",
  direction,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string;
  caption: string;
  trend?: string;
  /** Colour: whether the change is good (up) or bad (down). */
  tone?: "up" | "down" | "neutral";
  /** Arrow: which way the number moved; defaults to the tone. */
  direction?: "up" | "down" | null;
  icon: LucideIcon;
  iconClassName: string;
}) {
  const arrow = direction === undefined ? (tone === "neutral" ? null : tone) : direction;
  const TrendIcon = arrow === "down" ? TrendingDown : arrow === "up" ? TrendingUp : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500">
            {title}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-bold leading-none text-slate-950">
              {value}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-slate-500">{caption}</span>
        {trend ? (
          <span
            className={`flex shrink-0 items-center gap-1 font-bold ${
              tone === "up"
                ? "text-emerald-600"
                : tone === "down"
                  ? "text-rose-600"
                  : "text-slate-500"
            }`}
          >
            {TrendIcon ? <TrendIcon className="h-3 w-3" /> : null}
            {trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-950">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function RankIndicator({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Trophy className="h-4 w-4" />
      </span>
    );
  }

  if (rank === 2) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Medal className="h-4 w-4" />
      </span>
    );
  }

  if (rank === 3) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600">
        <Medal className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-slate-500">
      {rank}
    </span>
  );
}

/** The student's most recent graded scores, oldest on the left. */
export function MiniBars({ scores }: { scores: number[] }) {
  return (
    <div className="flex h-7 items-end justify-end gap-1" title={scores.length ? `最近 ${scores.length} 次：${scores.join("、")}` : undefined}>
      {scores.map((score, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full ${score >= 60 ? "bg-blue-500" : "bg-rose-500"}`}
          style={{ height: `${Math.max(8, Math.min(100, score))}%` }}
        />
      ))}
    </div>
  );
}

export function CompactStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-1 truncate text-lg font-bold text-slate-950">
          {value}
        </div>
      </div>
    </div>
  );
}

export type ActionItem = {
  icon: LucideIcon;
  title: string;
  text: string;
  onClick: () => void;
};

export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            onClick={item.onClick}
            className="flex w-full items-start gap-3 rounded-lg bg-slate-50 px-4 py-4 text-left transition hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900">{item.title}</div>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {item.text}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
          </button>
        );
      })}
    </div>
  );
}
