import { z } from "zod";
import { db } from "~/server/db";
import { parentProcedure } from "~/server/trpc/main";
import { rateLimiter } from "~/server/trpc/rateLimiter";
import { bindOrRequest, findBindableStudent, loadParentProfile } from "~/server/services/parentBinding";

const relationSchema = z.string().trim().max(20).optional();

/** Class code + child name: links directly if the child has no parent yet, otherwise files a request for the teacher. */
export const linkChild = parentProcedure
  .use(rateLimiter({ maxRequests: 10, maxRequestsPerIp: 10, windowSeconds: 600, keyPrefix: "linkChild" }))
  .input(z.object({
    classInvitationCode: z.string().trim().min(1, "请输入班级邀请码"),
    childName: z.string().trim().min(1, "请输入孩子姓名").max(50),
    relation: relationSchema,
  }))
  .mutation(async ({ input, ctx }) => {
    const outcome = await db.$transaction(async (tx) => {
      const student = await findBindableStudent(tx, input.classInvitationCode, input.childName);
      return bindOrRequest(tx, student.id, ctx.auth.parentId, input.relation);
    });
    return { success: true, ...outcome, parent: await loadParentProfile(ctx.auth.parentId) };
  });
