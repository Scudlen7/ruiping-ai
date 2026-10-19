import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import {
  clearedSessionCookie,
  resolveSession,
  revokeSessions,
  sessionCookie,
  signSessionToken,
  type AuthPayload,
  type SessionIdentity,
} from "~/server/auth/session";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
export const createMiddleware = t.middleware;

/** Issues a session cookie for the account (used by login and registration). */
export function startSession(ctx: TRPCContext, identity: SessionIdentity, tokenVersion: number) {
  ctx.resHeaders.append("Set-Cookie", sessionCookie(signSessionToken(identity, tokenVersion)));
}

/** Revokes all of the account's sessions and clears the cookie in this browser. */
export async function endSession(ctx: TRPCContext, auth: AuthPayload | null) {
  if (auth) await revokeSessions(auth);
  ctx.resHeaders.append("Set-Cookie", clearedSessionCookie());
}

/** Requires a valid session cookie; exposes `ctx.auth`. */
export const authedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const auth = await resolveSession(ctx.sessionToken);
  if (!auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "登录已过期，请重新登录" });
  }
  return next({ ctx: { auth } });
});

/**
 * Teacher-only procedure. `ctx.auth.teacherId` is guaranteed to be a number, so it can be used
 * directly in Prisma filters (an `undefined` filter would silently match every row).
 */
export const teacherProcedure = authedProcedure.use(({ ctx, next }) => {
  const { teacherId } = ctx.auth;
  if (teacherId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅教师账号可以执行该操作" });
  }
  return next({ ctx: { auth: { teacherId } } });
});

/** Parent-only procedure; `ctx.auth.parentId` is guaranteed to be a number. */
export const parentProcedure = authedProcedure.use(({ ctx, next }) => {
  const { parentId } = ctx.auth;
  if (parentId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅家长账号可以执行该操作" });
  }
  return next({ ctx: { auth: { parentId } } });
});
