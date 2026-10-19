import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { parentProcedure, teacherProcedure } from "~/server/trpc/main";
import { enqueueSubmissionAnalysis } from "~/server/services/grading";
import { assertOwnedUpload } from "~/server/storage";
import { assertAiQuota } from "~/server/ai/usage";

const MAX_BATCH_SIZE = 10;

const batchUploadItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string(),
  fileName: z.string(),
});

const batchParentUploadSchema = z.object({
  childId: z.number(),
  assignments: z.array(batchUploadItemSchema).min(1).max(MAX_BATCH_SIZE),
  analyzeImmediately: z.boolean().default(true),
  modelKey: z.string().optional(),
});

const batchTeacherUploadSchema = z.object({
  assignments: z.array(batchUploadItemSchema.extend({ studentId: z.number() })).min(1).max(MAX_BATCH_SIZE),
  analyzeImmediately: z.boolean().default(true),
  modelKey: z.string().optional(),
});

export const batchParentUploadProcedure = parentProcedure
  .input(batchParentUploadSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const child = await db.student.findFirst({
        where: { id: input.childId, parents: { some: { parentId: ctx.auth.parentId } } },
        select: { id: true, classId: true },
      });
      if (!child) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到该孩子，或该孩子未与您的账号绑定" });
      }

      for (const item of input.assignments) {
        assertOwnedUpload(item.imageUrl, ctx.auth, ["assignment-uploads"]);
      }
      if (input.analyzeImmediately) await assertAiQuota(ctx.auth, input.assignments.length);

      const created = await db.$transaction((tx) =>
        Promise.all(
          input.assignments.map(async (item) => {
            const assignment = await tx.assignment.create({
              data: {
                title: item.title,
                imageUrl: item.imageUrl,
                uploadedBy: "parent",
                studentId: child.id,
                classId: child.classId,
              },
            });
            return {
              id: assignment.id,
              title: assignment.title,
              imageUrl: assignment.imageUrl,
              fileName: item.fileName,
              createdAt: assignment.createdAt,
            };
          }),
        ),
      );

      if (input.analyzeImmediately) {
        for (const assignment of created) {
          await enqueueSubmissionAnalysis("assignment", assignment.id, { auth: ctx.auth, modelKey: input.modelKey });
        }
      }

      return {
        success: true,
        assignments: created,
        analysisQueued: input.analyzeImmediately,
        totalCount: created.length,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Batch parent upload error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "批量上传失败，请稍后重试" });
    }
  });

export const batchTeacherUploadProcedure = teacherProcedure
  .input(batchTeacherUploadSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const studentIds = [...new Set(input.assignments.map((a) => a.studentId))];
      const students = await db.student.findMany({
        where: { id: { in: studentIds }, class: { teacherId: ctx.auth.teacherId } },
        include: { class: { select: { name: true } } },
      });
      if (students.length !== studentIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "部分学生不存在或不在您的班级中" });
      }
      const studentById = new Map(students.map((s) => [s.id, s]));

      for (const item of input.assignments) {
        assertOwnedUpload(item.imageUrl, ctx.auth, ["assignment-uploads"]);
      }
      if (input.analyzeImmediately) await assertAiQuota(ctx.auth, input.assignments.length);

      const created = await db.$transaction((tx) =>
        Promise.all(
          input.assignments.map(async (item) => {
            const student = studentById.get(item.studentId)!;
            const assignment = await tx.assignment.create({
              data: {
                title: item.title,
                imageUrl: item.imageUrl,
                uploadedBy: "teacher",
                studentId: student.id,
                classId: student.classId,
              },
            });
            return {
              id: assignment.id,
              title: assignment.title,
              imageUrl: assignment.imageUrl,
              fileName: item.fileName,
              studentName: student.name,
              className: student.class?.name ?? "",
              createdAt: assignment.createdAt,
            };
          }),
        ),
      );

      if (input.analyzeImmediately) {
        for (const assignment of created) {
          await enqueueSubmissionAnalysis("assignment", assignment.id, { auth: ctx.auth, modelKey: input.modelKey });
        }
      }

      return {
        success: true,
        assignments: created,
        totalCount: created.length,
        analysisQueued: input.analyzeImmediately,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Batch teacher upload error:", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "批量上传失败，请稍后重试" });
    }
  });
