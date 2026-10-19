import { TRPCError } from "@trpc/server";
import { AnalysisStatus, type Prisma } from "@prisma/client";
import { db } from "~/server/db";
import {
  analyzeSubmissionImage,
  resolveModelKey,
  type SubmissionAnalysis,
  type SubmissionKind,
} from "~/server/ai-service";
import { fetchStoredFile } from "~/server/storage";
import { updateMastery } from "~/lib/grading";
import type { AuthPayload } from "~/server/auth/session";
import { finishAiUsage, reserveAiUsage, type TokenUsage } from "~/server/ai/usage";
import { describeAiError as describeError } from "~/server/ai/errors";

export type { SubmissionKind, AuthPayload };

/** A submission stuck in `processing` longer than this is considered abandoned (e.g. server restart). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;
/** Runs interrupted this many times (crash/restart mid-analysis) are given up on. */
const MAX_ANALYSIS_ATTEMPTS = 3;
const MAX_CONCURRENT_ANALYSES = 2;
const POLL_INTERVAL_MS = 5_000;
const MAX_KNOWN_AREAS = 60;
const UNCATEGORIZED = "未分类";
const SUBMISSION_KINDS: readonly SubmissionKind[] = ["assignment", "exam"];

const submissionInclude = {
  student: {
    select: {
      id: true,
      name: true,
      parents: { select: { parentId: true } },
      class: { select: { id: true, name: true, teacherId: true } },
    },
  },
} as const;

async function loadSubmission(kind: SubmissionKind, id: number) {
  return kind === "assignment"
    ? db.assignment.findUnique({ where: { id }, include: submissionInclude })
    : db.exam.findUnique({ where: { id }, include: submissionInclude });
}

/** Prisma filter for the students `auth` may see: teachers their classes' students, parents their own children. */
export function studentAccessFilter(auth: AuthPayload): Prisma.StudentWhereInput {
  const allowed: Prisma.StudentWhereInput[] = [];
  if (auth.teacherId != null) allowed.push({ class: { teacherId: auth.teacherId } });
  if (auth.parentId != null) allowed.push({ parents: { some: { parentId: auth.parentId } } });
  return allowed.length > 0 ? { OR: allowed } : { id: -1 };
}

/** Teachers may access submissions of students in their classes; parents those of their own children. */
export async function assertSubmissionAccess(kind: SubmissionKind, id: number, auth: AuthPayload) {
  const submission = await loadSubmission(kind, id);
  if (!submission) {
    throw new TRPCError({ code: "NOT_FOUND", message: kind === "exam" ? "试卷不存在" : "作业不存在" });
  }

  const student = submission.student;
  const isTeacher = auth.teacherId != null && student?.class?.teacherId === auth.teacherId;
  const isParent = auth.parentId != null && !!student?.parents.some((link) => link.parentId === auth.parentId);
  if (!isTeacher && !isParent) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该学生的作业或试卷" });
  }
  return submission;
}

async function updateSubmission(
  kind: SubmissionKind,
  where: Prisma.AssignmentWhereInput & Prisma.ExamWhereInput,
  data: Prisma.AssignmentUpdateManyMutationInput & Prisma.ExamUpdateManyMutationInput,
) {
  return kind === "assignment"
    ? db.assignment.updateMany({ where, data })
    : db.exam.updateMany({ where, data });
}

