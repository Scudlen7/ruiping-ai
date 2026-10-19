import { BarChart3, BookOpen, Brain, Clock, LibraryBig, PieChart, Plus, Target, Users } from "lucide-react";
import { ModuleButton } from "../ui";
import type { DashboardPageContext } from "../types";
import type { DashboardModule } from "./config";

export function ModuleActions({ module, ctx }: { module: DashboardModule; ctx: DashboardPageContext }) {
  switch (module) {
    case "learning-analysis":
    case "assignments":
      return (
        <>
          <ModuleButton icon={Target} onClick={ctx.openMistakeLibrary}>
            错题库
          </ModuleButton>
          <ModuleButton icon={Brain} onClick={ctx.openQuestionGenerator}>
            智能出题
          </ModuleButton>
        </>
      );
    case "grades":
      return (
        <>
          <ModuleButton icon={Users} onClick={ctx.openStudentsDashboard}>
            学生管理
          </ModuleButton>
          <ModuleButton icon={PieChart} onClick={ctx.openReportsDashboard}>
            报告中心
          </ModuleButton>
        </>
      );
    case "exams":
      return (
        <>
          <ModuleButton icon={BarChart3} onClick={ctx.openDataAnalysis}>
            学情分析
          </ModuleButton>
          <ModuleButton icon={PieChart} onClick={ctx.openReportsDashboard}>
            报告中心
          </ModuleButton>
        </>
      );
    case "knowledge-map":
      return (
        <>
          <ModuleButton icon={LibraryBig} onClick={ctx.openTeachingMaterials}>
            教学资料
          </ModuleButton>
          <ModuleButton icon={Brain} onClick={ctx.openQuestionGenerator}>
            智能出题
          </ModuleButton>
        </>
      );
    case "students":
      return (
        <>
          <ModuleButton icon={BarChart3} onClick={ctx.openDataAnalysis}>
            学情分析
          </ModuleButton>
          <ModuleButton icon={BookOpen} onClick={ctx.openSelectedClass}>
            班级工作台
          </ModuleButton>
        </>
      );
    case "classes":
      return (
        <ModuleButton icon={Plus} tone="primary" onClick={ctx.openCreateClass}>
          新建班级
        </ModuleButton>
      );
    case "reports":
      return (
        <>
          <ModuleButton icon={BarChart3} onClick={ctx.openDataAnalysis}>
            学情分析
          </ModuleButton>
          <ModuleButton icon={Users} onClick={ctx.openStudentsDashboard}>
            学生管理
          </ModuleButton>
        </>
      );
    case "messages":
      return (
        <ModuleButton icon={Clock} onClick={ctx.openReviewSchedule}>
          复习安排
        </ModuleButton>
      );
    case "settings":
      return (
        <ModuleButton icon={BookOpen} onClick={ctx.openClassesDashboard}>
          班级管理
        </ModuleButton>
      );
    default:
      return null;
  }
}
