import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

export const getTeachingMaterials = teacherProcedure
  .input(z.object({
    knowledgeAreaId: z.number().optional(),
    contentType: z.enum(["document", "image", "text", "video", "audio", "other"]).optional(),
  }))
  .query(async ({ input, ctx }) => {
    try {
      const whereClause: Prisma.TeachingMaterialWhereInput = {
        teacherId: ctx.auth.teacherId,
        ...(input.knowledgeAreaId ? { knowledgeAreaId: input.knowledgeAreaId } : {}),
        ...(input.contentType ? { contentType: input.contentType } : {}),
      };

      // Fetch teaching materials
      const materials = await db.teachingMaterial.findMany({
        where: whereClause,
        include: {
          knowledgeArea: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        success: true,
        materials: materials.map(material => ({
          id: material.id,
          title: material.title,
          description: material.description,
          contentType: material.contentType,
          fileUrl: material.fileUrl,
          textContent: material.textContent,
          knowledgeArea: material.knowledgeArea,
          createdAt: material.createdAt,
          updatedAt: material.updatedAt,
        })),
      };
    } catch (error) {
      console.error("Get teaching materials error:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch teaching materials",
      });
    }
  });
