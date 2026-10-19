import {
  Users,
  BookOpen,
  FileText,
  TrendingUp,
  Calendar,
  Award,
  Archive,
} from "lucide-react";
import { Suspense } from "react";
import { ProgressInsightPanel, type ProgressAnalysis } from "~/components/ProgressInsightPanel";

interface ClassData {
  id: number;
  name: string;
  description?: string | null;
  invitationCode: string;
  invitationCodeExpiresAt: string;
  createdAt: string;
}

// ── Stats Cards ──────────────────────────────────────────────────

interface ClassStatsCardsProps {
  studentsCount: number;
  totalAssignments: number;
  totalExams: number;
  progressQuery: {
    data?: { aiAnalysis?: { progressPercentage?: number } } | undefined;
    isLoading: boolean;
  };
}

export function ClassStatsCards({
  studentsCount,
  totalAssignments,
  totalExams,
  progressQuery,
}: ClassStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="card-interactive p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">学生数</p>
            <p className="text-3xl font-bold text-gray-900">{studentsCount}</p>
            <p className="text-xs text-blue-600 mt-1">活跃学习者</p>
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-glow">
            <Users className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      <div className="card-interactive p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">作业总数</p>
            <p className="text-3xl font-bold text-gray-900">{totalAssignments}</p>
            <p className="text-xs text-green-600 mt-1">已提交作业</p>
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-glow">
            <FileText className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      <div className="card-interactive p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">考试总数</p>
            <p className="text-3xl font-bold text-gray-900">{totalExams}</p>
            <p className="text-xs text-purple-600 mt-1">已完成考试</p>
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-glow">
            <Award className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      <div className="card-interactive p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-1">班级进度</p>
            <p className="text-3xl font-bold text-gray-900">
              {progressQuery.data?.aiAnalysis?.progressPercentage != null
                ? `${progressQuery.data.aiAnalysis.progressPercentage}%`
                : progressQuery.isLoading
                  ? "分析中..."
                  : "暂无数据"}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {progressQuery.isLoading ? "分析中..." : "AI分析"}
            </p>
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-glow">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Class Info Sidebar ───────────────────────────────────────────

interface ClassInfoSidebarProps {
  classData: ClassData | undefined;
  teacherName: string;
  progressQuery: {
    data?: { aiAnalysis?: ProgressAnalysis; aiError?: string } | undefined;
    isLoading: boolean;
  };
  onShowArchiveModal: () => void;
}

export function ClassInfoSidebar({
  classData,
  teacherName,
  progressQuery,
  onShowArchiveModal,
}: ClassInfoSidebarProps) {
  return (
    <div className="space-y-6">
      {/* AI Progress Insights */}
      <Suspense
        fallback={
          <div className="card p-6">
            <div className="animate-pulse h-32 bg-gray-200 rounded"></div>
          </div>
        }
      >
        <ProgressInsightPanel
          aiAnalysis={progressQuery.data?.aiAnalysis}
          errorMessage={progressQuery.data?.aiError}
          isLoading={progressQuery.isLoading}
        />
      </Suspense>

      <div className="card animate-slide-up">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <BookOpen className="w-6 h-6 text-blue-600 mr-3" />
            <h3 className="text-lg font-bold text-gray-900">班级详情</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">教师</span>
            <span className="text-sm font-medium text-gray-900">
              {teacherName}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">创建时间</span>
            <div className="flex items-center text-sm font-medium text-gray-900">
              <Calendar className="w-4 h-4 mr-1" />
              {classData
                ? new Date(classData.createdAt).toLocaleDateString()
                : "-"}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">状态</span>
            <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              活跃
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onShowArchiveModal}
              className="w-full btn-secondary text-sm group flex items-center justify-center"
            >
              <Archive className="w-4 h-4 mr-2" />
              归档班级
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
