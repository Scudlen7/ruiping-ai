import { env } from "~/server/env";
import { authedProcedure } from "~/server/trpc/main";
import { countAiUsageToday, startOfQuotaDay } from "~/server/ai/usage";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's AI calls for the signed-in account against the daily limit. */
export const getAiUsageSummary = authedProcedure.query(async ({ ctx }) => {
  const used = await countAiUsageToday(ctx.auth);
  return {
    used,
    limit: env.AI_DAILY_LIMIT_PER_USER,
    resetsAt: new Date(startOfQuotaDay().getTime() + DAY_MS),
  };
});
