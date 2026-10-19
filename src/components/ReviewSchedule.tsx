import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useToast } from "~/components/Toast";
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, Users,
  ChevronRight, Loader2, BookOpen, Target, BarChart3
} from "lucide-react";

interface ReviewScheduleProps {
  onClose: () => void;
}

export function ReviewSchedule({ onClose }: ReviewScheduleProps) {
  const trpc = useTRPC();
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const classesQuery = useQuery({
    ...trpc.getTeacherClasses.queryOptions(),
  });

  const trendsQuery = useQuery({
    ...trpc.getClassPerformanceTrends.queryOptions({
      classId: selectedClassId!,
      timeRange: "all",
    }),
    enabled: !!selectedClassId,
  });

  const classes = classesQuery.data?.classes || [];
  const trends = trendsQuery.data;

  // Generate review recommendations based on trends
  const getReviewRecommendations = () => {
    if (!trends) return [];

    const recommendations: {
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      icon: React.ReactNode;
      action: string;
    }[] = [];

    // Analyze score trends for declining performance
    const perfTrends = trends.performanceTrends || [];
    const [oldest, middle, latest] = perfTrends.slice(-3);
    if (oldest && middle && latest) {
      const isDeclining = latest.averageScore < middle.averageScore && middle.averageScore < oldest.averageScore;
      if (isDeclining) {
        recommendations.push({
          title: "成绩下降趋势提醒",
          description: `近期班级平均分呈下降趋势（${oldest.averageScore.toFixed(1)} → ${latest.averageScore.toFixed(1)}），建议安排复习巩固`,
          priority: "high",
          icon: <AlertTriangle className="w-5 h-5" />,
          action: "安排针对性复习",
        });
      }
    }

    // Analyze mistake trends
    const mistakeTrends = trends.mistakeTrends || [];
    if (mistakeTrends.length > 0) {
      const recentMistakes = mistakeTrends.slice(-5);
      const totalRecent = recentMistakes.reduce((sum, m) => sum + m.mistakes, 0);
      if (totalRecent > 10) {
        recommendations.push({
          title: "错题集中出现",
          description: `最近一段时间错题数量较多（共${totalRecent}题），建议安排错题复习课`,
          priority: "high",
          icon: <AlertTriangle className="w-5 h-5" />,
          action: "查看错题详情",
        });
      }
    }

    // Average score analysis
    if (trends.summary.averageExamScore > 0 && trends.summary.averageExamScore < 70) {
      recommendations.push({
        title: "考试平均分偏低",
        description: `班级考试平均分 ${trends.summary.averageExamScore.toFixed(1)} 分，建议重点复习薄弱知识点`,
        priority: "high",
        icon: <Target className="w-5 h-5" />,
        action: "查看详细分析",
      });
    } else if (trends.summary.averageExamScore >= 70 && trends.summary.averageExamScore < 85) {
      recommendations.push({
        title: "成绩有提升空间",
        description: `班级考试平均分 ${trends.summary.averageExamScore.toFixed(1)} 分，部分知识点需要巩固`,
        priority: "medium",
        icon: <Target className="w-5 h-5" />,
        action: "安排巩固练习",
      });
    }

    // Participation analysis
    if (trends.summary.averageParticipationRate < 80) {
      recommendations.push({
        title: "参与度偏低",
        description: `班级平均参与率 ${trends.summary.averageParticipationRate.toFixed(0)}%，建议关注未提交作业的学生`,
        priority: "medium",
        icon: <Users className="w-5 h-5" />,
        action: "查看学生详情",
      });
    }

    // General positive feedback
    if (trends.summary.averageExamScore >= 85 && trends.summary.averageAssignmentScore >= 80) {
      recommendations.push({
        title: "班级表现优秀",
        description: `作业均分 ${trends.summary.averageAssignmentScore.toFixed(1)}、考试均分 ${trends.summary.averageExamScore.toFixed(1)}，可适当提高难度`,
        priority: "low",
        icon: <CheckCircle2 className="w-5 h-5" />,
        action: "生成进阶练习",
      });
    }

    // Always suggest regular review
    recommendations.push({
      title: "定期复习建议",
      description: "建议每周安排一次综合复习，覆盖近两周的知识点和错题",
      priority: "medium",
      icon: <Calendar className="w-5 h-5" />,
      action: "生成复习计划",
    });

    return recommendations;
  };

  const recommendations = getReviewRecommendations();

  // Build a simple weekly review schedule template
  const buildScheduleTemplate = () => {
    const days = ["周一", "周二", "周三", "周四", "周五"];
    const schedule = [
      { day: days[0], focus: "错题回顾", type: "错题重做", duration: "20分钟" },
      { day: days[1], focus: "知识点巩固", type: "基础练习", duration: "15分钟" },
      { day: days[2], focus: "综合练习", type: "混合题型", duration: "25分钟" },
      { day: days[3], focus: "薄弱环节突破", type: "专项训练", duration: "20分钟" },
      { day: days[4], focus: "总结测试", type: "小测验", duration: "15分钟" },
    ];
    return schedule;
  };

  const schedule = buildScheduleTemplate();

  const priorityColors = {
    high: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-600" },
    medium: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-600" },
    low: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-600" },
  };

  const priorityLabels = { high: "高优先", medium: "中优先", low: "低优先" };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center mr-3">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">安排复习</h2>
            <p className="text-sm text-gray-500">智能复习计划与建议</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      {/* Class Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">选择班级</label>
        <select
          value={selectedClassId || ""}
          onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
          className="w-full sm:w-64 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
        >
          <option value="">请选择班级</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </div>

      {!selectedClassId ? (
        <div className="text-center py-16">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">请选择一个班级查看复习建议</p>
        </div>
      ) : trendsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mr-3" />
          <span className="text-gray-500">分析中...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Class Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{trends?.summary.totalStudents}</p>
              <p className="text-xs text-gray-500">学生</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-700">{trends?.summary.averageAssignmentScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">作业均分</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-purple-700">{trends?.summary.averageExamScore.toFixed(1)}</p>
              <p className="text-xs text-gray-500">考试均分</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-700">{trends?.summary.totalMistakes}</p>
              <p className="text-xs text-gray-500">错题</p>
            </div>
          </div>

          {/* Review Recommendations */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
              智能复习建议
            </h3>
            <div className="space-y-3">
              {recommendations.map((rec, i) => {
                const colors = priorityColors[rec.priority];
                return (
                  <div
                    key={i}
                    className={`${colors.bg} ${colors.border} border rounded-xl p-4 flex items-start gap-3`}
                  >
                    <div className={`${colors.text} mt-0.5`}>{rec.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{rec.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                          {priorityLabels[rec.priority]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                    <button
                      onClick={() => toast.info("功能开发中，敬请期待")}
                      className="text-sm text-orange-600 hover:text-orange-700 font-medium whitespace-nowrap flex items-center gap-1"
                    >
                      {rec.action}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Schedule Template */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 text-blue-500 mr-2" />
              推荐复习计划
            </h3>
            <div className="space-y-2">
              {schedule.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-16 text-center">
                    <span className="text-sm font-bold text-gray-700">{item.day}</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{item.focus}</p>
                    <p className="text-xs text-gray-500">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {item.duration}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                此计划基于班级整体数据生成，您可根据实际情况调整
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
