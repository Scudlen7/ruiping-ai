import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { createMiddleware } from "~/server/trpc/main";

export interface RateLimitConfig {
  /** Requests allowed per phone number within the window. */
  maxRequests: number;
  /** Requests allowed per client IP within the window; higher because schools and families share IPs. */
  maxRequestsPerIp?: number;
  windowSeconds: number;
  keyPrefix: string;
}

const CLEANUP_PROBABILITY = 0.01;

/**
 * Atomically counts one hit in a fixed window stored in PostgreSQL, so limits survive restarts
 * and are shared by every server instance. Returns the count including this hit.
 */
async function hit(key: string, windowSeconds: number): Promise<{ count: number; resetAt: Date }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limit_buckets"."resetAt" <= ${now} THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "resetAt" = CASE WHEN "rate_limit_buckets"."resetAt" <= ${now} THEN EXCLUDED."resetAt" ELSE "rate_limit_buckets"."resetAt" END
    RETURNING "count", "resetAt"`;
  return rows[0]!;
}

function phoneFromRawInput(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "phoneNumber" in raw && typeof raw.phoneNumber === "string") {
    return raw.phoneNumber.trim() || null;
  }
  return null;
}

/**
 * Rate limits a procedure by phone number (stops password guessing on one account) and by client IP
 * (stops one client from cycling through phone numbers).
 *
 * @example
 * export const loginTeacher = baseProcedure
 *   .use(rateLimiter({ maxRequests: 5, windowSeconds: 60, keyPrefix: "loginTeacher" }))
 */
export function rateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowSeconds, keyPrefix } = config;
  const maxRequestsPerIp = config.maxRequestsPerIp ?? maxRequests * 4;

  return createMiddleware(async ({ ctx, getRawInput, next }) => {
    // Runs before `.input()` parsing, so read the raw payload.
    const phoneNumber = phoneFromRawInput(await getRawInput().catch(() => undefined));

    const checks: Array<Promise<{ count: number; resetAt: Date; limit: number }>> = [
      hit(`${keyPrefix}:ip:${ctx.clientIp}`, windowSeconds).then((r) => ({ ...r, limit: maxRequestsPerIp })),
    ];
    if (phoneNumber) {
      checks.push(hit(`${keyPrefix}:phone:${phoneNumber}`, windowSeconds).then((r) => ({ ...r, limit: maxRequests })));
    }

    const exceeded = (await Promise.all(checks)).filter((r) => r.count > r.limit);
    if (Math.random() < CLEANUP_PROBABILITY) {
      void db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 3600_000) } } }).catch(() => {});
    }

    if (exceeded.length > 0) {
      const resetAt = Math.max(...exceeded.map((r) => r.resetAt.getTime()));
      const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `请求过于频繁，请在 ${retryAfterSec} 秒后重试。`,
      });
    }

    return next();
  });
}
