import { z } from "zod";
import { db } from "~/server/db";
import { authedProcedure } from "~/server/trpc/main";
import { assertSubmissionAccess } from "~/server/services/grading";
import { getSignedReadUrl } from "~/server/storage";

const mistakeInclude = {
  orderBy: { id: "asc" },
  include: { knowledgeArea: { select: { id: true, name: true } } },
} as const;

export const getSubmissionAnalysis = authedProcedure
  .input(z.object({
    kind: z.enum(["assignment", "exam"]),
    id: z.number(),
  }))
  .query(async ({ input, ctx }) => {
    const submission = await assertSubmissionAccess(input.kind, input.id, ctx.auth);

    const analysis =
      input.kind === "assignment"
        ? await db.assignmentAnalysis.findUnique({
            where: { assignmentId: input.id },
            include: { mistakes: mistakeInclude },
          })
        : await db.examAnalysis.findUnique({
            where: { examId: input.id },
            include: { mistakes: mistakeInclude },
          });

    let imageUrl: string | null = null;
    try {
      imageUrl = await getSignedReadUrl(submission.imageUrl);
    } catch (error) {
      console.error("Failed to sign image URL:", error);
    }

    return {
      kind: input.kind,
      id: submission.id,
      title: submission.title,
      createdAt: submission.createdAt,
      uploadedBy: submission.uploadedBy,
      analysisStatus: submission.analysisStatus,
      analysisError: submission.analysisError,
      imageUrl,
      student: submission.student
        ? {
            id: submission.student.id,
            name: submission.student.name,
            className: submission.student.class?.name ?? null,
          }
        : null,
      analysis: analysis
        ? {
            id: analysis.id,
            score: analysis.score,
            grade: analysis.grade,
            feedback: analysis.feedback,
            strengths: analysis.strengths,
            improvements: analysis.improvements,
            modelUsed: analysis.modelUsed,
            createdAt: analysis.createdAt,
            mistakes: analysis.mistakes.map((m) => ({
              id: m.id,
              description: m.description,
              knowledgeArea: m.knowledgeArea?.name ?? null,
              originalQuestionText: m.originalQuestionText,
              studentAnswer: m.studentAnswer,
              correctAnswer: m.correctAnswer,
            })),
          }
        : null,
    };
  });
