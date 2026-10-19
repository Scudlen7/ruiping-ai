import { db } from "~/server/db";
import { parentProcedure } from "~/server/trpc/main";
import { average } from "~/lib/grading";
import { maskPhone, MAX_PARENTS_PER_STUDENT } from "~/server/services/parentBinding";

const REJECTED_VISIBLE_MS = 14 * 24 * 60 * 60 * 1000;

export const getParentOverview = parentProcedure.query(async ({ ctx }) => {
  const parentId = ctx.auth.parentId;
  const [parent, requests] = await Promise.all([
    db.parent.findUniqueOrThrow({
      where: { id: parentId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        children: {
          orderBy: { studentId: "asc" },
          select: {
            student: {
              select: {
                id: true,
                name: true,
                grade: true,
                className: true,
                class: { select: { name: true, teacher: { select: { name: true } } } },
                assignments: { select: { analysisStatus: true, createdAt: true, analysis: { select: { score: true } } } },
                exams: { select: { analysisStatus: true, createdAt: true, analysis: { select: { score: true } } } },
                parents: {
                  orderBy: { createdAt: "asc" },
                  select: { relation: true, createdAt: true, parent: { select: { id: true, name: true, phoneNumber: true } } },
                },
              },
            },
          },
        },
      },
    }),
    db.parentBindingRequest.findMany({
      where: {
        parentId,
        OR: [
          { status: "pending" },
          { status: "rejected", decidedAt: { gt: new Date(Date.now() - REJECTED_VISIBLE_MS) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        student: { select: { name: true, class: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    parent: { id: parent.id, name: parent.name, phoneNumber: parent.phoneNumber },
    maxParentsPerChild: MAX_PARENTS_PER_STUDENT,
    requests: requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
      childName: request.student.name,
      className: request.student.class?.name ?? null,
    })),
    children: parent.children.map(({ student: child }) => {
      const submissions = [...child.assignments, ...child.exams];
      const lastSubmissionAt = submissions.reduce<Date | null>(
        (latest, s) => (!latest || s.createdAt > latest ? s.createdAt : latest),
        null,
      );
      return {
        id: child.id,
        name: child.name,
        grade: child.grade,
        className: child.class?.name ?? child.className,
        teacherName: child.class?.teacher.name ?? null,
        totalSubmissions: submissions.length,
        pendingAnalyses: submissions.filter((s) => s.analysisStatus === "pending" || s.analysisStatus === "processing").length,
        averageScore: average(submissions.map((s) => s.analysis?.score)),
        lastSubmissionAt,
        family: child.parents.map((link) => ({
          parentId: link.parent.id,
          name: link.parent.name,
          maskedPhone: maskPhone(link.parent.phoneNumber),
          relation: link.relation,
          linkedAt: link.createdAt,
          isMe: link.parent.id === parentId,
        })),
      };
    }),
  };
});
