import { describe, expect, it, vi } from "vitest";
import { APICallError } from "ai";
import { MockLanguageModelV1 } from "ai/test";
import { z } from "zod";
import { AiOutputError, extractJsonObject, generateStructured, withAiRetry } from "~/server/ai/structured";
import { normalizeAnalysisResult } from "~/server/ai-service";

type GenerateResult = Awaited<ReturnType<MockLanguageModelV1["doGenerate"]>>;

const textResult = (text: string, promptTokens = 10, completionTokens = 20): GenerateResult => ({
  rawCall: { rawPrompt: null, rawSettings: {} },
  finishReason: "stop",
  usage: { promptTokens, completionTokens },
  text,
});

/** A text-only mock model that returns the given responses (or throws errors) in order. */
function scriptedModel(responses: Array<string | Error>) {
  const prompts: string[] = [];
  let call = 0;
  const model = new MockLanguageModelV1({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      const next = responses[Math.min(call++, responses.length - 1)]!;
      if (next instanceof Error) throw next;
      return textResult(next);
    },
  });
  return { model, prompts, calls: () => call };
}

const schema = z.object({ name: z.string(), score: z.number() });
const request = { textMode: true, instructions: "请返回结果", jsonTemplate: '{"name": "", "score": 0}', schema };

function apiError(statusCode: number, headers: Record<string, string> = {}) {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseHeaders: headers,
  });
}

describe("extractJsonObject", () => {
  it("strips reasoning blocks and code fences", () => {
    const text = '<think>{"ignored": true}</think>\n```json\n{"name": "张三", "score": 90}\n```';
    expect(extractJsonObject(text)).toEqual({ name: "张三", score: 90 });
  });

  it("throws AiOutputError when there is no JSON", () => {
    expect(() => extractJsonObject("抱歉，我无法识别")).toThrow(AiOutputError);
  });
});

describe("generateStructured (text mode)", () => {
  it("parses a valid response and reports token usage", async () => {
    const { model, prompts } = scriptedModel(['结果如下：{"name": "张三", "score": 90}']);
    const result = await generateStructured({ ...request, model });
    expect(result.value).toEqual({ name: "张三", score: 90 });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(prompts[0]).toContain("只返回 JSON");
  });

  it("repairs malformed output with one extra call", async () => {
    const { model, calls } = scriptedModel(['{"name": "张三", "score": "很高"}', '{"name": "张三", "score": 88}']);
    const result = await generateStructured({ ...request, model });
    expect(result.value).toEqual({ name: "张三", score: 88 });
    expect(calls()).toBe(2);
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 40 });
  });

  it("gives up with AiOutputError instead of inventing data", async () => {
    const { model, calls } = scriptedModel(["不是 JSON", "还是不是 JSON"]);
    await expect(generateStructured({ ...request, model })).rejects.toBeInstanceOf(AiOutputError);
    expect(calls()).toBe(2);
  });

  it("applies a custom parser", async () => {
    const { model } = scriptedModel(['{"score": "18/20", "feedback": "不错", "mistakes": ["计算错误"]}']);
    const result = await generateStructured({
      ...request,
      model,
      schema: z.any(),
      parse: normalizeAnalysisResult,
    });
    expect(result.value.score).toBe(90);
    expect(result.value.mistakes[0]).toMatchObject({ description: "计算错误", knowledgeArea: "未分类" });
  });
});

describe("withAiRetry", () => {
  it("retries rate-limited calls honoring retry-after", async () => {
    vi.useFakeTimers();
    try {
      const call = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(apiError(429, { "retry-after": "1" }))
        .mockResolvedValueOnce("ok");
      const promise = withAiRetry(call);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toBe("ok");
      expect(call).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry client errors", async () => {
    const call = vi.fn<() => Promise<string>>().mockRejectedValue(apiError(400));
    await expect(withAiRetry(call)).rejects.toBeInstanceOf(APICallError);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("stops after three attempts", async () => {
    vi.useFakeTimers();
    try {
      const call = vi.fn<() => Promise<string>>().mockRejectedValue(apiError(503));
      const promise = withAiRetry(call);
      const assertion = expect(promise).rejects.toBeInstanceOf(APICallError);
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
      expect(call).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("normalizeAnalysisResult", () => {
  it("rejects responses without any grading content", () => {
    expect(() => normalizeAnalysisResult({ feedback: "", mistakes: [] })).toThrow("AI 未返回有效的批改内容");
  });

  it("derives the score from the visible grade", () => {
    const result = normalizeAnalysisResult({ score: null, grade: "优", feedback: "很好" });
    expect(result.score).toBe(95);
    expect(result.grade).toBe("优");
  });
});
