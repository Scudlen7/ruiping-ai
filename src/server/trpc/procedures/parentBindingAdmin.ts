import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { decideBindingRequest as decide, unlinkParent } from "~/server/services/parentBinding";

/** Pending requests from parents who want to link a child in one of the teacher's classes. */
export const getBindingRequests = teacherProcedure.query(async ({ ctx }) => {
  const requests = await db.parentBindingRequest.findMany({
    where: { status: "pending", student: { class: { teacherId: ctx.auth.teacherId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      relation: true,
      createdAt: true,
      parent: { select: { id: true, name: true, phoneNumber: true } },
      student: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
          _count: { select: { parents: true } },
        },
      },
    },
  });
  return requests.map((request) => ({
    id: request.id,
    relation: request.relation,
    createdAt: request.createdAt,
    parent: request.parent,
    student: { id: request.student.id, name: request.student.name },
    class: request.student.class,
    linkedParentCount: request.student._count.parents,
  }));
});

export const decideBindingRequest = teacherProcedure
  .input(z.object({ requestId: z.number(), approve: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    await decide(input.requestId, ctx.auth.teacherId, input.approve);
    return { success: true };
  });

/** The class teacher removes a parent's link to a student; the parent loses access immediately. */
export const unbindParent = teacherProcedure
  .input(z.object({ studentId: z.number(), parentId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, class: { teacherId: ctx.auth.teacherId } },
      select: { id: true },
    });
    if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "学生不存在或不在您的班级中" });
    await unlinkParent(input.studentId, input.parentId);
    return { success: true };
  });
