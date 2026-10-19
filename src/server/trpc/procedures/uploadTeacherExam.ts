import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { enqueueSubmissionAnalysis } from "~/server/services/grading";
import { assertOwnedUpload } from "~/server/storage";
import { assertAiQuota } from "~/server/ai/usage";

export const uploadTeacherExam = teacherProcedure
  .input(z.object({
    studentId: z.number(),
    title: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string(),
    analyzeImmediately: z.boolean().default(true),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      const student = await db.student.findFirst({
        where: { id: input.studentId, class: { teacherId: ctx.auth.teacherId } },
        include: { class: { select: { name: true } } },
      });
      if (!student) {
        throw new TRPCError({ code: "NOT_FOUND", message: "学生不存在或不在您的班级中" });
      }

      assertOwnedUpload(input.imageUrl, ctx.auth, ["exam-uploads"]);
      if (input.analyzeImmediately) await assertAiQuota(ctx.auth);

      const exam = await db.exam.create({
        data: {
          title: input.title,
          imageUrl: input.imageUrl,
          uploadedBy: "teacher",
          studentId: input.studentId,
          classId: student.classId,
        },
      });

      if (input.analyzeImmediately) {
        await enqueueSubmissionAnalysis("exam", exam.id, { auth: ctx.auth, modelKey: input.modelKey });
      }

      return {
        success: true,
        analysisQueued: input.analyzeImmediately,
        exam: {
          id: exam.id,
          title: exam.title,
          imageUrl: exam.imageUrl,
          createdAt: exam.createdAt,
          analysisStatus: exam.analysisStatus,
          student: {
            name: student.name,
            className: student.class?.name ?? "",
          },
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Upload teacher exam error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "上传试卷失败，请稍后重试" });
    }
  });
