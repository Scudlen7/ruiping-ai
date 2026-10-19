export type DashboardModule =
  | "learning-analysis"
  | "grades"
  | "assignments"
  | "exams"
  | "knowledge-map"
  | "students"
  | "classes"
  | "reports"
  | "messages"
  | "settings";

export const moduleCopy: Record<DashboardModule, { title: string; subtitle: string }> = {
  "learning-analysis": { title: "学情分析", subtitle: "围绕成绩趋势、参与度与薄弱点组织课堂决策。" },
  grades: { title: "成绩管理", subtitle: "集中查看学生成绩、排名与班级分布。" },
  assignments: { title: "作业分析", subtitle: "追踪作业提交、评分与错因反馈。" },
  exams: { title: "试卷分析", subtitle: "查看试卷成绩表现、失分点与改进方向。" },
  "knowledge-map": { title: "知识图谱", subtitle: "按知识点聚合掌握度、错题与影响学生。" },
  students: { title: "学生管理", subtitle: "维护学生名单、关注对象与学习记录。" },
  classes: { title: "班级管理", subtitle: "管理班级档案、学生规模与课堂入口。" },
  reports: { title: "报告中心", subtitle: "生成班级报告、学生报告与学情汇总。" },
  messages: { title: "消息中心", subtitle: "批改失败、家长绑定申请、低分学生与薄弱知识点。" },
  settings: { title: "设置中心", subtitle: "查看账号信息、今日 AI 额度与系统配置。" },
};

/** Modules that show the shared class metric cards above their content. */
export const modulesWithClassMetrics: ReadonlySet<DashboardModule> = new Set([
  "learning-analysis",
  "grades",
  "assignments",
  "exams",
  "knowledge-map",
  "reports",
  "messages",
]);
