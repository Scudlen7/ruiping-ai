import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { authedProcedure } from "~/server/trpc/main";
import { masteryToLevel } from "~/lib/grading";
import { studentAccessFilter } from "~/server/services/grading";

export const getStudentPerformanceTrends = authedProcedure
  .input(z.object({ 
    studentId: z.number(),
    timeRange: z.enum(['7d', '30d', '90d', '1y', 'all']).optional().default('30d'),
  }))
  .query(async ({ input, ctx }) => {
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      
      switch (input.timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
        default:
          startDate = new Date(0); // Beginning of time
          break;
      }

      const student = await db.student.findFirst({
        where: {
          id: input.studentId,
          ...studentAccessFilter(ctx.auth),
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found or you don't have permission to view their data",
        });
      }

      // Fetch assignment performance trends
      const assignments = await db.assignment.findMany({
        where: {
          studentId: input.studentId,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          analysis: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Fetch exam performance trends
      const exams = await db.exam.findMany({
        where: {
          studentId: input.studentId,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          analysis: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Process assignment scores over time
      const assignmentTrends = assignments
        .filter(a => a.analysis?.score != null)
        .map(assignment => ({
          date: assignment.createdAt.toISOString().split('T')[0] ?? '',
          score: assignment.analysis!.score!,
          title: assignment.title,
          type: 'assignment' as const,
        }));

      // Process exam scores over time
      const examTrends = exams
        .filter(e => e.analysis?.score != null)
        .map(exam => ({
          date: exam.createdAt.toISOString().split('T')[0] ?? '',
          score: exam.analysis!.score!,
          title: exam.title,
          type: 'exam' as const,
        }));

      // Combine and sort all performance data
      const performanceTrends = [...assignmentTrends, ...examTrends]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Current mastery per knowledge area (snapshot at last update)
      const knowledgeAreaHistory = await db.studentKnowledgeArea.findMany({
        where: {
          studentId: input.studentId,
          updatedAt: {
            gte: startDate,
          },
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          updatedAt: 'asc',
        },
      });

      // proficiency is a percentage (0-100)
      const proficiencyTrends = knowledgeAreaHistory.map(ska => ({
        date: ska.updatedAt.toISOString().split('T')[0] ?? '',
        knowledgeArea: ska.knowledgeArea.name,
        proficiency: Math.round(ska.mastery * 1000) / 10,
        proficiencyLabel: masteryToLevel(ska.mastery),
      }));

      // Calculate mistake trends
      const mistakes = await db.mistake.findMany({
        where: {
          studentId: input.studentId,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const examMistakes = await db.examMistake.findMany({
        where: {
          studentId: input.studentId,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Group mistakes by date for trend analysis
      const mistakesByDate = new Map<string, number>();
      [...mistakes, ...examMistakes].forEach(mistake => {
        const date = mistake.createdAt.toISOString().split('T')[0] ?? '';
        mistakesByDate.set(date, (mistakesByDate.get(date) || 0) + 1);
      });

      const mistakeTrends = Array.from(mistakesByDate.entries())
        .map(([date, count]) => ({
          date,
          mistakes: count,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        performanceTrends,
        proficiencyTrends,
        mistakeTrends,
        summary: {
          totalAssignments: assignmentTrends.length,
          totalExams: examTrends.length,
          averageAssignmentScore: assignmentTrends.length > 0 
            ? assignmentTrends.reduce((sum, a) => sum + a.score, 0) / assignmentTrends.length
            : 0,
          averageExamScore: examTrends.length > 0
            ? examTrends.reduce((sum, e) => sum + e.score, 0) / examTrends.length
            : 0,
          totalMistakes: mistakeTrends.reduce((sum, m) => sum + m.mistakes, 0),
          timeRange: input.timeRange,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
