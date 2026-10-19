import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  FileText,
  NotebookTabs,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuthStore } from "~/stores/authStore";
import { AuthPanel } from "~/components/auth/AuthPanel";

export const Route = createFileRoute("/auth/")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.userRole);

  useEffect(() => {
    if (!isAuthenticated) return;
    void navigate({ to: userRole === "parent" ? "/parent-dashboard" : "/dashboard", replace: true });
  }, [isAuthenticated, userRole, navigate]);

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => void navigate({ to: "/" })}
            className="flex items-center gap-2.5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <NotebookTabs className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              睿评 AI
            </span>
          </button>

          <button
            onClick={() => void navigate({ to: "/" })}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </button>
        </div>
      </header>

      <main className="relative">
        <div className="absolute inset-x-0 bottom-0 h-72 bg-blue-50" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-start gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8">
          <section className="hidden max-w-xl lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-600 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              教师端 · 家长端
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              欢迎回来
              <br />
              登录睿评 AI
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-slate-600">
              教师上传作业后由 AI 自动批改、沉淀学情；家长用老师提供的班级邀请码绑定孩子，随时查看批改报告和薄弱知识点。也可以直接体验演示环境。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: Brain, label: "AI 批改", value: "自动评分反馈" },
                { icon: BarChart3, label: "学情趋势", value: "班级变化可见" },
                { icon: Users, label: "家校共育", value: "家长实时查看" },
                { icon: FileText, label: "报告中心", value: "复盘一键生成" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <Icon className="h-5 w-5 text-blue-600" />
                    <div className="mt-3 text-sm font-bold text-slate-950">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="relative lg:justify-self-end">
            <div className="absolute inset-x-6 top-8 hidden h-full rounded-lg bg-blue-100/70 lg:block" />
            <div className="relative mx-auto w-full max-w-md">
              <AuthPanel />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
