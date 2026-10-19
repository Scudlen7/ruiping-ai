import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import { isOpenRegistration } from "~/server/services/registration";
import { passwordSchema, phoneSchema } from "~/server/services/accountValidation";

export const registerTeacher = baseProcedure
  .use(rateLimiter({ maxRequests: 5, windowSeconds: 60, keyPrefix: "registerTeacher" }))
  .input(z.object({
    phoneNumber: phoneSchema,
    name: z.string().trim().min(1, "请输入姓名").max(50),
    password: passwordSchema,
    invitationCode: z.string().trim().optional(),
  }).refine((data) => !data.password.toLowerCase().includes(data.name.toLowerCase()), {
    message: "密码不能包含您的姓名",
    path: ["password"],
  }))
  .mutation(async ({ input, ctx }) => {
    const openRegistration = isOpenRegistration();
    const code = input.invitationCode?.toUpperCase() || null;
    if (!openRegistration && !code) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "请输入邀请码" });
    }

    const hashedPassword = await bcryptjs.hash(input.password, 12);

    try {
      const teacher = await db.$transaction(async (tx) => {
        let registrationCodeId: number | null = null;

        if (code) {
          const now = new Date();
          const consumed = await tx.registrationCode.updateMany({
            where: {
              code,
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              usedCount: { lt: tx.registrationCode.fields.maxUses },
            },
            data: { usedCount: { increment: 1 } },
          });

          if (consumed.count === 0) {
            if (!openRegistration) {
              throw new TRPCError({ code: "FORBIDDEN", message: "邀请码无效、已过期或已用完，请联系管理员" });
            }
          } else {
            const record = await tx.registrationCode.findUniqueOrThrow({ where: { code }, select: { id: true } });
            registrationCodeId = record.id;
          }
        }

        return tx.teacher.create({
          data: {
            phoneNumber: input.phoneNumber,
            name: input.name,
            password: hashedPassword,
            registrationCodeId,
          },
          select: { id: true, phoneNumber: true, name: true, tokenVersion: true },
        });
      });

      startSession(ctx, { teacherId: teacher.id }, teacher.tokenVersion);
      return {
        success: true,
        teacher: { id: teacher.id, phoneNumber: teacher.phoneNumber, name: teacher.name },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new TRPCError({ code: "CONFLICT", message: "该手机号已被注册" });
      }
      console.error("registerTeacher failed:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败，请稍后重试" });
    }
  });
