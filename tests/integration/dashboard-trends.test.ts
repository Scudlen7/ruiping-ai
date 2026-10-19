import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db";
import { TEST_PASSWORD, browserSession, createClassWithStudent, createTeacher, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const DAY_MS = 24 * 60 * 60 * 1000;

async function gradedAssignment(studentId: number, score: number, createdAt: Date) {
  await db.assignment.create({
    data: {
      title: `作业${score}`,
      imageUrl: "https://example.test/a.jpg",
      uploadedBy: "teacher",
      studentId,
      createdAt,
      analysisStatus: "completed",
      analysis: { create: { score, feedback: "ok", strengths: [], improvements: [] } },
    },
  });
}

describe("class performance trends", () => {
  it("reports real mastery, recent scores and a comparison with the previous period", async () => {
    const teacher = await createTeacher("13800000301");
    const browser = browserSession("203.0.113.31");
    await browser.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
    const { klass, student } = await createClassWithStudent(teacher.id);
    const classmate = await db.student.create({ data: { name: "同学", classId: klass.id } });
    await db.student.create({ data: { name: "未提交", classId: klass.id } });

    const now = Date.now();
    await gradedAssignment(student.id, 60, new Date(now - 10 * DAY_MS));
    await gradedAssignment(student.id, 80, new Date(now - 3 * DAY_MS));
    await gradedAssignment(student.id, 90, new Date(now - 2 * DAY_MS));
    await gradedAssignment(classmate.id, 40, new Date(now - 1 * DAY_MS));
    await db.exam.create({
      data: {
        title: "小测",
        imageUrl: "https://example.test/e.jpg",
        uploadedBy: "teacher",
        studentId: classmate.id,
        createdAt: new Date(now - 1 * DAY_MS),
        analysisStatus: "completed",
        analysis: { create: { score: 70, feedback: "ok", strengths: [], improvements: [] } },
      },
    });

    const fractions = await db.knowledgeArea.create({ data: { name: "分数", description: "" } });
    const geometry = await db.knowledgeArea.create({ data: { name: "几何", description: "" } });
    await db.studentKnowledgeArea.createMany({
      data: [
        { studentId: student.id, knowledgeAreaId: fractions.id, mastery: 0.3, evidenceCount: 2 },
        { studentId: classmate.id, knowledgeAreaId: fractions.id, mastery: 0.5, evidenceCount: 1 },
        { studentId: student.id, knowledgeAreaId: geometry.id, mastery: 0.9, evidenceCount: 1 },
        { studentId: classmate.id, knowledgeAreaId: geometry.id, mastery: 0.5, evidenceCount: 0 },
      ],
    });

    const result = await browser.run((api) => api.getClassPerformanceTrends({ classId: klass.id, timeRange: "7d" }));

    expect(result.comparison.current).toMatchObject({ gradedStudents: 2, submittedStudents: 2, gradedItems: 4 });
    expect(result.comparison.current.averageScore).toBeCloseTo((80 + 90 + 40 + 70) / 4, 5);
    expect(result.comparison.current.coverageRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(result.comparison.current.passingRate).toBe(50);
    expect(result.comparison.previous).toMatchObject({ averageScore: 60, gradedStudents: 1 });

    const me = result.studentRanking.find((row) => row.studentId === student.id)!;
    expect(me.recentScores).toEqual([80, 90]);
    expect(result.studentRanking.find((row) => row.studentId === classmate.id)?.recentScores).toEqual([40, 70]);

    expect(result.knowledgeAreaAnalysis.map((area) => [area.name, area.mastery])).toEqual([
      ["分数", 40],
      ["几何", 90],
    ]);
    expect(result.summary.overallMastery).toBeCloseTo(((0.3 + 0.5 + 0.9) / 3) * 100, 0);

    const lastDay = result.daily.at(-1)!;
    expect(lastDay).toMatchObject({ assignmentAverage: 40, assignmentCount: 1, examAverage: 70, examCount: 1 });
  });

  it("has no previous period for the all-time range", async () => {
    const teacher = await createTeacher("13800000302");
    const browser = browserSession("203.0.113.32");
    await browser.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
    const { klass, student } = await createClassWithStudent(teacher.id);
    await gradedAssignment(student.id, 75, new Date(Date.now() - 400 * DAY_MS));

    const result = await browser.run((api) => api.getClassPerformanceTrends({ classId: klass.id, timeRange: "all" }));
    expect(result.comparison.previous).toBeNull();
    expect(result.comparison.current.averageScore).toBe(75);
  });

  it("groups by China local day", async () => {
    const teacher = await createTeacher("13800000303");
    const browser = browserSession("203.0.113.33");
    await browser.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
    const { klass, student } = await createClassWithStudent(teacher.id);
    const lateEvening = new Date(Date.now() - 2 * DAY_MS);
    lateEvening.setUTCHours(15, 30, 0, 0);
    const nextMorning = new Date(lateEvening.getTime() + DAY_MS / 24);
    await gradedAssignment(student.id, 70, lateEvening);
    await gradedAssignment(student.id, 90, nextMorning);

    const result = await browser.run((api) => api.getClassPerformanceTrends({ classId: klass.id, timeRange: "7d" }));
    expect(result.daily.map((day) => day.assignmentAverage)).toEqual([70, 90]);
  });
});
