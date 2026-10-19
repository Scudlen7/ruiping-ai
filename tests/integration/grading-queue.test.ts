import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/server/db";
import { analyzeSubmissionImage, type SubmissionAnalysis } from "~/server/ai-service";
import { startGradingWorker } from "~/server/services/grading";
import {
  TEST_PASSWORD,
  browserSession,
  bucketUrl,
  createClassWithStudent,
  createTeacher,
  resetDatabase,
  waitFor,
} from "./helpers";

vi.mock("~/server/ai-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/ai-service")>()),
  analyzeSubmissionImage: vi.fn(),
}));

vi.mock("~/server/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/storage")>()),
  fetchStoredFile: vi.fn(async () => Buffer.from("fake image bytes")),
}));

const analyzeMock = vi.mocked(analyzeSubmissionImage);

function analysis(overrides: Partial<SubmissionAnalysis> = {}): SubmissionAnalysis {
  return {
    score: 80,
    grade: "80",
    feedback: "整体不错，注意计算细节",
    strengths: ["书写工整"],
    improvements: ["检查计算"],
    knowledgeAreas: ["一元一次方程", "分数运算"],
    mistakes: [
      {
        description: "移项时没有变号",
        knowledgeArea: "一元一次方程",
        originalQuestionText: "2x + 3 = 7",
        studentAnswer: "x = 5",
        correctAnswer: "x = 2",
      },
    ],
    ...overrides,
  };
}

async function setup() {
  const teacher = await createTeacher();
  const { klass, student } = await createClassWithStudent(teacher.id);
  const browser = browserSession();
  await browser.run((api) => api.loginTeacher({ phoneNumber: teacher.phoneNumber, password: TEST_PASSWORD }));
  const imageUrl = (name = "page.jpg") => bucketUrl(`assignment-uploads/teacher-${teacher.id}/${name}`);
  return { teacher, klass, student, browser, imageUrl };
}

const assignmentStatus = (id: number, status: "completed" | "failed") =>
  waitFor(() => db.assignment.findFirst({ where: { id, analysisStatus: status } }));

beforeEach(async () => {
  await resetDatabase();
  analyzeMock.mockReset();
  analyzeMock.mockResolvedValue({ value: analysis(), usage: { inputTokens: 1200, outputTokens: 300 } });
});

afterEach(async () => {
  // Let in-flight background jobs settle before the next test truncates the tables.
  await waitFor(async () => (await db.assignment.count({ where: { analysisStatus: "processing" } })) === 0);
});

