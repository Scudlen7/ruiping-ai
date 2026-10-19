import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { teacherProcedure } from "~/server/trpc/main";
import { recognizeClassRoster, resolveModelKey } from "~/server/ai-service";
import { trackAiCall } from "~/server/ai/usage";
import { toAiTrpcError } from "~/server/ai/errors";
import { assignMissingStudentIds } from "~/lib/rosterIds";

/** ~8 MB image once decoded. */
const MAX_IMAGE_BASE64_LENGTH = 11_000_000;
const MAX_ROSTER_SIZE = 100;

export const analyzeBatchStudents = teacherProcedure
  .input(z.object({
    imageBase64: z.string().min(1).max(MAX_IMAGE_BASE64_LENGTH, "图片过大，请上传 8MB 以内的图片"),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const modelKey = resolveModelKey(input.modelKey);
    const imageBuffer = Buffer.from(input.imageBase64, "base64");
    if (imageBuffer.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "图片内容为空，请重新选择图片" });
    }

    let roster;
    try {
      roster = await trackAiCall(ctx.auth, "batch-analysis", modelKey, () => recognizeClassRoster(imageBuffer, modelKey));
    } catch (error) {
      console.error("Batch student analysis error:", error);
      throw toAiTrpcError(error, "识别学生名单");
    }

    const { students, autoAssignedStudentIds } = assignMissingStudentIds(roster.students.slice(0, MAX_ROSTER_SIZE));

    return {
      success: true,
      analysis: {
        students,
        autoAssignedStudentIds,
        confidence: students.length ? roster.confidence : 0.1,
        reasoning: students.length
          ? roster.reasoning
          : "未能从图片中识别到学生信息。请检查：1. 图片是否包含学生名单；2. 文字是否清晰可读；3. 尝试其他 AI 模型",
      },
    };
  });
