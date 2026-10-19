import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import type { Prisma } from "@prisma/client";
import { generateTargetedQuestions, resolveModelKey } from "~/server/ai-service";
import { trackAiCall } from "~/server/ai/usage";
import { toAiTrpcError } from "~/server/ai/errors";

export const generateClassQuestionsProcedure = teacherProcedure
  .input(z.object({
    classId: z.number(),
    knowledgeAreaIds: z.array(z.number()).optional(),
    questionCount: z.number().min(1).max(20).default(5),
    difficultyLevel: z.enum(["easy", "medium", "hard"]).default("medium"),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      // Verify class ownership
      const classData = await db.class.findFirst({
        where: {
          id: input.classId,
          teacherId: ctx.auth.teacherId,
        },
      });

      if (!classData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "班级不存在或您没有权限",
        });
      }

      // Get all students in the class
      const students = await db.student.findMany({
        where: { classId: input.classId },
      });

      if (students.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "该班级暂无学生",
        });
      }

      const studentIds = students.map(s => s.id);

      // Get mistakes across ALL students in the class
      const mistakesFilter: Prisma.MistakeWhereInput & Prisma.ExamMistakeWhereInput = {
        studentId: { in: studentIds },
        ...(input.knowledgeAreaIds?.length ? { knowledgeAreaId: { in: input.knowledgeAreaIds } } : {}),
      };

      const recentMistakes = await db.mistake.findMany({
        where: mistakesFilter,
        include: {
          knowledgeArea: true,
          student: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      const examMistakes = await db.examMistake.findMany({
        where: mistakesFilter,
        include: {
          knowledgeArea: true,
          student: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      const allMistakes = [...recentMistakes, ...examMistakes];

      if (allMistakes.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "该班级暂无错题记录，无法生成练习题",
        });
      }

      // Get knowledge areas from mistakes
      const knowledgeAreaIds = Array.from(
        new Set(allMistakes.map(m => m.knowledgeAreaId).filter(Boolean))
      ) as number[];

      // Get teaching materials
      const teachingMaterials = await db.teachingMaterial.findMany({
        where: {
          teacherId: ctx.auth.teacherId,
          knowledgeAreaId: { in: knowledgeAreaIds },
        },
        include: { knowledgeArea: true },
        orderBy: { updatedAt: 'desc' },
      });

      const modelKey = resolveModelKey(input.modelKey);

      // Count how many students made each mistake type
      const mistakeFrequency = new Map<string, { description: string; count: number; students: string[] }>();
      allMistakes.forEach(m => {
        const key = m.description;
        if (mistakeFrequency.has(key)) {
          const entry = mistakeFrequency.get(key)!;
          entry.count++;
          if (!entry.students.includes(m.student?.name || '')) {
            entry.students.push(m.student?.name || '');
          }
        } else {
          mistakeFrequency.set(key, {
            description: m.description,
            count: 1,
            students: [m.student?.name || ''],
          });
        }
      });

      // Sort by frequency — most common mistakes first
      const topMistakes = Array.from(mistakeFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate questions focused on most common class mistakes
      const questions = await trackAiCall(ctx.auth, "questions", modelKey, () =>
        generateTargetedQuestions({
          mistakes: allMistakes.slice(0, 15),
          teachingMaterials,
          studentName: `${classData.name} 全班`,
          questionCount: input.questionCount,
          difficultyLevel: input.difficultyLevel,
          modelKey,
        }),
      );

      return {
        success: true,
        questions,
        totalMistakes: allMistakes.length,
        topMistakes,
        materialsUsed: teachingMaterials.length,
        modelUsed: modelKey,
        className: classData.name,
        studentCount: students.length,
      };
    } catch (error) {
      if (!(error instanceof TRPCError)) console.error("Generate class questions error:", error);
      throw toAiTrpcError(error, "生成全班练习题");
    }
  });
