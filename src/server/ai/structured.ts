import { APICallError, generateObject, generateText, type LanguageModelV1 } from "ai";
import type { z } from "zod";
import { env } from "~/server/env";
import type { TokenUsage } from "./usage";

export const DEFAULT_AI_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 20_000;

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}

function isRetryable(error: unknown): boolean {
  if (APICallError.isInstance(error)) return error.isRetryable;
  // undici wraps connection resets / DNS failures as "fetch failed"
  return error instanceof TypeError && /fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(error.message);
}

function retryAfterMs(error: unknown): number | null {
  if (!APICallError.isInstance(error)) return null;
  const header = error.responseHeaders?.["retry-after"];
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_BACKOFF_MS) : null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries transient provider failures (429, 5xx, network) with exponential backoff and jitter. */
export async function withAiRetry<T>(call: () => Promise<T>, attempts = MAX_ATTEMPTS): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const backoff = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      await sleep(retryAfterMs(error) ?? backoff + Math.random() * 500);
    }
  }
}

export function extractJsonObject(text: string): unknown {
  const withoutFence = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AiOutputError("AI 返回结果中没有 JSON 内容");
  }
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new AiOutputError("AI 返回结果不是有效的 JSON");
  }
}

function describeParseError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    return (error.issues as Array<{ path: unknown[]; message: string }>)
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(根)"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

function addUsage(total: TokenUsage, usage: { promptTokens?: number; completionTokens?: number } | undefined) {
  total.inputTokens += Number.isFinite(usage?.promptTokens) ? usage!.promptTokens! : 0;
  total.outputTokens += Number.isFinite(usage?.completionTokens) ? usage!.completionTokens! : 0;
}

export type StructuredRequest<T> = {
  model: LanguageModelV1;
  /** Text-only models (no JSON mode / tool calling) get the JSON template appended and are parsed manually. */
  textMode: boolean;
  instructions: string;
  /** Example of the expected JSON, shown to text-mode models and used in repair prompts. */
  jsonTemplate: string;
  image?: Buffer;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Validates/normalizes the raw object; throws on unusable output. Defaults to `schema.parse`. */
  parse?: (raw: unknown) => T;
  timeoutMs?: number;
  temperature?: number;
};

/**
 * Runs one structured AI call with timeout, transient-error retries, output validation and a single
 * automatic repair attempt when the model returns malformed JSON. Never returns fabricated fallbacks:
 * unusable output raises `AiOutputError`.
 */
export async function generateStructured<T>(request: StructuredRequest<T>): Promise<{ value: T; usage: TokenUsage }> {
  const parse = request.parse ?? ((raw: unknown) => request.schema.parse(raw));
  const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const common = {
    model: request.model,
    maxTokens: env.AI_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    temperature: request.temperature ?? 0.2,
  };

  const userContent = (text: string) =>
    request.image
      ? [{ type: "text" as const, text }, { type: "image" as const, image: request.image }]
      : [{ type: "text" as const, text }];

  if (!request.textMode) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withAiRetry(() =>
          generateObject({
            ...common,
            schema: request.schema,
            abortSignal: AbortSignal.timeout(timeoutMs),
            messages: [{ role: "user", content: userContent(request.instructions) }],
          }),
        );
        addUsage(usage, result.usage);
        return { value: parse(result.object), usage };
      } catch (error) {
        lastError = error;
        if (APICallError.isInstance(error) || (error instanceof Error && error.name === "TimeoutError")) throw error;
      }
    }
    throw new AiOutputError(`AI 返回的结果格式无效（已自动重试）：${describeParseError(lastError)}`);
  }

  const prompt = `${request.instructions}\n\n只返回 JSON，不要包含其他文字：\n${request.jsonTemplate}`;
  const first = await withAiRetry(() =>
    generateText({
      ...common,
      abortSignal: AbortSignal.timeout(timeoutMs),
      messages: [{ role: "user", content: userContent(prompt) }],
    }),
  );
  addUsage(usage, first.usage);

  let firstError: unknown;
  try {
    return { value: parse(extractJsonObject(first.text)), usage };
  } catch (error) {
    firstError = error;
  }

  const repair = await withAiRetry(() =>
    generateText({
      ...common,
      temperature: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
      prompt: `下面是你上一次的输出，它无法解析为要求的 JSON（问题：${describeParseError(firstError)}）。
请保留原有内容，只修正格式，严格按要求的结构返回 JSON，不要包含其他文字。

要求的结构：
${request.jsonTemplate}

上一次的输出：
${first.text.slice(0, 12_000)}`,
    }),
  );
  addUsage(usage, repair.usage);

  try {
    return { value: parse(extractJsonObject(repair.text)), usage };
  } catch (error) {
    throw new AiOutputError(`AI 返回的结果格式无效（已自动修复重试）：${describeParseError(error)}`);
  }
}
