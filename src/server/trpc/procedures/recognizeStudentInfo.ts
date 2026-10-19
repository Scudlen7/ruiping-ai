import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { recognizeStudentInfo, getAvailableVisionModels, resolveModelKey } from "~/server/ai-service";
import { authedProcedure, teacherProcedure } from "~/server/trpc/main";
import { assertOwnedUpload, fetchStoredFile } from "~/server/storage";
import { trackAiCall } from "~/server/ai/usage";
import { toAiTrpcError } from "~/server/ai/errors";

export const recognizeStudentInfoProcedure = teacherProcedure
  .input(z.object({
    imageUrl: z.string(),
    modelKey: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    assertOwnedUpload(input.imageUrl, ctx.auth, ["assignment-uploads", "exam-uploads"]);

    let imageBuffer: Buffer;
    try {
      imageBuffer = await fetchStoredFile(input.imageUrl);
    } catch (error) {
      console.error("Failed to fetch image from OSS:", error);
      throw new TRPCError({ code: "BAD_REQUEST", message: "无法读取已上传的图片，请重新上传" });
    }

    const modelKey = resolveModelKey(input.modelKey);
    try {
      const recognition = await trackAiCall(ctx.auth, "recognition", modelKey, () =>
        recognizeStudentInfo(imageBuffer, modelKey),
      );
      return { success: true, recognition, modelUsed: modelKey };
    } catch (error) {
      console.error("Student recognition failed:", error);
      throw toAiTrpcError(error, "识别学生信息");
    }
  });

export const getAvailableModelsProcedure = authedProcedure
  .query(() => {
    return {
      models: getAvailableVisionModels(),
    };
  });
