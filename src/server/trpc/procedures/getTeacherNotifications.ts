import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { average } from "~/lib/grading";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_COMPLETED_DAYS = 7;
const LOW_SCORE_WINDOW_DAYS = 30;
const LOW_SCORE_THRESHOLD = 60;
const WEAK_MASTERY_THRESHOLD = 0.6;

type SubmissionKind = "assignment" | "exam";

const submissionSelect = {
  id: true,
  title: true,
  createdAt: true,
  analysisError: true,
  student: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
  analysis: { select: { score: true, createdAt: true } },
} as const;

/** Items for the teacher's message center; `attentionCount` drives the header bell. */
export const getTeacherNotifications = teacherProcedure.query(async ({ ctx }) => {
  const teacherId = ctx.auth.teacherId;
  const now = Date.now();
  const ownStudents = { student: { class: { teacherId } } };
  const completedSince = new Date(now - RECENT_COMPLETED_DAYS * DAY_MS);
  const lowScoreSince = new Date(now - LOW_SCORE_WINDOW_DAYS * DAY_MS);

  const [
    failedAssignments,
    failedExams,
    completedAssignments,
    completedExams,
    scoredAssignments,
    scoredExams,
    masteryRows,
    pendingBindingCount,
  ] = await Promise.all([
    db.assignment.findMany({
      where: { ...ownStudents, analysisStatus: "failed" },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.exam.findMany({
      where: { ...ownStudents, analysisStatus: "failed" },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.assignment.findMany({
      where: { ...ownStudents, analysisStatus: "completed", analysis: { createdAt: { gte: completedSince } } },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.exam.findMany({
      where: { ...ownStudents, analysisStatus: "completed", analysis: { createdAt: { gte: completedSince } } },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.assignment.findMany({
      where: { ...ownStudents, createdAt: { gte: lowScoreSince }, analysis: { score: { not: null } } },
      select: { studentId: true, analysis: { select: { score: true } } },
    }),
    db.exam.findMany({
      where: { ...ownStudents, createdAt: { gte: lowScoreSince }, analysis: { score: { not: null } } },
      select: { studentId: true, analysis: { select: { score: true } } },
    }),
    db.studentKnowledgeArea.findMany({
      where: { evidenceCount: { gt: 0 }, ...ownStudents },
      select: { mastery: true, studentId: true, knowledgeArea: { select: { id: true, name: true } } },
    }),
    db.parentBindingRequest.count({
      where: { status: "pending", student: { class: { teacherId } } },
    }),
  ]);

  const toItem = (kind: SubmissionKind) => (row: (typeof failedAssignments)[number]) => ({
    kind,
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    studentId: row.student?.id ?? null,
    studentName: row.student?.name ?? "未知学生",
    classId: row.student?.class?.id ?? null,
    className: row.student?.class?.name ?? "",
    error: row.analysisError,
    score: row.analysis?.score ?? null,
    analyzedAt: row.analysis?.createdAt ?? null,
  });
  const byNewest = (a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime();

  const failed = [...failedAssignments.map(toItem("assignment")), ...failedExams.map(toItem("exam"))]
    .sort(byNewest)
    .slice(0, 20);
  const completed = [...completedAssignments.map(toItem("assignment")), ...completedExams.map(toItem("exam"))]
    .sort((a, b) => (b.analyzedAt?.getTime() ?? 0) - (a.analyzedAt?.getTime() ?? 0))
    .slice(0, 10);

  const scoresByStudent = new Map<number, number[]>();
  for (const row of [...scoredAssignments, ...scoredExams]) {
    if (row.studentId == null || row.analysis?.score == null) continue;
    const scores = scoresByStudent.get(row.studentId) ?? [];
    scores.push(row.analysis.score);
    scoresByStudent.set(row.studentId, scores);
  }
  const lowStudentIds = [...scoresByStudent.entries()]
    .filter(([, scores]) => (average(scores) ?? 100) < LOW_SCORE_THRESHOLD)
    .map(([studentId]) => studentId);
  const lowStudents = lowStudentIds.length
    ? await db.student.findMany({
        where: { id: { in: lowStudentIds } },
        select: { id: true, name: true, class: { select: { id: true, name: true } } },
      })
    : [];
  const lowScores = lowStudents
    .map((student) => {
      const scores = scoresByStudent.get(student.id) ?? [];
      return {
        studentId: student.id,
        studentName: student.name,
        classId: student.class?.id ?? null,
        className: student.class?.name ?? "",
        averageScore: Math.round((average(scores) ?? 0) * 10) / 10,
        gradedCount: scores.length,
      };
    })
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 10);

  const areaMap = new Map<number, { name: string; values: number[] }>();
  for (const row of masteryRows) {
    const entry = areaMap.get(row.knowledgeArea.id) ?? { name: row.knowledgeArea.name, values: [] };
    entry.values.push(row.mastery);
    areaMap.set(row.knowledgeArea.id, entry);
  }
  const weakAreas = [...areaMap.entries()]
    .map(([knowledgeAreaId, entry]) => ({
      knowledgeAreaId,
      name: entry.name,
      mastery: Math.round((average(entry.values) ?? 0) * 1000) / 10,
      studentCount: entry.values.length,
    }))
    .filter((area) => area.mastery < WEAK_MASTERY_THRESHOLD * 100)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5);

  return {
    failed,
    completed,
    lowScores,
    weakAreas,
    pendingBindingCount,
    attentionCount: failed.length + pendingBindingCount,
  };
});
