import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { db } from "~/server/db";
import { baseProcedure, startSession } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import { phoneSchema } from "~/server/services/accountValidation";

export const loginTeacher = baseProcedure
  .use(rateLimiter({ maxRequests: 5, windowSeconds: 60, keyPrefix: "loginTeacher" }))
  .input(z.object({
    phoneNumber: phoneSchema,
    password: z.string().min(1, "请输入密码"),
  }))
  .mutation(async ({ input, ctx }) => {
    const teacher = await db.teacher.findUnique({
      where: { phoneNumber: input.phoneNumber },
      select: { id: true, phoneNumber: true, name: true, password: true, tokenVersion: true },
    });
    const valid = teacher ? await bcryptjs.compare(input.password, teacher.password) : false;
    if (!teacher || !valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "手机号码或密码无效" });
    }

    startSession(ctx, { teacherId: teacher.id }, teacher.tokenVersion);
    return {
      success: true,
      teacher: { id: teacher.id, phoneNumber: teacher.phoneNumber, name: teacher.name },
    };
  });
