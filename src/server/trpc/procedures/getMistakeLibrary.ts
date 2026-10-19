import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

export const getMistakeLibraryProcedure = teacherProcedure
  .input(
    z.object({
      classId: z.number(),
      knowledgeAreaId: z.number().optional(),
      studentId: z.number().optional(),
      keyword: z.string().trim().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }),
  )
  .query(async ({ input, ctx }) => {
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

      const studentIds = (
        await db.student.findMany({
          where: { classId: input.classId },
          select: { id: true },
        })
      ).map((s) => s.id);

      const baseWhere = {
        studentId: { in: studentIds },
      };
      if (input.knowledgeAreaId) {
        Object.assign(baseWhere, { knowledgeAreaId: input.knowledgeAreaId });
      }
      if (input.studentId) {
        Object.assign(baseWhere, { studentId: input.studentId });
      }
      const keyword = input.keyword?.trim();
      const assignmentWhere = keyword
        ? {
            ...baseWhere,
            OR: [
              { description: { contains: keyword } },
              { originalQuestionText: { contains: keyword } },
              { correctAnswer: { contains: keyword } },
              { student: { name: { contains: keyword } } },
              { knowledgeArea: { name: { contains: keyword } } },
              { analysis: { assignment: { title: { contains: keyword } } } },
            ],
          }
        : baseWhere;
      const examWhere = keyword
        ? {
            ...baseWhere,
            OR: [
              { description: { contains: keyword } },
              { originalQuestionText: { contains: keyword } },
              { correctAnswer: { contains: keyword } },
              { student: { name: { contains: keyword } } },
              { knowledgeArea: { name: { contains: keyword } } },
              { analysis: { exam: { title: { contains: keyword } } } },
            ],
          }
        : baseWhere;

      const [mistakes, examMistakes] = await Promise.all([
        db.mistake.findMany({
          where: assignmentWhere,
          include: {
            student: { select: { id: true, name: true } },
            knowledgeArea: { select: { id: true, name: true } },
            analysis: {
              select: {
                assignment: {
                  select: { id: true, title: true, createdAt: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.examMistake.findMany({
          where: examWhere,
          include: {
            student: { select: { id: true, name: true } },
            knowledgeArea: { select: { id: true, name: true } },
            analysis: {
              select: {
                exam: { select: { id: true, title: true, createdAt: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Combine and sort
      const allMistakes = [
        ...mistakes.map((m) => ({
          id: m.id,
          description: m.description,
          originalQuestionText: m.originalQuestionText,
          correctAnswer: m.correctAnswer,
          createdAt: m.createdAt,
          student: m.student,
          knowledgeArea: m.knowledgeArea,
          source: "assignment" as const,
          sourceTitle: m.analysis?.assignment?.title,
        })),
        ...examMistakes.map((m) => ({
          id: m.id,
          description: m.description,
          originalQuestionText: m.originalQuestionText,
          correctAnswer: m.correctAnswer,
          createdAt: m.createdAt,
          student: m.student,
          knowledgeArea: m.knowledgeArea,
          source: "exam" as const,
          sourceTitle: m.analysis?.exam?.title,
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const total = allMistakes.length;
      const paginatedMistakes = allMistakes.slice(
        (input.page - 1) * input.pageSize,
        input.page * input.pageSize,
      );

      // Stats
      const mistakeByStudent = new Map<string, number>();
      const mistakeByKnowledgeArea = new Map<string, number>();
      allMistakes.forEach((m) => {
        const studentName = m.student?.name || "未知";
        mistakeByStudent.set(
          studentName,
          (mistakeByStudent.get(studentName) || 0) + 1,
        );
        const kaName = m.knowledgeArea?.name || "未分类";
        mistakeByKnowledgeArea.set(
          kaName,
          (mistakeByKnowledgeArea.get(kaName) || 0) + 1,
        );
      });

      return {
        mistakes: paginatedMistakes,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
        stats: {
          totalMistakes: total,
          byStudent: Array.from(mistakeByStudent.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
          byKnowledgeArea: Array.from(mistakeByKnowledgeArea.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "获取错题库失败",
      });
    }
  });
