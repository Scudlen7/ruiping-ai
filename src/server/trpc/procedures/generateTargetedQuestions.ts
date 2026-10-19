import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { generateTargetedQuestions, resolveModelKey } from "~/server/ai-service";
import { trackAiCall } from "~/server/ai/usage";
import { toAiTrpcError } from "~/server/ai/errors";

export const generateTargetedQuestionsProcedure = teacherProcedure
  .input(z.object({
    studentId: z.number(),
    knowledgeAreaIds: z.array(z.number()).optional(), // Optional filter by specific knowledge areas
    questionCount: z.number().min(1).max(20).default(5), // Number of questions to generate
    difficultyLevel: z.enum(["easy", "medium", "hard"]).default("medium"),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      // Verify the student belongs to one of the teacher's classes
      const student = await db.student.findFirst({
        where: {
          id: input.studentId,
          class: {
            teacherId: ctx.auth.teacherId,
          },
        },
        include: {
          class: true,
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "学生不存在或不在您的班级中",
        });
      }

      // Get the student's recent mistakes
      const recentMistakes = await db.mistake.findMany({
        where: {
          studentId: input.studentId,
          ...(input.knowledgeAreaIds && input.knowledgeAreaIds.length > 0
            ? { knowledgeAreaId: { in: input.knowledgeAreaIds } }
            : {}),
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Get recent mistakes for context
      });

      const examMistakes = await db.examMistake.findMany({
        where: {
          studentId: input.studentId,
          ...(input.knowledgeAreaIds && input.knowledgeAreaIds.length > 0
            ? { knowledgeAreaId: { in: input.knowledgeAreaIds } }
            : {}),
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      // Combine all mistakes
      const allMistakes = [...recentMistakes, ...examMistakes];

      if (allMistakes.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "该学生在所选知识点下暂无错题记录，无法生成练习题",
        });
      }

      // Get knowledge areas from mistakes
      const knowledgeAreaIds = Array.from(
        new Set(allMistakes.map(m => m.knowledgeAreaId).filter(Boolean))
      ) as number[];

      // Get relevant teaching materials from the teacher's knowledge base
      const teachingMaterials = await db.teachingMaterial.findMany({
        where: {
          teacherId: ctx.auth.teacherId,
          knowledgeAreaId: { in: knowledgeAreaIds },
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      const modelKey = resolveModelKey(input.modelKey);
      const questions = await trackAiCall(ctx.auth, "questions", modelKey, () =>
        generateTargetedQuestions({
          mistakes: allMistakes,
          teachingMaterials,
          studentName: student.name,
          questionCount: input.questionCount,
          difficultyLevel: input.difficultyLevel,
          modelKey,
        }),
      );

      return {
        success: true,
        questions,
        mistakesAnalyzed: allMistakes.length,
        materialsUsed: teachingMaterials.length,
        modelUsed: modelKey,
        studentName: student.name,
      };
    } catch (error) {
      if (!(error instanceof TRPCError)) console.error("Generate targeted questions error:", error);
      throw toAiTrpcError(error, "生成练习题");
    }
  });
