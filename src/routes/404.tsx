import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Home, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/404")({
  component: NotFoundPage,
});

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="relative text-center px-4 max-w-lg">
        <div className="w-24 h-24 bg-gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-glow">
          <GraduationCap className="w-14 h-14 text-white" />
        </div>

        <h1 className="text-8xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">页面未找到</h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          抱歉，您访问的页面不存在或已被移除。请检查网址是否正确，或返回工作台。
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="btn-primary px-6 py-3 flex items-center"
          >
            <Home className="w-4 h-4 mr-2" />
            返回工作台
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
