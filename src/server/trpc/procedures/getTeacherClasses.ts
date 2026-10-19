import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

export const getTeacherClasses = teacherProcedure
  .query(async ({ ctx }) => {
    try {
      // Get teacher's classes with counts
      const classes = await db.class.findMany({
        where: {
          teacherId: ctx.auth.teacherId,
        },
        include: {
          _count: {
            select: {
              students: true,
              assignments: true,
              exams: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        classes,
      };
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
