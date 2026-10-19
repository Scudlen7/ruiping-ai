import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { teacherProcedure } from "~/server/trpc/main";
import { average } from "~/lib/grading";
import {
  buildDailyScores,
  chinaDayKey,
  computePeriodStats,
  periodBounds,
  type ScoredItem,
} from "~/lib/classStats";

const RECENT_SCORE_COUNT = 7;

const round1 = (value: number) => Math.round(value * 10) / 10;

export const getClassPerformanceTrends = teacherProcedure
  .input(
    z.object({
      classId: z.number(),
      timeRange: z.enum(["7d", "30d", "90d", "1y", "all"]).optional().default("30d"),
    }),
  )
  .query(async ({ input, ctx }) => {
    const classData = await db.class.findFirst({
      where: { id: input.classId, teacherId: ctx.auth.teacherId },
      select: { id: true },
    });
    if (!classData) {
      throw new TRPCError({ code: "NOT_FOUND", message: "班级不存在或无权查看" });
    }

    const { start, previousStart } = periodBounds(input.timeRange);
    const fetchFrom = previousStart ?? start;

    const students = await db.student.findMany({
      where: { classId: input.classId },
      select: { id: true, name: true },
    });
    const studentIds = students.map((s) => s.id);

    const submissionQuery = {
      where: { studentId: { in: studentIds }, createdAt: { gte: fetchFrom } },
      select: {
        id: true,
        studentId: true,
        createdAt: true,
        analysis: { select: { score: true } },
      },
      orderBy: { createdAt: "asc" as const },
    };
    const [allAssignments, allExams, mistakes, examMistakes, masteryRows] = await Promise.all([
      db.assignment.findMany(submissionQuery),
      db.exam.findMany(submissionQuery),
      db.mistake.findMany({
        where: { studentId: { in: studentIds }, createdAt: { gte: start } },
        select: { createdAt: true, studentId: true, knowledgeAreaId: true },
      }),
      db.examMistake.findMany({
        where: { studentId: { in: studentIds }, createdAt: { gte: start } },
        select: { createdAt: true, studentId: true, knowledgeAreaId: true },
      }),
      db.studentKnowledgeArea.findMany({
        where: { studentId: { in: studentIds }, evidenceCount: { gt: 0 } },
        select: { studentId: true, mastery: true, knowledgeAreaId: true },
      }),
    ]);

    const inCurrent = (item: { createdAt: Date }) => item.createdAt >= start;
    const assignments = allAssignments.filter(inCurrent);
    const exams = allExams.filter(inCurrent);

    type Graded = { studentId: number; createdAt: Date; score: number; kind: "assignment" | "exam" };
    const toGraded = (kind: Graded["kind"]) => (item: (typeof allAssignments)[number]): Graded[] =>
      item.studentId != null && item.analysis?.score != null
        ? [{ studentId: item.studentId, createdAt: item.createdAt, score: item.analysis.score, kind }]
        : [];
    const graded = [...assignments.flatMap(toGraded("assignment")), ...exams.flatMap(toGraded("exam"))].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const daily = buildDailyScores(graded);
    const assignmentTrends = daily
      .filter((day) => day.assignmentAverage !== null)
      .map((day) => ({ date: day.date, averageScore: day.assignmentAverage!, count: day.assignmentCount, type: "assignment" as const }));
    const examTrends = daily
      .filter((day) => day.examAverage !== null)
      .map((day) => ({ date: day.date, averageScore: day.examAverage!, count: day.examCount, type: "exam" as const }));
    const performanceTrends = [...assignmentTrends, ...examTrends].sort((a, b) => a.date.localeCompare(b.date));

    const participationByDate = new Map<string, Set<number>>();
    for (const item of [...assignments, ...exams]) {
      if (item.studentId == null) continue;
      const date = chinaDayKey(item.createdAt);
      const set = participationByDate.get(date) ?? new Set<number>();
      set.add(item.studentId);
      participationByDate.set(date, set);
    }
    const participationTrends = [...participationByDate.entries()]
      .map(([date, set]) => ({
        date,
        activeStudents: set.size,
        participationRate: students.length > 0 ? (set.size / students.length) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const mistakesByDate = new Map<string, number>();
    for (const mistake of [...mistakes, ...examMistakes]) {
      const date = chinaDayKey(mistake.createdAt);
      mistakesByDate.set(date, (mistakesByDate.get(date) ?? 0) + 1);
    }
    const mistakeTrends = [...mistakesByDate.entries()]
      .map(([date, count]) => ({ date, mistakes: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const studentRanking = students
      .map((s) => {
        const own = graded.filter((item) => item.studentId === s.id);
        const assignmentScores = own.filter((item) => item.kind === "assignment").map((item) => item.score);
        const examScores = own.filter((item) => item.kind === "exam").map((item) => item.score);
        const allScores = own.map((item) => item.score);
        return {
          studentId: s.id,
          studentName: s.name,
          averageScore: round1(average(allScores) ?? 0),
          assignmentCount: assignmentScores.length,
          examCount: examScores.length,
          totalItems: allScores.length,
          assignmentAvg: round1(average(assignmentScores) ?? 0),
          examAvg: round1(average(examScores) ?? 0),
          recentScores: allScores.slice(-RECENT_SCORE_COUNT).map(round1),
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);

    const areaIds = new Set<number>();
    const masteryByArea = new Map<number, number[]>();
    for (const row of masteryRows) {
      areaIds.add(row.knowledgeAreaId);
      const values = masteryByArea.get(row.knowledgeAreaId) ?? [];
      values.push(row.mastery);
      masteryByArea.set(row.knowledgeAreaId, values);
    }
    const mistakesByArea = new Map<number, { count: number; students: Set<number> }>();
    for (const mistake of [...mistakes, ...examMistakes]) {
      if (mistake.knowledgeAreaId == null) continue;
      areaIds.add(mistake.knowledgeAreaId);
      const entry = mistakesByArea.get(mistake.knowledgeAreaId) ?? { count: 0, students: new Set<number>() };
      entry.count += 1;
      if (mistake.studentId != null) entry.students.add(mistake.studentId);
      mistakesByArea.set(mistake.knowledgeAreaId, entry);
    }
    const areaNames = new Map(
      (
        await db.knowledgeArea.findMany({
          where: { id: { in: [...areaIds] } },
          select: { id: true, name: true },
        })
      ).map((area) => [area.id, area.name]),
    );
    const knowledgeAreaAnalysis = [...areaIds]
      .map((id) => {
        const mastery = average(masteryByArea.get(id) ?? []);
        const mistakeEntry = mistakesByArea.get(id);
        return {
          knowledgeAreaId: id,
          name: areaNames.get(id) ?? "未分类",
          /** Class average of per-student mastery, 0-100; null when nobody has evidence yet. */
          mastery: mastery === null ? null : round1(mastery * 100),
          masteryStudentCount: masteryByArea.get(id)?.length ?? 0,
          mistakeCount: mistakeEntry?.count ?? 0,
          affectedStudentCount: mistakeEntry?.students.size ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.mastery !== null && b.mastery !== null && a.mastery !== b.mastery) return a.mastery - b.mastery;
        if (a.mastery === null && b.mastery !== null) return 1;
        if (a.mastery !== null && b.mastery === null) return -1;
        return b.mistakeCount - a.mistakeCount;
      });

    const overallMasteryRaw = average(masteryRows.map((row) => row.mastery));

    const scoredOf = (items: Graded[]): ScoredItem[] => items.map(({ studentId, score }) => ({ studentId, score }));
    const submittersOf = (items: Array<{ studentId: number | null }>) =>
      items.flatMap((item) => (item.studentId == null ? [] : [item.studentId]));

    const current = computePeriodStats(scoredOf(graded), submittersOf([...assignments, ...exams]), students.length);
    let previous = null;
    if (previousStart) {
      const before = (item: { createdAt: Date }) => item.createdAt < start;
      const previousAssignments = allAssignments.filter(before);
      const previousExams = allExams.filter(before);
      const previousGraded = [
        ...previousAssignments.flatMap(toGraded("assignment")),
        ...previousExams.flatMap(toGraded("exam")),
      ];
      const stats = computePeriodStats(
        scoredOf(previousGraded),
        submittersOf([...previousAssignments, ...previousExams]),
        students.length,
      );
      previous = stats.submittedStudents > 0 ? stats : null;
    }

    return {
      performanceTrends,
      participationTrends,
      mistakeTrends,
      assignmentTrends,
      examTrends,
      daily,
      studentRanking,
      knowledgeAreaAnalysis,
      comparison: { current, previous },
      summary: {
        totalStudents: students.length,
        totalAssignments: assignments.length,
        totalExams: exams.length,
        averageAssignmentScore: average(assignments.map((a) => a.analysis?.score)) ?? 0,
        averageExamScore: average(exams.map((e) => e.analysis?.score)) ?? 0,
        totalMistakes: mistakes.length + examMistakes.length,
        averageParticipationRate:
          participationTrends.length > 0
            ? participationTrends.reduce((sum, p) => sum + p.participationRate, 0) / participationTrends.length
            : 0,
        overallMastery: overallMasteryRaw === null ? null : round1(overallMasteryRaw * 100),
        timeRange: input.timeRange,
      },
    };
  });
