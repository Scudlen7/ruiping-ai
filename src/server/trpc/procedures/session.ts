import { db } from "~/server/db";
import { resolveSession } from "~/server/auth/session";
import { baseProcedure, endSession } from "~/server/trpc/main";
import { loadParentProfile } from "~/server/services/parentBinding";

/** Who is signed in according to the session cookie; null when signed out or the session was revoked. */
export const getSession = baseProcedure.query(async ({ ctx }) => {
  const auth = await resolveSession(ctx.sessionToken);
  if (auth?.teacherId != null) {
    const teacher = await db.teacher.findUnique({
      where: { id: auth.teacherId },
      select: { id: true, phoneNumber: true, name: true },
    });
    return teacher ? { role: "teacher" as const, teacher } : null;
  }
  if (auth?.parentId != null) {
    return { role: "parent" as const, parent: await loadParentProfile(auth.parentId) };
  }
  return null;
});

export const logout = baseProcedure.mutation(async ({ ctx }) => {
  await endSession(ctx, await resolveSession(ctx.sessionToken));
  return { success: true };
});