/** Key used to treat "一元一次方程" and "一元 一次方程。" as the same knowledge area. */
function areaMatchKey(name: string): string {
  return name.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

/** Names of knowledge areas already used in the student's class (or by the student), shown to the AI for reuse. */
async function knownAreaNames(student: { id: number; class: { id: number } | null }): Promise<string[]> {
  const areas = await db.knowledgeArea.findMany({
    where: {
      name: { not: UNCATEGORIZED },
      studentKnowledgeAreas: {
        some: student.class ? { student: { classId: student.class.id } } : { studentId: student.id },
      },
    },
    select: { name: true },
    orderBy: { name: "asc" },
    take: MAX_KNOWN_AREAS,
  });
  return areas.map((area) => area.name);
}

async function persistAnalysis(
  kind: SubmissionKind,
  submissionId: number,
  studentId: number,
  result: SubmissionAnalysis,
  modelUsed: string,
  knownAreas: readonly string[],
) {
  const canonicalByKey = new Map(knownAreas.map((name) => [areaMatchKey(name), name]));
  const canonicalName = (rawName: string): string | null => {
    const trimmed = rawName.trim().slice(0, 50);
    if (!trimmed || trimmed === UNCATEGORIZED) return null;
    return canonicalByKey.get(areaMatchKey(trimmed)) ?? trimmed;
  };

  // Created outside the transaction with ON CONFLICT DO NOTHING: concurrent analyses introducing the same
  // new area would otherwise race on the unique name and one of them would fail.
  const areaNames = [
    ...new Set(
      [...result.mistakes.map((m) => m.knowledgeArea), ...result.knowledgeAreas]
        .map(canonicalName)
        .filter((name): name is string => name !== null),
    ),
  ];
  if (areaNames.length > 0) {
    await db.knowledgeArea.createMany({
      data: areaNames.map((name) => ({ name, description: `由 AI 批改归纳的知识点：${name}` })),
      skipDuplicates: true,
    });
  }
  const areaIdByName = new Map(
    (await db.knowledgeArea.findMany({ where: { name: { in: areaNames } }, select: { id: true, name: true } })).map(
      (area) => [area.name, area.id],
    ),
  );
  const resolveArea = (rawName: string): number | null => {
    const name = canonicalName(rawName);
    return name ? (areaIdByName.get(name) ?? null) : null;
  };

  return db.$transaction(
    async (tx) => {
      // Serializes analyses of the same student so concurrent mastery updates do not overwrite each other.
      await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id" = ${studentId} FOR UPDATE`;

      const base = {
        score: result.score,
        grade: result.grade,
        feedback: result.feedback,
        strengths: result.strengths,
        improvements: result.improvements,
        modelUsed,
      };
      const analysis =
        kind === "assignment"
          ? await tx.assignmentAnalysis.create({ data: { ...base, assignmentId: submissionId } })
          : await tx.examAnalysis.create({ data: { ...base, examId: submissionId } });

      // knowledgeAreaId -> number of mistakes in this submission (0 = tested and answered correctly)
      const evidence = new Map<number, number>();

      for (const mistake of result.mistakes) {
        const knowledgeAreaId = resolveArea(mistake.knowledgeArea);
        const data = {
          description: mistake.description,
          originalQuestionText: mistake.originalQuestionText,
          studentAnswer: mistake.studentAnswer,
          correctAnswer: mistake.correctAnswer,
          studentId,
          knowledgeAreaId,
          analysisId: analysis.id,
        };
        if (kind === "assignment") {
          await tx.mistake.create({ data });
        } else {
          await tx.examMistake.create({ data });
        }
        if (knowledgeAreaId !== null) {
          evidence.set(knowledgeAreaId, (evidence.get(knowledgeAreaId) ?? 0) + 1);
        }
      }

      for (const name of result.knowledgeAreas) {
        const knowledgeAreaId = resolveArea(name);
        if (knowledgeAreaId !== null && !evidence.has(knowledgeAreaId)) {
          evidence.set(knowledgeAreaId, 0);
        }
      }

      for (const [knowledgeAreaId, mistakeCount] of evidence) {
        const key = { studentId_knowledgeAreaId: { studentId, knowledgeAreaId } };
        const existing = await tx.studentKnowledgeArea.findUnique({ where: key });
        const mastery = updateMastery(existing?.mastery, mistakeCount);
        await tx.studentKnowledgeArea.upsert({
          where: key,
          create: { studentId, knowledgeAreaId, mastery, evidenceCount: 1 },
          update: { mastery, evidenceCount: { increment: 1 } },
        });
      }

      const done = { analysisStatus: AnalysisStatus.completed, analysisError: null, analysisQueuedAt: null };
      if (kind === "assignment") {
        await tx.assignment.update({ where: { id: submissionId }, data: done });
      } else {
        await tx.exam.update({ where: { id: submissionId }, data: done });
      }

      return analysis;
    },
    { timeout: 30_000 },
  );
}

async function settleUsage(
  kind: SubmissionKind,
  id: number,
  outcome: { ok: boolean; modelKey?: string; usage?: TokenUsage; error?: string },
) {
  const reserved = await db.aiUsage.findMany({
    where: { submissionKind: kind, submissionId: id, status: "reserved" },
    select: { id: true },
  });
  await Promise.all(reserved.map((row) => finishAiUsage(row.id, outcome)));
}

/**
 * Grades one claimed submission: download image → AI → persist analysis,
 * mistakes and mastery in one transaction. Failures are recorded on the
 * submission so they are visible in the UI and can be retried.
 */
async function processSubmission(kind: SubmissionKind, id: number, requestedModel: string | null) {
  let modelKey: string | undefined;
  try {
    const submission = await loadSubmission(kind, id);
    if (!submission) throw new Error("记录不存在");
    if (!submission.studentId || !submission.student) throw new Error("未关联学生，无法写入学情数据");

    const resolvedModel = resolveModelKey(requestedModel);
    modelKey = resolvedModel;
    const image = await fetchStoredFile(submission.imageUrl).catch((error: unknown) => {
      throw new Error(`无法读取作业图片：${describeError(error)}`);
    });
    const knownAreas = await knownAreaNames(submission.student);
    const { value, usage } = await analyzeSubmissionImage(image, resolvedModel, kind, knownAreas);
    await persistAnalysis(kind, id, submission.studentId, value, resolvedModel, knownAreas);
    await settleUsage(kind, id, { ok: true, modelKey: resolvedModel, usage });
  } catch (error) {
    const message = describeError(error);
    console.error(`[grading] ${kind} #${id} failed:`, error);
    await updateSubmission(
      kind,
      { id, analysisStatus: AnalysisStatus.processing },
      { analysisStatus: AnalysisStatus.failed, analysisError: message, analysisQueuedAt: null },
    ).catch((updateError) => console.error(`[grading] could not record failure for ${kind} #${id}:`, updateError));
    await settleUsage(kind, id, { ok: false, modelKey, error: message }).catch(() => {});
  }
}

// ─── Persistent queue ────────────────────────────────────────────────
// The queue *is* the database: a submission is queued when it is `pending`
// with `analysisQueuedAt` set. Workers claim rows atomically, so queued and
// interrupted work resumes automatically after a restart.

type ClaimedJob = { kind: SubmissionKind; id: number; modelKey: string | null };

function claimableWhere(): Prisma.AssignmentWhereInput & Prisma.ExamWhereInput {
  return {
    analysisQueuedAt: { not: null },
    OR: [
      { analysisStatus: AnalysisStatus.pending },
      {
        analysisStatus: AnalysisStatus.processing,
        OR: [{ analysisStartedAt: null }, { analysisStartedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } }],
      },
    ],
  };
}

