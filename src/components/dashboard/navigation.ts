import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  ClipboardCheck,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LibraryBig,
  MessageSquareText,
  PieChart,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardNavKey } from "./types";

export const navItems: Array<{
  key: DashboardNavKey;
  label: string;
  icon: LucideIcon;
  href: string;
}> = [
  { key: "overview", label: "首页概览", icon: LayoutDashboard, href: "/dashboard" },
  { key: "learning-analysis", label: "学情分析", icon: BarChart3, href: "/dashboard/learning-analysis" },
  { key: "grades", label: "成绩管理", icon: FileBarChart, href: "/dashboard/grades" },
  { key: "assignments", label: "作业分析", icon: ClipboardCheck, href: "/dashboard/assignments" },
  { key: "exams", label: "试卷分析", icon: FileText, href: "/dashboard/exams" },
  { key: "knowledge-map", label: "知识图谱", icon: Brain, href: "/dashboard/knowledge-map" },
  { key: "mistakes", label: "错题库", icon: AlertTriangle, href: "/dashboard/mistakes" },
  { key: "materials", label: "教学资料", icon: LibraryBig, href: "/dashboard/materials" },
  { key: "question-generator", label: "智能出题", icon: Sparkles, href: "/dashboard/question-generator" },
  { key: "students", label: "学生管理", icon: Users, href: "/dashboard/students" },
  { key: "classes", label: "班级管理", icon: BookOpen, href: "/dashboard/classes" },
  { key: "reports", label: "报告中心", icon: PieChart, href: "/dashboard/reports" },
  { key: "messages", label: "消息中心", icon: MessageSquareText, href: "/dashboard/messages" },
  { key: "settings", label: "设置中心", icon: Settings, href: "/dashboard/settings" },
];