describe("grading queue", () => {
  it("grades an upload end to end and records token usage", async () => {
    const { student, browser, imageUrl } = await setup();

    const result = await browser.run((api) =>
      api.uploadTeacherAssignment({ studentId: student.id, title: "第一次作业", imageUrl: imageUrl() }),
    );
    expect(result.analysisQueued).toBe(true);

    const done = await assignmentStatus(result.assignment.id, "completed");
    expect(done.analysisQueuedAt).toBeNull();

    const saved = await db.assignmentAnalysis.findUniqueOrThrow({
      where: { assignmentId: done.id },
      include: { mistakes: { include: { knowledgeArea: true } } },
    });
    expect(saved.score).toBe(80);
    expect(saved.mistakes).toHaveLength(1);
    expect(saved.mistakes[0]!.knowledgeArea?.name).toBe("一元一次方程");

    const mastery = await db.studentKnowledgeArea.findMany({
      where: { studentId: student.id },
      include: { knowledgeArea: true },
      orderBy: { mastery: "asc" },
    });
    expect(mastery.map((m) => [m.knowledgeArea.name, m.mastery])).toEqual([
      ["一元一次方程", 0.4],
      ["分数运算", 0.6],
    ]);

    const usage = await db.aiUsage.findMany();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      feature: "grading",
      status: "succeeded",
      inputTokens: 1200,
      outputTokens: 300,
      submissionKind: "assignment",
      submissionId: done.id,
    });
  });

  it("refuses image URLs the teacher did not upload", async () => {
    const { teacher, student, browser } = await setup();
    const foreign = [
      "https://attacker.example.com/assignment-uploads/teacher-1/x.jpg",
      "http://169.254.169.254/latest/meta-data",
      bucketUrl(`assignment-uploads/teacher-${teacher.id + 1}/x.jpg`),
      bucketUrl(`teaching-materials/teacher-${teacher.id}/x.jpg`),
    ];
    for (const imageUrl of foreign) {
      await expect(
        browser.run((api) => api.uploadTeacherAssignment({ studentId: student.id, imageUrl })),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(await db.assignment.count()).toBe(0);
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("enforces the daily AI quota before creating a batch", async () => {
    const { student, browser, imageUrl } = await setup();
    const items = Array.from({ length: 6 }, (_, i) => ({
      title: `作业${i}`,
      imageUrl: imageUrl(`p${i}.jpg`),
      fileName: `p${i}.jpg`,
      studentId: student.id,
    }));

    await expect(browser.run((api) => api.batchTeacherUpload({ assignments: items }))).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(await db.assignment.count()).toBe(0);

    const accepted = await browser.run((api) => api.batchTeacherUpload({ assignments: items.slice(0, 5) }));
    expect(accepted.totalCount).toBe(5);
    await waitFor(async () => (await db.assignment.count({ where: { analysisStatus: "completed" } })) === 5);
    // Graded concurrently: none of the five mastery updates may be lost.
    const evidence = await db.studentKnowledgeArea.findMany({ where: { studentId: student.id } });
    expect(evidence.map((row) => row.evidenceCount)).toEqual([5, 5]);

    await expect(
      browser.run((api) => api.uploadTeacherAssignment({ studentId: student.id, imageUrl: imageUrl("extra.jpg") })),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("records AI failures and lets the user retry", async () => {
    const { student, browser, imageUrl } = await setup();
    analyzeMock.mockRejectedValueOnce(new Error("模型返回内容无法解析"));

    const { assignment } = await browser.run((api) =>
      api.uploadTeacherAssignment({ studentId: student.id, imageUrl: imageUrl() }),
    );
    const failed = await assignmentStatus(assignment.id, "failed");
    expect(failed.analysisError).toBe("模型返回内容无法解析");
    expect(await db.aiUsage.findFirst()).toMatchObject({ status: "failed", error: "模型返回内容无法解析" });

    await browser.run((api) => api.analyzeSubmission({ kind: "assignment", id: assignment.id }));
    await assignmentStatus(assignment.id, "completed");

    const statuses = (await db.aiUsage.findMany({ orderBy: { id: "asc" } })).map((u) => u.status);
    expect(statuses).toEqual(["failed", "succeeded"]);
    await expect(
      browser.run((api) => api.analyzeSubmission({ kind: "assignment", id: assignment.id })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("resumes queued and interrupted work after a restart", async () => {
    const { student, imageUrl } = await setup();
    const queued = await db.assignment.create({
      data: {
        title: "重启前已排队",
        imageUrl: imageUrl("queued.jpg"),
        uploadedBy: "teacher",
        studentId: student.id,
        analysisQueuedAt: new Date(),
      },
    });
    const interrupted = await db.assignment.create({
      data: {
        title: "批改到一半服务重启",
        imageUrl: imageUrl("interrupted.jpg"),
        uploadedBy: "teacher",
        studentId: student.id,
        analysisStatus: "processing",
        analysisStartedAt: new Date(Date.now() - 11 * 60 * 1000),
        analysisQueuedAt: new Date(Date.now() - 12 * 60 * 1000),
        analysisAttempts: 1,
      },
    });
    const crashLoop = await db.assignment.create({
      data: {
        title: "多次中断",
        imageUrl: imageUrl("crash.jpg"),
        uploadedBy: "teacher",
        studentId: student.id,
        analysisStatus: "processing",
        analysisStartedAt: new Date(Date.now() - 11 * 60 * 1000),
        analysisQueuedAt: new Date(Date.now() - 13 * 60 * 1000),
        analysisAttempts: 3,
      },
    });

    startGradingWorker();

    await assignmentStatus(queued.id, "completed");
    const resumed = await assignmentStatus(interrupted.id, "completed");
    expect(resumed.analysisAttempts).toBe(2);
    const gaveUp = await assignmentStatus(crashLoop.id, "failed");
    expect(gaveUp.analysisError).toContain("多次中断");
    expect(analyzeMock).toHaveBeenCalledTimes(2);
  });

  it("does not grade a submission twice when a fresh worker is still processing it", async () => {
    const { student, imageUrl } = await setup();
    const inFlight = await db.assignment.create({
      data: {
        title: "正在批改",
        imageUrl: imageUrl(),
        uploadedBy: "teacher",
        studentId: student.id,
        analysisStatus: "processing",
        analysisStartedAt: new Date(),
        analysisQueuedAt: new Date(),
        analysisAttempts: 1,
      },
    });

    startGradingWorker();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(analyzeMock).not.toHaveBeenCalled();
    await db.assignment.update({ where: { id: inFlight.id }, data: { analysisStatus: "failed" } });
  });

  it("maps AI knowledge-area names onto areas the class already uses", async () => {
    const { klass, student, browser, imageUrl } = await setup();
    const classmate = await db.student.create({ data: { name: "同学", classId: klass.id } });
    const existing = await db.knowledgeArea.create({ data: { name: "一元一次方程", description: "已有知识点" } });
    await db.studentKnowledgeArea.create({ data: { studentId: classmate.id, knowledgeAreaId: existing.id } });

    analyzeMock.mockResolvedValueOnce({
      value: analysis({
        knowledgeAreas: ["一元 一次方程。"],
        mistakes: [
          {
            description: "符号错误",
            knowledgeArea: "一元一次方程 ",
            originalQuestionText: null,
            studentAnswer: null,
            correctAnswer: null,
          },
        ],
      }),
      usage: { inputTokens: 10, outputTokens: 10 },
    });

    const { assignment } = await browser.run((api) =>
      api.uploadTeacherAssignment({ studentId: student.id, imageUrl: imageUrl() }),
    );
    await assignmentStatus(assignment.id, "completed");

    expect(analyzeMock.mock.calls[0]![3]).toEqual(["一元一次方程"]);
    expect(await db.knowledgeArea.count()).toBe(1);
    const mistake = await db.mistake.findFirstOrThrow({ where: { studentId: student.id } });
    expect(mistake.knowledgeAreaId).toBe(existing.id);
  });
});
