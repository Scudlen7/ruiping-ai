import { TRPCError } from "@trpc/server";
import { APICallError } from "ai";
import { AiOutputError } from "./structured";

/** User-facing Chinese description of an AI call failure (never includes request data or keys). */
export function describeAiError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return "AI 服务繁忙（请求过多），请稍后重试";
    if (error.statusCode === 401 || error.statusCode === 403) return "AI 服务认证失败，请联系管理员检查 API 密钥配置";
    let providerMessage = error.message;
    try {
      const body = JSON.parse(error.responseBody ?? "") as { message?: unknown; error?: { message?: unknown } };
      const detail = body.error?.message ?? body.message;
      if (typeof detail === "string" && detail) providerMessage = detail;
    } catch {
      // responseBody is not JSON; keep the SDK message
    }
    return `AI 服务调用失败（HTTP ${error.statusCode ?? "?"}）：${providerMessage}`.slice(0, 500);
  }
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "AI 处理超时，请稍后重试或换用更小的图片";
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

/** Wraps a synchronous AI failure as a TRPCError, keeping existing TRPCErrors (e.g. quota) intact. */
export function toAiTrpcError(error: unknown, action: string): TRPCError {
  if (error instanceof TRPCError) return error;
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: describeAiError(error), cause: error });
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new TRPCError({ code: "TIMEOUT", message: describeAiError(error), cause: error });
  }
  const detail = error instanceof AiOutputError || APICallError.isInstance(error) ? describeAiError(error) : "请稍后重试";
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `${action}失败：${detail}`, cause: error });
}
