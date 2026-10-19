import {
  Award,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  FileText,
  LibraryBig,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { formatPercent, type GradeBand } from "../metrics";
import { TrendChart } from "../TrendChart";
import { ActionList, CompactStat, EmptyState, MiniBars, Panel, RankIndicator } from "../ui";
import type { DashboardPageContext } from "../types";

export function LearningAnalysis({ ctx, gradeBands }: { ctx: DashboardPageContext; gradeBands: GradeBand[] }) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="学情趋势" subtitle="按天统计的作业与考试平均分" className="xl:col-span-8">
        <TrendChart data={ctx.trendChartData} />
      </Panel>
      <Panel title="成绩分层" subtitle={`按所选时段个人均分归档，共 ${ctx.studentRanking.length} 名学生有成绩`} className="xl:col-span-4">
        <div className="space-y-4">
          {gradeBands.map((band) => {
            const ratio = ctx.studentRanking.length ? (band.count / ctx.studentRanking.length) * 100 : 0;
            return (
              <div key={band.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-800">{band.label}</span>
                  <span className="text-slate-500">{band.count} 人</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${band.color}`} style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

export function GradesManagement({ ctx, gradeBands }: { ctx: DashboardPageContext; gradeBands: GradeBand[] }) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="成绩排名" subtitle="点击学生可进入个人画像" className="xl:col-span-8">
        {ctx.studentRanking.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-16 px-4 py-3 text-left">排名</th>
                  <th className="px-4 py-3 text-left">学生</th>
                  <th className="w-24 px-4 py-3 text-right">作业均分</th>
                  <th className="w-24 px-4 py-3 text-right">试卷均分</th>
                  <th className="w-24 px-4 py-3 text-right">总均分</th>
                  <th className="w-28 px-4 py-3 text-right">最近 7 次</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ctx.studentRanking.map((student, index) => (
                  <tr
                    key={student.studentId}
                    onClick={() => ctx.openSelectedStudent(student.studentId)}
                    className="cursor-pointer hover:bg-blue-50/60"
                  >
                    <td className="px-4 py-3">
                      <RankIndicator rank={index + 1} />
                    </td>
                    <td className="truncate px-4 py-3 font-bold text-slate-800">{student.studentName}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {student.assignmentCount > 0 ? student.assignmentAvg.toFixed(1) : "--"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {student.examCount > 0 ? student.examAvg.toFixed(1) : "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {student.averageScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <MiniBars scores={student.recentScores} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FileBarChart} title="暂无成绩记录" description="完成作业或试卷分析后，成绩表会自动出现。" />
        )}
      </Panel>
      <Panel title="分数段统计" subtitle="所选时段个人均分分布" className="xl:col-span-4">
        <div className="space-y-3">
          {gradeBands.map((band) => (
            <div key={band.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${band.color}`} />
                <span className="text-sm font-bold text-slate-800">{band.label}</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{band.count} 人</span>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

export function AssignmentAnalysis({
  ctx,
  avgItemsPerStudent,
}: {
  ctx: DashboardPageContext;
  avgItemsPerStudent: number | null;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="作业表现" subtitle="所选时段的提交、评分与趋势" className="xl:col-span-7">
        <div className="grid gap-4 sm:grid-cols-3">
          <CompactStat
            label="所选时段作业"
            value={`${ctx.performanceData?.summary.totalAssignments ?? 0}`}
            icon={ClipboardCheck}
          />
          <CompactStat
            label="人均已批改"
            value={avgItemsPerStudent === null ? "--" : avgItemsPerStudent.toFixed(1)}
            icon={Users}
          />
          <CompactStat label="提交覆盖率" value={formatPercent(ctx.coverageRate)} icon={CheckCircle2} />
        </div>
        <div className="mt-6">
          <TrendChart data={ctx.trendChartData} series={["assignmentAverage"]} />
        </div>
      </Panel>
      <Panel title="作业行动" subtitle="常用处理入口" className="xl:col-span-5">
        <ActionList
          items={[
            {
              icon: Upload,
              title: "上传或批量分析作业",
              text: "进入当前班级，继续处理学生提交记录。",
              onClick: ctx.openUploadForSelectedClass,
            },
            {
              icon: Brain,
              title: "基于错题生成练习",
              text: "针对薄弱知识点生成巩固题。",
              onClick: ctx.openQuestionGenerator,
            },
            {
              icon: Target,
              title: "查看错题库",
              text: "按学生、知识点和来源过滤作业错题。",
              onClick: ctx.openMistakeLibrary,
            },
          ]}
        />
      </Panel>
    </section>
  );
}

export function ExamAnalysis({ ctx }: { ctx: DashboardPageContext }) {
  const averageExamScore = ctx.performanceData?.summary.averageExamScore;
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="试卷概况" subtitle="所选时段的考试数量与平均表现" className="xl:col-span-5">
        <div className="grid gap-4">
          <CompactStat label="所选时段试卷" value={`${ctx.performanceData?.summary.totalExams ?? 0}`} icon={FileText} />
          <CompactStat label="试卷均分" value={averageExamScore ? averageExamScore.toFixed(1) : "--"} icon={Award} />
          <CompactStat label="及格率（作业+考试）" value={formatPercent(ctx.passingRate)} icon={CheckCircle2} />
        </div>
      </Panel>
      <Panel title="试卷趋势" subtitle="按天统计的考试平均分" className="xl:col-span-7">
        <TrendChart data={ctx.trendChartData} series={["examAverage"]} />
      </Panel>
    </section>
  );
}

export function KnowledgeMap({ ctx }: { ctx: DashboardPageContext }) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="知识点掌握" subtitle="全班学生当前掌握度的平均值，最薄弱的排在前面" className="xl:col-span-8">
        {ctx.knowledgeAreas.length > 0 ? (
          <div className="space-y-3">
            {ctx.knowledgeAreas.map((area) => (
              <div
                key={area.knowledgeAreaId}
                className="grid gap-3 rounded-lg border border-slate-100 px-4 py-3 sm:grid-cols-[1fr_180px_72px]"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">{area.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {area.masteryStudentCount} 名学生有记录
                    {area.mistakeCount > 0
                      ? `，所选时段 ${area.affectedStudentCount} 人出错 ${area.mistakeCount} 次`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${area.mastery}%` }} />
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-slate-900">{area.mastery.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Brain} title="暂无知识点" description="AI 批改完成后会记录每名学生的知识点掌握度，这里按全班平均展示。" />
        )}
      </Panel>
      <Panel title="知识点行动" subtitle="资料、错题与练习联动" className="xl:col-span-4">
        <ActionList
          items={[
            {
              icon: LibraryBig,
              title: "维护教学资料",
              text: "补充讲义、题型和知识点材料。",
              onClick: ctx.openTeachingMaterials,
            },
            {
              icon: Target,
              title: "查看错题明细",
              text: "定位薄弱知识点的原题与答案。",
              onClick: ctx.openMistakeLibrary,
            },
            {
              icon: Brain,
              title: "生成针对练习",
              text: "把薄弱点转成可练习题目。",
              onClick: ctx.openQuestionGenerator,
            },
          ]}
        />
      </Panel>
    </section>
  );
}
