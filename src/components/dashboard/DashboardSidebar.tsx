import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Sparkles } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { navItems } from "./navigation";
import type { DashboardNavKey } from "./types";

export function DashboardSidebar({ activeNav }: { activeNav: DashboardNavKey }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trpc = useTRPC();
  const usageQuery = useQuery({ ...trpc.getAiUsageSummary.queryOptions(), staleTime: 30_000 });
  const usage = usageQuery.data;
  const usedRatio = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  return (
    <aside className="hidden border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
      <a className="flex h-20 items-center gap-3 px-7" href="/dashboard">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-slate-950">
            睿评 AI
          </div>
          <div className="text-xs font-medium text-slate-400">
            AI 赋能教育教学评价
          </div>
        </div>
      </a>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            activeNav === item.key ||
            (item.key !== "overview" && pathname.startsWith(item.href));
          return (
            <a
              key={item.key}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="px-5 pb-6">
        <a
          href="/dashboard/settings"
          className="block rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100 transition hover:bg-blue-50"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">今日 AI 额度</div>
              <div className="text-xs text-slate-500">
                {usage ? `已用 ${usage.used} / 上限 ${usage.limit}` : "加载中..."}
              </div>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${usedRatio >= 90 ? "bg-rose-500" : "bg-blue-500"}`}
              style={{ width: `${usedRatio}%` }}
            />
          </div>
        </a>
      </div>
    </aside>
  );
}
