import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

export const assignStudentToGroup = teacherProcedure
  .input(
    z.object({
      studentId: z.number(),
      groupId: z.number().nullable(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    try {
      // Verify teacher authentication - get teacher's classes
      const teacherClasses = await db.class.findMany({
        where: { teacherId: ctx.auth.teacherId },
        select: { id: true },
      });

      const teacherClassIds = teacherClasses.map((c) => c.id);

      // Get the student and verify they're in the teacher's class
      const student = await db.student.findFirst({
        where: {
          id: input.studentId,
          classId: { in: teacherClassIds },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found or not in your classes",
        });
      }

      if (student.classId === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Student is not currently assigned to a class",
        });
      }

      const { groupId } = input;

      if (groupId !== null) {
        const nextGroupId: number = groupId;
        const group = await db.studentGroup.findFirst({
          where: {
            id: nextGroupId,
            classId: student.classId,
          },
        });

        if (!group) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Group not found or not in the same class as the student",
          });
        }
      }

      // Assign student to group
      const updated = await db.student.update({
        where: { id: input.studentId },
        data: { groupId },
        include: {
          group: true,
          class: true,
        },
      });

      return {
        success: true,
        action: groupId === null ? "removed" : "assigned",
        student: {
          id: updated.id,
          name: updated.name,
          groupId: updated.groupId,
          groupName: updated.group?.name,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("Assign student to group error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to assign student to group",
      });
    }
  });
