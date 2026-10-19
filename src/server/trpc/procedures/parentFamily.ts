import { z } from "zod";
import { db } from "~/server/db";
import { parentProcedure } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import {
  createFamilyInvite as issueFamilyInvite,
  loadParentProfile,
  redeemFamilyInvite,
  unlinkParent,
} from "~/server/services/parentBinding";

/** Links a child using a family invite code shared by a parent who is already linked. */
export const joinFamily = parentProcedure
  .use(rateLimiter({ maxRequests: 10, maxRequestsPerIp: 10, windowSeconds: 600, keyPrefix: "joinFamily" }))
  .input(z.object({
    familyInviteCode: z.string().trim().min(1, "请输入家庭邀请码").max(20),
    relation: z.string().trim().max(20).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const outcome = await db.$transaction((tx) =>
      redeemFamilyInvite(tx, input.familyInviteCode, ctx.auth.parentId, input.relation),
    );
    return { success: true, ...outcome, parent: await loadParentProfile(ctx.auth.parentId) };
  });

export const createFamilyInvite = parentProcedure
  .use(rateLimiter({ maxRequests: 10, windowSeconds: 3600, keyPrefix: "createFamilyInvite" }))
  .input(z.object({ studentId: z.number() }))
  .mutation(async ({ input, ctx }) => issueFamilyInvite(ctx.auth.parentId, input.studentId));

/** A parent removes their own link to a child. */
export const leaveChild = parentProcedure
  .input(z.object({ studentId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    await unlinkParent(input.studentId, ctx.auth.parentId);
    return { success: true, parent: await loadParentProfile(ctx.auth.parentId) };
  });
