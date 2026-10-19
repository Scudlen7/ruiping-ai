import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

export const getKnowledgeAreas = teacherProcedure
  .query(async ({ ctx }) => {
    try {
      // Fetch all knowledge areas
      const knowledgeAreas = await db.knowledgeArea.findMany({
        orderBy: {
          name: 'asc',
        },
      });

      return {
        success: true,
        knowledgeAreas: knowledgeAreas.map(area => ({
          id: area.id,
          name: area.name,
          description: area.description,
          createdAt: area.createdAt,
        })),
      };
    } catch (error) {
      console.error("Get knowledge areas error:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch knowledge areas",
      });
    }
  });
