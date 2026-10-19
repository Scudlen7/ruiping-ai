import bcryptjs from "bcryptjs";
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/trpc/main";
import { appRouter } from "~/server/trpc/root";
import { SESSION_COOKIE, readCookie } from "~/server/auth/session";
import { assertTestDatabase } from "../test-env";

const createCaller = createCallerFactory(appRouter);

/** Empties every application table (keeps the migration history). */
export async function resetDatabase() {
  assertTestDatabase(process.env.DATABASE_URL ?? "");
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/**
 * A tRPC caller that behaves like one browser: it keeps the session cookie the
 * server sets and sends it on later calls.
 */
export function browserSession(clientIp = "203.0.113.10") {
  let sessionToken: string | null = null;

  const call = () => {
    const resHeaders = new Headers();
    const caller = createCaller({ sessionToken, clientIp, resHeaders });
    return { caller, resHeaders };
  };

  return {
    get token() {
      return sessionToken;
    },
    setToken(token: string | null) {
      sessionToken = token;
    },
    /** Runs one procedure call and applies any Set-Cookie it returns. */
    async run<T>(fn: (caller: ReturnType<typeof createCaller>) => Promise<T>): Promise<T> {
      const { caller, resHeaders } = call();
      try {
        return await fn(caller);
      } finally {
        for (const header of resHeaders.getSetCookie()) {
          const value = readCookie(header.split(";")[0], SESSION_COOKIE);
          sessionToken = value ? value : null;
        }
      }
    },
  };
}

export const TEST_PASSWORD = "Passw0rdTest";

export async function createTeacher(phoneNumber = "13800000001", name = "测试老师") {
  return db.teacher.create({
    data: { phoneNumber, name, password: await bcryptjs.hash(TEST_PASSWORD, 4) },
  });
}

export async function createParent(phoneNumber = "13900000001", name = "测试家长") {
  return db.parent.create({
    data: { phoneNumber, name, password: await bcryptjs.hash(TEST_PASSWORD, 4) },
  });
}

let invitationCounter = 0;

export async function createClassWithStudent(teacherId: number, options: { parentId?: number } = {}) {
  invitationCounter += 1;
  const klass = await db.class.create({
    data: {
      name: `测试班级${invitationCounter}`,
      invitationCode: `TEST${Date.now()}${invitationCounter}`,
      invitationCodeExpiresAt: new Date(Date.now() + 86_400_000),
      teacherId,
    },
  });
  const student = await db.student.create({
    data: {
      name: `学生${invitationCounter}`,
      classId: klass.id,
      parents: options.parentId ? { create: { parentId: options.parentId } } : undefined,
    },
  });
  return { klass, student };
}

/** Object URL inside the fake test bucket, shaped like generatePresignedUploadUrl's keys. */
export function bucketUrl(key: string) {
  return `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT}/${key}`;
}

export async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
