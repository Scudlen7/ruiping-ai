import { randomInt } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { db } from "~/server/db";

type Tx = Prisma.TransactionClient;

export const MAX_PARENTS_PER_STUDENT = 6;
export const FAMILY_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_INVITES_PER_STUDENT = 5;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 8;

export type BindingOutcome = { status: "linked"; studentId: number } | { status: "pending"; studentId: number };

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

/** Invite codes are shown as `ABCD-EFGH`; users may type them with or without the dash or in lower case. */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function normalizeRelation(relation: string | null | undefined): string | null {
  const trimmed = relation?.trim().slice(0, 20);
  return trimmed ? trimmed : null;
}

/** Serializes binding changes for one student so the parent cap and duplicate checks cannot race. */
async function lockStudent(tx: Tx, studentId: number) {
  await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id" = ${studentId} FOR UPDATE`;
}

/**
 * Finds the student a parent wants to bind: the class is identified by the invitation code the teacher
 * shares (shown on the class page), the student by the name the teacher registered.
 */
export async function findBindableStudent(tx: Tx, classInvitationCode: string, childName: string) {
  const cls = await tx.class.findFirst({
    where: {
      invitationCode: classInvitationCode.trim().toUpperCase(),
      status: "active",
      invitationCodeExpiresAt: { gt: new Date() },
    },
    select: { id: true, name: true },
  });
  if (!cls) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "班级邀请码无效或已过期，请向老师获取最新邀请码" });
  }

  const matches = await tx.student.findMany({
    where: { classId: cls.id, name: childName.trim() },
    select: { id: true },
  });
  if (matches.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: `「${cls.name}」中没有找到该学生，请确认姓名与老师登记的一致` });
  }
  if (matches.length > 1) {
    throw new TRPCError({ code: "CONFLICT", message: "班级中有重名学生，请联系老师协助绑定" });
  }
  return matches[0]!;
}

/** Links parent and child (caller must hold the student lock); enforces uniqueness and the parent cap. */
async function createLink(tx: Tx, studentId: number, parentId: number, relation: string | null) {
  const linkedParentIds = (
    await tx.parentStudent.findMany({ where: { studentId }, select: { parentId: true } })
  ).map((link) => link.parentId);
  if (linkedParentIds.includes(parentId)) {
    throw new TRPCError({ code: "CONFLICT", message: "您已经绑定过该学生" });
  }
  if (linkedParentIds.length >= MAX_PARENTS_PER_STUDENT) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `该学生绑定的家长已达上限（${MAX_PARENTS_PER_STUDENT} 位），如需调整请联系老师`,
    });
  }
  await tx.parentStudent.create({ data: { studentId, parentId, relation } });
  await tx.parentBindingRequest.updateMany({
    where: { studentId, parentId, status: "pending" },
    data: { status: "approved", decidedAt: new Date() },
  });
}

/**
 * Class code + name flow. The first parent of a child is linked directly; once a child has parents,
 * anyone else needs a family invite or the teacher's approval, so this files a request instead.
 */
export async function bindOrRequest(
  tx: Tx,
  studentId: number,
  parentId: number,
  relation?: string | null,
): Promise<BindingOutcome> {
  await lockStudent(tx, studentId);
  const linkedCount = await tx.parentStudent.count({ where: { studentId } });
  if (linkedCount === 0) {
    await createLink(tx, studentId, parentId, normalizeRelation(relation));
    return { status: "linked", studentId };
  }

  if (await tx.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } })) {
    throw new TRPCError({ code: "CONFLICT", message: "您已经绑定过该学生" });
  }
  if (linkedCount >= MAX_PARENTS_PER_STUDENT) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `该学生绑定的家长已达上限（${MAX_PARENTS_PER_STUDENT} 位），如需调整请联系老师`,
    });
  }
  if (await tx.parentBindingRequest.findFirst({ where: { studentId, parentId, status: "pending" } })) {
    throw new TRPCError({ code: "CONFLICT", message: "您已提交过绑定申请，请等待老师审批" });
  }
  await tx.parentBindingRequest.create({ data: { studentId, parentId, relation: normalizeRelation(relation) } });
  return { status: "pending", studentId };
}

