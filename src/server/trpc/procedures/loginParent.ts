import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import { phoneSchema } from "~/server/services/accountValidation";
import { loadParentProfile } from "~/server/services/parentBinding";

export const loginParent = baseProcedure
  .use(rateLimiter({ maxRequests: 5, windowSeconds: 60, keyPrefix: "loginParent" }))
  .input(z.object({
    phoneNumber: phoneSchema,
    password: z.string().min(1, "请输入密码"),
  }))
  .mutation(async ({ input, ctx }) => {
    const parent = await db.parent.findUnique({
      where: { phoneNumber: input.phoneNumber },
      select: { id: true, password: true, tokenVersion: true },
    });
    const valid = parent ? await bcryptjs.compare(input.password, parent.password) : false;
    if (!parent || !valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "手机号码或密码无效" });
    }

    startSession(ctx, { parentId: parent.id }, parent.tokenVersion);
    return { success: true, parent: await loadParentProfile(parent.id) };
  });
