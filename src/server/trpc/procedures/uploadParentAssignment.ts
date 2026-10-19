import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { parentProcedure } from "~/server/trpc/main";
import { enqueueSubmissionAnalysis } from "~/server/services/grading";
import { assertOwnedUpload } from "~/server/storage";
import { assertAiQuota } from "~/server/ai/usage";

export const uploadParentAssignment = parentProcedure
  .input(z.object({
    childId: z.number(),
    title: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      const child = await db.student.findFirst({
        where: { id: input.childId, parents: { some: { parentId: ctx.auth.parentId } } },
        include: { class: { select: { name: true } } },
      });
      if (!child) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到该孩子，或该孩子未与您的账号绑定" });
      }

      assertOwnedUpload(input.imageUrl, ctx.auth, ["assignment-uploads"]);
      await assertAiQuota(ctx.auth);

      const assignment = await db.assignment.create({
        data: {
          title: input.title,
          imageUrl: input.imageUrl,
          uploadedBy: "parent",
          studentId: input.childId,
          classId: child.classId,
        },
      });

      await enqueueSubmissionAnalysis("assignment", assignment.id, { auth: ctx.auth });

      return {
        success: true,
        analysisQueued: true,
        assignment: {
          id: assignment.id,
          title: assignment.title,
          imageUrl: assignment.imageUrl,
          analysisStatus: assignment.analysisStatus,
          createdAt: assignment.createdAt,
          student: {
            name: child.name,
            className: child.class?.name ?? "",
          },
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Upload assignment error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "上传作业失败，请稍后重试" });
    }
  });
