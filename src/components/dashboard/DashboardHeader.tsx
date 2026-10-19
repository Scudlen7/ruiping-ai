import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, ChevronDown, GraduationCap, LogOut, Plus, Users } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { dateRangeText } from "./metrics";
import type { TeacherClass, TimeRange } from "./types";

export function DashboardHeader({
  title,
  subtitle,
  classes,
  selectedClass,
  timeRange,
  showClassSelector,
  showDateRangeBadge,
  showCreateClassButton,
  onClassChange,
  onCreateClass,
  onLogout,
}: {
  title: string;
  subtitle: string;
  classes: TeacherClass[];
  selectedClass: TeacherClass | null;
  timeRange: TimeRange;
  showClassSelector: boolean;
  showDateRangeBadge: boolean;
  showCreateClassButton: boolean;
  onClassChange: (classId: number) => void;
  onCreateClass: () => void;
  onLogout: () => void;
}) {
  const trpc = useTRPC();
  const notificationsQuery = useQuery({
    ...trpc.getTeacherNotifications.queryOptions(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const attentionCount = notificationsQuery.data?.attentionCount ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-20 flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8">
        <div className="flex items-center gap-3">
          <a
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20 lg:hidden"
            href="/dashboard"
          >
            <GraduationCap className="h-5 w-5 text-white" />
          </a>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showClassSelector ? (
            <label className="relative min-w-44">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedClass?.id || ""}
                disabled={classes.length === 0}
                onChange={(event) => onClassChange(Number(event.target.value))}
                className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:text-slate-400"
              >
                {classes.length === 0 && <option value="">暂无班级</option>}
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </label>
          ) : null}

          {showDateRangeBadge ? (
            <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>{dateRangeText(timeRange)}</span>
            </div>
          ) : null}

          {showCreateClassButton ? (
            <button
              onClick={onCreateClass}
              className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              新建班级
            </button>
          ) : null}

          <a
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-900"
            href="/dashboard/messages"
            aria-label={attentionCount > 0 ? `通知，${attentionCount} 项待处理` : "通知"}
            title={attentionCount > 0 ? `${attentionCount} 项待处理` : "消息中心"}
          >
            <Bell className="h-5 w-5" />
            {attentionCount > 0 ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
            ) : null}
          </a>

          <button
            onClick={onLogout}
            className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