async function findCandidate(kind: SubmissionKind) {
  const args = {
    where: claimableWhere(),
    orderBy: { analysisQueuedAt: "asc" as const },
    select: { id: true, analysisStatus: true, analysisAttempts: true, analysisModelKey: true, analysisQueuedAt: true },
  };
  return kind === "assignment" ? db.assignment.findFirst(args) : db.exam.findFirst(args);
}

async function claimNextJob(): Promise<ClaimedJob | null> {
  for (let guard = 0; guard < 20; guard++) {
    const candidates = await Promise.all(
      SUBMISSION_KINDS.map(async (kind) => ({ kind, row: await findCandidate(kind) })),
    );
    const next = candidates
      .filter((c): c is { kind: SubmissionKind; row: NonNullable<typeof c.row> } => c.row !== null)
      .sort((a, b) => (a.row.analysisQueuedAt?.getTime() ?? 0) - (b.row.analysisQueuedAt?.getTime() ?? 0))[0];
    if (!next) return null;

    const { kind, row } = next;
    const sameState = { id: row.id, analysisStatus: row.analysisStatus, analysisAttempts: row.analysisAttempts };

    if (row.analysisAttempts >= MAX_ANALYSIS_ATTEMPTS) {
      const message = "批改多次中断未能完成，请稍后重新提交分析";
      const gaveUp = await updateSubmission(kind, sameState, {
        analysisStatus: AnalysisStatus.failed,
        analysisError: message,
        analysisQueuedAt: null,
      });
      if (gaveUp.count === 1) await settleUsage(kind, row.id, { ok: false, error: message }).catch(() => {});
      continue;
    }

    const claimed = await updateSubmission(kind, sameState, {
      analysisStatus: AnalysisStatus.processing,
      analysisStartedAt: new Date(),
      analysisAttempts: { increment: 1 },
      analysisError: null,
    });
    if (claimed.count === 1) return { kind, id: row.id, modelKey: row.analysisModelKey };
  }
  return null;
}

