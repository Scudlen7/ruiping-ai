import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  LibraryBig,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardNavigation, KnowledgeAreaSummary } from "./types";

export type DashboardInsight = {
  title: string;
  description: string;
  tag: string;
  icon: LucideIcon;
  iconClassName: string;
  onClick: () => void;
};

type InsightNavigation = Pick<
  DashboardNavigation,
  | "openCreateClass"
  | "openTeachingMaterials"
  | "openUploadForSelectedClass"
  | "openReviewSchedule"
  | "openDataAnalysis"
  | "openMistakeLibrary"
  | "openQuestionGenerator"
  | "openStudentsDashboard"
>;

export function buildInsights({
  selectedClassName,
  averageScore,
  scoreDelta,
  coverageRate,
  lowScoreCount,
  weakestArea,
  hasPerformanceData,
  navigation,
}: {
  selectedClassName?: string;
  averageScore: number | null;
  /** Change in average score against the previous period. */
  scoreDelta: number | null;
  coverageRate: number | null;
  lowScoreCount: number;
  weakestArea?: KnowledgeAreaSummary;
  hasPerformanceData: boolean;
  navigation: InsightNavigation;
}): DashboardInsight[] {
  if (!selectedClassName) {
    return [
      {
        title: "先创建一个班级",
        description: "创建班级并导入学生后，仪表盘会自动汇总各项学情数据。",
        tag: "待开始",
        icon: BookOpen,
        iconClassName: "bg-blue-500",
        onClick: navigation.openCreateClass,
      },
      {
        title: "准备教学资料",
        description: "资料库可以沉淀教材、讲义和知识点，后续出题会更贴合课堂。",
        tag: "建议",
        icon: LibraryBig,
        iconClassName: "bg-violet-500",
        onClick: navigation.openTeachingMaterials,
      },
    ];
  }

  if (!hasPerformanceData) {
    return [
      {
        title: `${selectedClassName} 所选时段暂无成绩`,
        description: "上传并分析作业或试卷后，趋势图和排行会自动从真实数据生成。",
        tag: "数据",
        icon: BarChart3,
        iconClassName: "bg-blue-500",
        onClick: navigation.openUploadForSelectedClass,
      },
      {
        title: "可以先建立复习计划",
        description: "在没有成绩数据前，可以先根据课堂进度安排下一轮复习节奏。",
        tag: "复习",
        icon: Timer,
        iconClassName: "bg-violet-500",
        onClick: navigation.openReviewSchedule,
      },
      {
        title: "建议补充教学资料",
        description: "资料越完整，智能出题和错因归纳越容易贴近班级实际情况。",
        tag: "资料",
        icon: LibraryBig,
        iconClassName: "bg-emerald-500",
        onClick: navigation.openTeachingMaterials,
      },
    ];
  }

  const average = averageScore === null ? "--" : averageScore.toFixed(1);
  const trendInsight: DashboardInsight =
    scoreDelta === null
      ? {
          title: `班级均分 ${average}`,
          description: "上一时段没有成绩记录，暂时无法判断升降，继续积累后会自动对比。",
          tag: "趋势",
          icon: BarChart3,
          iconClassName: "bg-blue-500",
          onClick: navigation.openDataAnalysis,
        }
      : Math.abs(scoreDelta) < 0.5
        ? {
            title: `班级均分 ${average}，与上期持平`,
            description: `较上一时段变化 ${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)} 分，整体保持稳定。`,
            tag: "趋势",
            icon: BarChart3,
            iconClassName: "bg-blue-500",
            onClick: navigation.openDataAnalysis,
          }
        : scoreDelta > 0
          ? {
              title: `班级均分提升 ${scoreDelta.toFixed(1)} 分`,
              description: `${selectedClassName} 当前均分 ${average}，可以把进步明显的解题方法整理为讲评素材。`,
              tag: "趋势",
              icon: TrendingUp,
              iconClassName: "bg-emerald-500",
              onClick: navigation.openDataAnalysis,
            }
          : {
              title: `班级均分下降 ${Math.abs(scoreDelta).toFixed(1)} 分`,
              description: `${selectedClassName} 当前均分 ${average}，建议查看最近错题并安排一次针对性复习。`,
              tag: "趋势",
              icon: TrendingDown,
              iconClassName: "bg-rose-500",
              onClick: navigation.openMistakeLibrary,
            };

  const knowledgeInsight: DashboardInsight = weakestArea
    ? {
        title: `「${weakestArea.name}」掌握度 ${weakestArea.mastery.toFixed(0)}%`,
        description:
          weakestArea.mistakeCount > 0
            ? `全班最薄弱的知识点，所选时段出现错题 ${weakestArea.mistakeCount} 次，可一键生成针对练习。`
            : `全班最薄弱的知识点，${weakestArea.masteryStudentCount} 名学生有记录，可一键生成针对练习。`,
        tag: "知识点",
        icon: Brain,
        iconClassName: "bg-violet-500",
        onClick: navigation.openQuestionGenerator,
      }
    : {
        title: "暂无知识点掌握数据",
        description: "AI 批改会为每名学生记录知识点掌握度，之后这里会提示最需要关注的薄弱领域。",
        tag: "知识点",
        icon: Brain,
        iconClassName: "bg-violet-500",
        onClick: navigation.openMistakeLibrary,
      };

  const coverageText = coverageRate === null ? "" : `所选时段提交覆盖率 ${coverageRate.toFixed(1)}%。`;
  const studentInsight: DashboardInsight =
    lowScoreCount > 0
      ? {
          title: `${lowScoreCount} 名学生均分低于 60`,
          description: `建议结合错题库查看个体薄弱点。${coverageText}`,
          tag: "行动",
          icon: Target,
          iconClassName: "bg-orange-500",
          onClick: navigation.openStudentsDashboard,
        }
      : coverageRate !== null && coverageRate < 80
        ? {
            title: `提交覆盖率 ${coverageRate.toFixed(0)}%`,
            description: "部分学生在所选时段没有提交记录，可以在学生管理中查看并提醒。",
            tag: "行动",
            icon: Users,
            iconClassName: "bg-orange-500",
            onClick: navigation.openStudentsDashboard,
          }
        : {
            title: "暂无低分学生",
            description: `所有有成绩的学生均分都在 60 分以上。${coverageText}`,
            tag: "行动",
            icon: CheckCircle2,
            iconClassName: "bg-emerald-500",
            onClick: navigation.openStudentsDashboard,
          };

  return [trendInsight, knowledgeInsight, studentInsight];
}
