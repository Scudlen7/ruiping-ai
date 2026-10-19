import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { enqueueSubmissionAnalysis } from "~/server/services/grading";
import { assertOwnedUpload } from "~/server/storage";
import { assertAiQuota } from "~/server/ai/usage";

export const uploadTeacherAssignment = teacherProcedure
  .input(z.object({
    studentId: z.number(),
    title: z.string().optional(),
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

      assertOwnedUpload(input.imageUrl, ctx.auth, ["assignment-uploads"]);
      if (input.analyzeImmediately) await assertAiQuota(ctx.auth);

      const finalTitle = input.title?.trim()
        ? input.title.trim()
        : `作业 - ${new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}`;

      const assignment = await db.assignment.create({
        data: {
          title: finalTitle,
          imageUrl: input.imageUrl,
          uploadedBy: "teacher",
          studentId: input.studentId,
          classId: student.classId,
        },
      });

      if (input.analyzeImmediately) {
        await enqueueSubmissionAnalysis("assignment", assignment.id, { auth: ctx.auth, modelKey: input.modelKey });
      }

      return {
        success: true,
        analysisQueued: input.analyzeImmediately,
        assignment: {
          id: assignment.id,
          title: assignment.title,
          imageUrl: assignment.imageUrl,
          createdAt: assignment.createdAt,
          analysisStatus: assignment.analysisStatus,
          student: {
            name: student.name,
            className: student.class?.name ?? "",
          },
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Upload teacher assignment error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "上传作业失败，请稍后重试" });
    }
  });