// Kept on globalThis so dev-server module reloads share one worker instead of stacking timers.
type WorkerState = { running: number; pumping: boolean; timer: ReturnType<typeof setInterval> | null };
const globalForWorker = globalThis as unknown as { __edureviewGradingWorker?: WorkerState };
const worker: WorkerState = (globalForWorker.__edureviewGradingWorker ??= { running: 0, pumping: false, timer: null });

async function pump() {
  if (worker.pumping) return;
  worker.pumping = true;
  try {
    while (worker.running < MAX_CONCURRENT_ANALYSES) {
      const job = await claimNextJob();
      if (!job) break;
      worker.running++;
      void processSubmission(job.kind, job.id, job.modelKey).finally(() => {
        worker.running--;
        void pump();
      });
    }
  } catch (error) {
    console.error("[grading] queue polling failed:", error);
  } finally {
    worker.pumping = false;
  }
}

/** Starts the background grading worker; restarting replaces the timer so it runs the latest code. */
export function startGradingWorker() {
  if (worker.timer) clearInterval(worker.timer);
  worker.timer = setInterval(() => void pump(), POLL_INTERVAL_MS);
  worker.timer.unref?.();
  void pump();
}

/**
 * Puts a submission into the persistent grading queue and reserves one AI
 * call against `auth`'s daily quota (check it with `assertAiQuota` first).
 */
export async function enqueueSubmissionAnalysis(
  kind: SubmissionKind,
  id: number,
  options: { auth: AuthPayload; modelKey?: string | null },
) {
  const modelKey = resolveModelKey(options.modelKey);
  await updateSubmission(kind, { id }, {
    analysisStatus: AnalysisStatus.pending,
    analysisQueuedAt: new Date(),
    analysisAttempts: 0,
    analysisModelKey: modelKey,
    analysisError: null,
  });
  await reserveAiUsage(options.auth, "grading", { modelKey, submissionKind: kind, submissionId: id });
  void pump();
}

/**
 * Re-queues a failed (or never queued) submission. Returns false if it is
 * already queued or being graded, in which case nothing changes.
 */
export async function requeueSubmissionAnalysis(
  kind: SubmissionKind,
  id: number,
  options: { auth: AuthPayload; modelKey?: string | null },
): Promise<boolean> {
  const modelKey = resolveModelKey(options.modelKey);
  const result = await updateSubmission(
    kind,
    {
      id,
      OR: [
        { analysisStatus: AnalysisStatus.failed },
        { analysisStatus: AnalysisStatus.pending, analysisQueuedAt: null },
        // abandoned by the pre-queue implementation, which never set analysisQueuedAt
        {
          analysisStatus: AnalysisStatus.processing,
          analysisQueuedAt: null,
          OR: [{ analysisStartedAt: null }, { analysisStartedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } }],
        },
      ],
    },
    {
      analysisStatus: AnalysisStatus.pending,
      analysisQueuedAt: new Date(),
      analysisAttempts: 0,
      analysisModelKey: modelKey,
      analysisError: null,
    },
  );
  if (result.count === 0) return false;
  await reserveAiUsage(options.auth, "grading", { modelKey, submissionKind: kind, submissionId: id });
  void pump();
  return true;
}
