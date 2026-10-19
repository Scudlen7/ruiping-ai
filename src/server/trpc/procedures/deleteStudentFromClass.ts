import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";

/** Deletes a student with all their submissions and learning data; parent links, invites and requests cascade. */
export const deleteStudentFromClass = teacherProcedure
  .input(z.object({
    studentId: z.number(),
  }))
  .mutation(async ({ input, ctx }) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, class: { teacherId: ctx.auth.teacherId } },
      select: { id: true, name: true, class: { select: { name: true } } },
    });
    if (!student) {
      throw new TRPCError({ code: "NOT_FOUND", message: "学生不存在或不在您的班级中" });
    }

    try {
      await db.$transaction(async (tx) => {
        const studentId = student.id;
        await tx.mistake.deleteMany({ where: { studentId } });
        await tx.examMistake.deleteMany({ where: { studentId } });
        await tx.assignmentAnalysis.deleteMany({ where: { assignment: { studentId } } });
        await tx.examAnalysis.deleteMany({ where: { exam: { studentId } } });
        await tx.assignment.deleteMany({ where: { studentId } });
        await tx.exam.deleteMany({ where: { studentId } });
        await tx.studentKnowledgeArea.deleteMany({ where: { studentId } });
        await tx.student.delete({ where: { id: studentId } });
      });
    } catch (error) {
      console.error("Delete student error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "删除学生失败，请稍后重试" });
    }

    return {
      success: true,
      message: `已将「${student.name}」从「${student.class?.name ?? "班级"}」中删除`,
    };
  });
