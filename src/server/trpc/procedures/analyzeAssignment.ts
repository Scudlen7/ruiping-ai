import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedProcedure } from "~/server/trpc/main";
import { assertSubmissionAccess, requeueSubmissionAnalysis } from "~/server/services/grading";
import { assertAiQuota } from "~/server/ai/usage";

/**
 * Queues grading for an assignment or exam in the background and returns
 * immediately. Used for retrying failed analyses.
 */
export const analyzeSubmissionProcedure = authedProcedure
  .input(z.object({
    kind: z.enum(["assignment", "exam"]),
    id: z.number(),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const submission = await assertSubmissionAccess(input.kind, input.id, ctx.auth);

    if (submission.analysisStatus === "completed") {
      throw new TRPCError({ code: "CONFLICT", message: "已完成批改，无需重复分析" });
    }

    await assertAiQuota(ctx.auth);
    const queued = await requeueSubmissionAnalysis(input.kind, input.id, { auth: ctx.auth, modelKey: input.modelKey });
    if (!queued) {
      throw new TRPCError({ code: "CONFLICT", message: "正在排队或批改中，请稍候" });
    }
    return { success: true, status: "pending" as const };
  });
