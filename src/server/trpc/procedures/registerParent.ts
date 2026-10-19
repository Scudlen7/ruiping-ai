import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import { passwordSchema, phoneSchema } from "~/server/services/accountValidation";
import {
  bindOrRequest,
  findBindableStudent,
  loadParentProfile,
  redeemFamilyInvite,
} from "~/server/services/parentBinding";

/**
 * Creates a parent account and links a child in the same step, either with a family invite code
 * or with the class invitation code + child name (which becomes a teacher-approved request if the
 * child already has parents).
 */
export const registerParent = baseProcedure
  .use(rateLimiter({ maxRequests: 5, windowSeconds: 60, keyPrefix: "registerParent" }))
  .input(z.object({
    name: z.string().trim().min(1, "请输入家长姓名").max(50),
    phoneNumber: phoneSchema,
    password: passwordSchema,
    relation: z.string().trim().max(20).optional(),
    familyInviteCode: z.string().trim().max(20).optional(),
    classInvitationCode: z.string().trim().optional(),
    childName: z.string().trim().max(50).optional(),
  }).refine((data) => !!data.familyInviteCode || (!!data.classInvitationCode && !!data.childName), {
    message: "请输入家庭邀请码，或班级邀请码和孩子姓名",
    path: ["classInvitationCode"],
  }))
  .mutation(async ({ input, ctx }) => {
    const hashedPassword = await bcryptjs.hash(input.password, 12);

    try {
      const { parent, outcome } = await db.$transaction(async (tx) => {
        // Validate the class code/name before creating the account so typos don't leave an orphan account.
        const student = input.familyInviteCode
          ? null
          : await findBindableStudent(tx, input.classInvitationCode!, input.childName!);
        const parent = await tx.parent.create({
          data: { name: input.name, phoneNumber: input.phoneNumber, password: hashedPassword },
          select: { id: true, tokenVersion: true },
        });
        const outcome = student
          ? await bindOrRequest(tx, student.id, parent.id, input.relation)
          : await redeemFamilyInvite(tx, input.familyInviteCode!, parent.id, input.relation);
        return { parent, outcome };
      });

      startSession(ctx, { parentId: parent.id }, parent.tokenVersion);
      return { success: true, ...outcome, parent: await loadParentProfile(parent.id) };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new TRPCError({ code: "CONFLICT", message: "该手机号已被注册" });
      }
      console.error("registerParent failed:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败，请稍后重试" });
    }
  });
