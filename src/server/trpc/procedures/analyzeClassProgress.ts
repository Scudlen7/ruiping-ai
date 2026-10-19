import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { masteryToLevel } from "~/lib/grading";
import { analyzeClassProgressData, resolveModelKey, type ClassProgressInsight } from "~/server/ai-service";
import { trackAiCall } from "~/server/ai/usage";
import { describeAiError } from "~/server/ai/errors";

const INSIGHT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_CLASSES = 500;

/** classId -> last insight; reused while the class statistics are unchanged and the entry is fresh. */
const insightCache = new Map<number, { fingerprint: string; createdAt: number; insight: ClassProgressInsight }>();

function cachedInsight(classId: number, fingerprint: string): ClassProgressInsight | null {
  const entry = insightCache.get(classId);
  if (!entry || entry.fingerprint !== fingerprint || Date.now() - entry.createdAt > INSIGHT_TTL_MS) return null;
  return entry.insight;
}

function rememberInsight(classId: number, fingerprint: string, insight: ClassProgressInsight) {
  if (insightCache.size >= MAX_CACHED_CLASSES) {
    const oldest = insightCache.keys().next().value;
    if (oldest !== undefined) insightCache.delete(oldest);
  }
  insightCache.set(classId, { fingerprint, createdAt: Date.now(), insight });
}

export const analyzeClassProgress = teacherProcedure
  .input(z.object({ classId: z.number() }))
  .query(async ({ input, ctx }) => {
    const classData = await db.class.findFirst({
      where: { id: input.classId, teacherId: ctx.auth.teacherId },
      include: {
        students: {
          include: {
            _count: { select: { assignments: true, exams: true, mistakes: true, examMistakes: true } },
            studentKnowledgeAreas: { include: { knowledgeArea: true } },
          },
        },
      },
    });
    if (!classData) {
      throw new TRPCError({ code: "NOT_FOUND", message: "班级不存在或您没有权限查看" });
    }

    const totalStudents = classData.students.length;
    const totalAssignments = classData.students.reduce((sum, s) => sum + s._count.assignments, 0);
    const totalExams = classData.students.reduce((sum, s) => sum + s._count.exams, 0);
    const totalMistakes = classData.students.reduce((sum, s) => sum + s._count.mistakes + s._count.examMistakes, 0);

    const areaStats = new Map<string, { total: number; beginner: number; intermediate: number; advanced: number }>();
    for (const student of classData.students) {
      for (const ska of student.studentKnowledgeAreas) {
        const stats = areaStats.get(ska.knowledgeArea.name) ?? { total: 0, beginner: 0, intermediate: 0, advanced: 0 };
        stats.total++;
        stats[masteryToLevel(ska.mastery)]++;
        areaStats.set(ska.knowledgeArea.name, stats);
      }
    }
    const knowledgeAreaStats = [...areaStats.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    const classStats = { totalStudents, totalAssignments, totalExams, totalMistakes, knowledgeAreaStats };
    const result = (aiAnalysis: ClassProgressInsight | undefined, aiError?: string) => ({ classStats, aiAnalysis, aiError });

    if (totalAssignments + totalExams === 0 || knowledgeAreaStats.length === 0) {
      return result(undefined, "暂无已批改的作业或试卷，完成批改后即可生成 AI 进度分析");
    }

    const fingerprint = JSON.stringify(classStats);
    const cached = cachedInsight(classData.id, fingerprint);
    if (cached) return result(cached);

    const instructions = `作为一名教育专家，请分析以下班级数据并评估教学目标达成进度。只依据给出的数据下结论，不要编造数据中没有的信息。

班级信息：
- 班级名称：${classData.name}
- 学生人数：${totalStudents}
- 总作业数：${totalAssignments}
- 总考试数：${totalExams}
- 总错误数：${totalMistakes}

知识点掌握情况（人数）：
${knowledgeAreaStats
  .slice(0, 40)
  .map((s) => `- ${s.name}：共${s.total}人，初级${s.beginner}人，中级${s.intermediate}人，高级${s.advanced}人`)
  .join("\n")}

progressPercentage 为 0-100 的整数，表示整体教学目标达成百分比；keyInsights、recommendedActions 各 3 条左右。`;

    const modelKey = resolveModelKey();
    try {
      const insight = await trackAiCall(ctx.auth, "class-progress", modelKey, () =>
        analyzeClassProgressData(instructions, modelKey),
      );
      rememberInsight(classData.id, fingerprint, insight);
      return result(insight);
    } catch (error) {
      if (!(error instanceof TRPCError)) console.error("Class progress analysis failed:", error);
      return result(undefined, error instanceof TRPCError ? error.message : describeAiError(error));
    }
  });
