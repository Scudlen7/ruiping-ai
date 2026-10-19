import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { env } from "~/server/env";
import type { AuthPayload } from "~/server/auth/session";

export type AiFeature = "grading" | "recognition" | "questions" | "class-progress" | "batch-analysis";
export type TokenUsage = { inputTokens: number; outputTokens: number };

const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in China Standard Time, which is when the daily quota resets. */
export function startOfQuotaDay(now = new Date()): Date {
  const shifted = now.getTime() + CHINA_UTC_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - CHINA_UTC_OFFSET_MS);
}

function actorOf(auth: AuthPayload): { actorType: "teacher" | "parent"; actorId: number } {
  if (auth.teacherId != null) return { actorType: "teacher", actorId: auth.teacherId };
  if (auth.parentId != null) return { actorType: "parent", actorId: auth.parentId };
  throw new TRPCError({ code: "UNAUTHORIZED", message: "登录已过期，请重新登录" });
}

/** Calls made today that count against the quota (failed calls are not charged). */
export async function countAiUsageToday(auth: AuthPayload): Promise<number> {
  return db.aiUsage.count({
    where: { ...actorOf(auth), createdAt: { gte: startOfQuotaDay() }, status: { not: "failed" } },
  });
}

/** Throws TOO_MANY_REQUESTS if `units` more AI calls would exceed the account's daily limit. */
export async function assertAiQuota(auth: AuthPayload, units = 1): Promise<void> {
  const limit = env.AI_DAILY_LIMIT_PER_USER;
  const used = await countAiUsageToday(auth);
  if (used + units > limit) {
    const remaining = Math.max(0, limit - used);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        remaining > 0
          ? `今日 AI 额度仅剩 ${remaining} 次（每日上限 ${limit} 次），本次需要 ${units} 次，请减少数量或明天再试`
          : `今日 AI 使用次数已达上限（${limit} 次），请明天再试`,
    });
  }
}

export async function reserveAiUsage(
  auth: AuthPayload,
  feature: AiFeature,
  extra: { modelKey?: string; submissionKind?: string; submissionId?: number } = {},
): Promise<number> {
  const row = await db.aiUsage.create({
    data: { ...actorOf(auth), feature, status: "reserved", ...extra },
    select: { id: true },
  });
  return row.id;
}

export async function finishAiUsage(
  id: number,
  outcome: { ok: boolean; modelKey?: string; usage?: TokenUsage; error?: string },
): Promise<void> {
  await db.aiUsage.update({
    where: { id },
    data: {
      status: outcome.ok ? "succeeded" : "failed",
      modelKey: outcome.modelKey,
      inputTokens: outcome.usage?.inputTokens,
      outputTokens: outcome.usage?.outputTokens,
      error: outcome.error?.slice(0, 500),
      finishedAt: new Date(),
    },
  });
}

/** Quota check + accounting around one synchronous AI call. */
export async function trackAiCall<T>(
  auth: AuthPayload,
  feature: AiFeature,
  modelKey: string,
  call: () => Promise<{ value: T; usage: TokenUsage }>,
): Promise<T> {
  await assertAiQuota(auth);
  const usageId = await reserveAiUsage(auth, feature, { modelKey });
  try {
    const { value, usage } = await call();
    await finishAiUsage(usageId, { ok: true, modelKey, usage });
    return value;
  } catch (error) {
    await finishAiUsage(usageId, {
      ok: false,
      modelKey,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    throw error;
  }
}
