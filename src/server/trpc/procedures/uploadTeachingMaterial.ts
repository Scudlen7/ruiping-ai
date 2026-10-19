import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { assertOwnedUpload } from "~/server/storage";

export const uploadTeachingMaterial = teacherProcedure
  .input(z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    contentType: z.enum(["document", "image", "text", "video", "audio", "other"]),
    fileUrl: z.string().optional(),
    textContent: z.string().optional(),
    knowledgeAreaId: z.number().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    try {
      // Validate that either fileUrl or textContent is provided
      if (!input.fileUrl && !input.textContent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请上传文件或填写文本内容",
        });
      }
      if (input.fileUrl) assertOwnedUpload(input.fileUrl, ctx.auth, ["teaching-materials"]);

      // If knowledgeAreaId is provided, verify it exists
      if (input.knowledgeAreaId) {
        const knowledgeArea = await db.knowledgeArea.findUnique({
          where: { id: input.knowledgeAreaId },
        });

        if (!knowledgeArea) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Knowledge area not found",
          });
        }
      }

      // Create the teaching material
      const teachingMaterial = await db.teachingMaterial.create({
        data: {
          title: input.title,
          description: input.description,
          contentType: input.contentType,
          fileUrl: input.fileUrl,
          textContent: input.textContent,
          teacherId: ctx.auth.teacherId,
          knowledgeAreaId: input.knowledgeAreaId,
        },
        include: {
          knowledgeArea: true,
        },
      });

      return {
        success: true,
        material: {
          id: teachingMaterial.id,
          title: teachingMaterial.title,
          description: teachingMaterial.description,
          contentType: teachingMaterial.contentType,
          fileUrl: teachingMaterial.fileUrl,
          textContent: teachingMaterial.textContent,
          knowledgeArea: teachingMaterial.knowledgeArea,
          createdAt: teachingMaterial.createdAt,
        },
      };
    } catch (error) {
      console.error("Upload teaching material error:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to upload teaching material",
      });
    }
  });
