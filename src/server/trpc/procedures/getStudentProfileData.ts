import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { authedProcedure } from "~/server/trpc/main";
import { average, masteryToLevel } from "~/lib/grading";
import { studentAccessFilter } from "~/server/services/grading";

export const getStudentProfileData = authedProcedure
  .input(z.object({ 
    studentId: z.number(),
  }))
  .query(async ({ input, ctx }) => {
    try {
      const student = await db.student.findFirst({
        where: {
          id: input.studentId,
          ...studentAccessFilter(ctx.auth),
        },
        include: {
          class: true,
          assignments: {
            include: {
              analysis: {
                include: {
                  mistakes: {
                    include: {
                      knowledgeArea: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          exams: {
            include: {
              analysis: {
                include: {
                  mistakes: {
                    include: {
                      knowledgeArea: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          mistakes: {
            include: {
              knowledgeArea: true,
              analysis: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          examMistakes: {
            include: {
              knowledgeArea: true,
              analysis: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          studentKnowledgeAreas: {
            include: {
              knowledgeArea: true,
            },
          },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found or you don't have permission to view their profile",
        });
      }

      // Calculate statistics
      const totalMistakes = student.mistakes.length + student.examMistakes.length;
      
      // Group mistakes by knowledge area
      const mistakesByKnowledgeArea = new Map<string, number>();
      [...student.mistakes, ...student.examMistakes].forEach(mistake => {
        if (mistake.knowledgeArea) {
          const current = mistakesByKnowledgeArea.get(mistake.knowledgeArea.name) || 0;
          mistakesByKnowledgeArea.set(mistake.knowledgeArea.name, current + 1);
        }
      });

      const linkedParents =
        ctx.auth.teacherId != null
          ? (
              await db.parentStudent.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: "asc" },
                select: { relation: true, createdAt: true, parent: { select: { id: true, name: true, phoneNumber: true } } },
              })
            ).map((link) => ({ ...link.parent, relation: link.relation, linkedAt: link.createdAt }))
          : null;

      const averageMastery = average(student.studentKnowledgeAreas.map(ska => ska.mastery));
      const averageScore = average([
        ...student.assignments.map(a => a.analysis?.score),
        ...student.exams.map(e => e.analysis?.score),
      ]);

      return {
        student: {
          ...student,
          studentKnowledgeAreas: student.studentKnowledgeAreas
            .map(ska => ({ ...ska, proficiencyLevel: masteryToLevel(ska.mastery) }))
            .sort((a, b) => a.mastery - b.mastery),
        },
        /** Only for the class teacher; parents see their family list in getParentOverview. */
        linkedParents,
        statistics: {
          totalAssignments: student.assignments.length,
          totalExams: student.exams.length,
          totalMistakes,
          /** 0-1 */
          averageMastery,
          /** 0-100 */
          averageScore,
          pendingAnalyses: [...student.assignments, ...student.exams].filter(
            s => s.analysisStatus === 'pending' || s.analysisStatus === 'processing'
          ).length,
          mistakesByKnowledgeArea: Array.from(mistakesByKnowledgeArea.entries()).map(([name, count]) => ({
            name,
            count,
          })),
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