/** Redeems a family invite: single use, not expired, and its creator must still be linked to the child. */
export async function redeemFamilyInvite(
  tx: Tx,
  rawCode: string,
  parentId: number,
  relation?: string | null,
): Promise<BindingOutcome> {
  const invalid = new TRPCError({ code: "BAD_REQUEST", message: "家庭邀请码无效、已使用或已过期，请让家人重新生成" });
  const invite = await tx.familyInvite.findUnique({ where: { code: normalizeInviteCode(rawCode) } });
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw invalid;

  await lockStudent(tx, invite.studentId);
  const inviterStillLinked = await tx.parentStudent.findUnique({
    where: { parentId_studentId: { parentId: invite.createdByParentId, studentId: invite.studentId } },
  });
  if (!inviterStillLinked) throw invalid;

  const consumed = await tx.familyInvite.updateMany({
    where: { id: invite.id, usedAt: null },
    data: { usedAt: new Date(), usedByParentId: parentId },
  });
  if (consumed.count === 0) throw invalid;

  await createLink(tx, invite.studentId, parentId, normalizeRelation(relation));
  return { status: "linked", studentId: invite.studentId };
}

/** Approves or rejects a pending request; approval re-checks the cap at decision time. */
export async function decideBindingRequest(requestId: number, teacherId: number, approve: boolean) {
  return db.$transaction(async (tx) => {
    const request = await tx.parentBindingRequest.findFirst({
      where: { id: requestId, student: { class: { teacherId } } },
      select: { id: true, studentId: true, parentId: true, relation: true, status: true },
    });
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "绑定申请不存在" });

    await lockStudent(tx, request.studentId);
    const current = await tx.parentBindingRequest.findUniqueOrThrow({ where: { id: request.id }, select: { status: true } });
    if (current.status !== "pending") {
      throw new TRPCError({ code: "CONFLICT", message: "该申请已处理过" });
    }

    if (approve) {
      await createLink(tx, request.studentId, request.parentId, request.relation);
    } else {
      await tx.parentBindingRequest.update({
        where: { id: request.id },
        data: { status: "rejected", decidedAt: new Date() },
      });
    }
    return { studentId: request.studentId };
  });
}

/** Removes a parent-child link and invalidates the unused invites that parent created for the child. */
export async function unlinkParent(studentId: number, parentId: number) {
  await db.$transaction(async (tx) => {
    const removed = await tx.parentStudent.deleteMany({ where: { studentId, parentId } });
    if (removed.count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "该家长未绑定此学生" });
    await tx.familyInvite.deleteMany({ where: { studentId, createdByParentId: parentId, usedAt: null } });
  });
}

export async function createFamilyInvite(parentId: number, studentId: number) {
  const link = await db.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
  if (!link) throw new TRPCError({ code: "FORBIDDEN", message: "您未绑定该学生" });

  const linkedCount = await db.parentStudent.count({ where: { studentId } });
  if (linkedCount >= MAX_PARENTS_PER_STUDENT) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `每名学生最多绑定 ${MAX_PARENTS_PER_STUDENT} 位家长，当前已满`,
    });
  }

  const now = new Date();
  const active = await db.familyInvite.count({ where: { studentId, usedAt: null, expiresAt: { gt: now } } });
  if (active >= MAX_ACTIVE_INVITES_PER_STUDENT) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `该学生已有 ${active} 个未使用的家庭邀请码，请先使用或等待过期`,
    });
  }

  const expiresAt = new Date(now.getTime() + FAMILY_INVITE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");
    try {
      await db.familyInvite.create({ data: { code, studentId, createdByParentId: parentId, expiresAt } });
      return { code: formatInviteCode(code), expiresAt };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "生成邀请码失败，请重试" });
}

/** Parent profile in the shape the client auth store expects. */
export async function loadParentProfile(parentId: number) {
  const parent = await db.parent.findUniqueOrThrow({
    where: { id: parentId },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      children: {
        select: {
          student: {
            select: { id: true, name: true, schoolName: true, grade: true, className: true, class: { select: { name: true } } },
          },
        },
        orderBy: { studentId: "asc" },
      },
    },
  });
  return {
    id: parent.id,
    phoneNumber: parent.phoneNumber,
    name: parent.name,
    children: parent.children.map(({ student: child }) => ({
      id: child.id,
      name: child.name,
      schoolName: child.schoolName ?? "",
      grade: child.grade ?? "",
      className: child.class?.name ?? child.className ?? "",
    })),
  };
}
