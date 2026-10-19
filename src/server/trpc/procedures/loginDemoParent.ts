import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";
import { loadParentProfile } from "~/server/services/parentBinding";

/** Must match DEMO_PARENT_PHONE in prisma/seed.ts. */
const DEMO_PARENT_PHONE = "13900000001";

export const loginDemoParent = baseProcedure.mutation(async ({ ctx }) => {
  const parent = await db.parent.findUnique({
    where: { phoneNumber: DEMO_PARENT_PHONE },
    select: { id: true, tokenVersion: true },
  });
  if (!parent) {
    throw new TRPCError({ code: "NOT_FOUND", message: "家长演示账户尚未初始化，请先运行 pnpm seed" });
  }
  startSession(ctx, { parentId: parent.id }, parent.tokenVersion);
  return { success: true, parent: await loadParentProfile(parent.id) };
});
