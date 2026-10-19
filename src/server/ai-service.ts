import { createOpenAI } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "./env";
import { normalizeScore } from "~/lib/grading";
import { generateStructured } from "./ai/structured";
import type { TokenUsage } from "./ai/usage";

const siliconcloud = createOpenAI({
  apiKey: env.SILICONCLOUD_API_KEY ?? "",
  baseURL: "https://api.siliconflow.cn/v1",
});

const alibabaBailian = createOpenAI({
  apiKey: env.ALIBABA_BAILIAN_API_KEY ?? "",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "" });

type ModelConfig = {
  provider: typeof siliconcloud;
  model: string;
  name: string;
  /** False when the provider's API key is missing; such models are hidden and never called. */
  configured: boolean;
  /** Model lacks JSON mode / tool calling: prompt with a JSON template and parse the text. */
  textMode: boolean;
  isDefault?: boolean;
};

export const AI_MODELS = {
  "siliconcloud/Qwen/Qwen3.6-35B-A3B": {
    provider: siliconcloud,
    model: "Qwen/Qwen3.6-35B-A3B",
    name: "Qwen3.6-35B-A3B（硅基流动）- 经济",
    configured: Boolean(env.SILICONCLOUD_API_KEY),
    textMode: true,
    isDefault: true,
  },
  "alibaba-bailian/qwen-vl-max": {
    provider: alibabaBailian,
    model: "qwen-vl-max-latest",
    name: "Qwen VL Max（阿里云百炼）- 高精度",
    configured: Boolean(env.ALIBABA_BAILIAN_API_KEY),
    textMode: false,
  },
  "openai/gpt-4o": {
    provider: openai,
    model: "gpt-4o",
    name: "GPT-4o（OpenAI）",
    configured: Boolean(env.OPENAI_API_KEY),
    textMode: false,
  },
} satisfies Record<string, ModelConfig>;

export type AIModelKey = keyof typeof AI_MODELS;

function modelConfig(key: AIModelKey): ModelConfig {
  return AI_MODELS[key];
}

export function getAvailableVisionModels() {
  const defaultKey = getDefaultVisionModel();
  return (Object.keys(AI_MODELS) as AIModelKey[])
    .filter((key) => modelConfig(key).configured)
    .map((key) => ({ key, name: modelConfig(key).name, isDefault: key === defaultKey }));
}

export function getDefaultVisionModel(): AIModelKey {
  const keys = Object.keys(AI_MODELS) as AIModelKey[];
  const configured = keys.filter((key) => modelConfig(key).configured);
  const preferred = configured.find((key) => modelConfig(key).isDefault) ?? configured[0];
  if (!preferred) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "未配置任何 AI 服务密钥，无法使用 AI 功能" });
  }
  return preferred;
}

/** Requested model if it exists and is configured, otherwise the default model. */
export function resolveModelKey(modelKey?: string | null): AIModelKey {
  if (modelKey && modelKey in AI_MODELS && modelConfig(modelKey as AIModelKey).configured) {
    return modelKey as AIModelKey;
  }
  return getDefaultVisionModel();
}

function structuredTarget(modelKey: AIModelKey) {
  const config = modelConfig(modelKey);
  return { model: config.provider(config.model), textMode: config.textMode };
}

export type AiResult<T> = { value: T; usage: TokenUsage };

// ─── Student / class recognition ───────────────────────────────────────

export const recognitionSchema = z.object({
  studentName: z.string().describe("在作业中找到的学生姓名，如果未找到则返回空字符串"),
  className: z.string().describe("在作业中找到的班级名称或标识符，如果未找到则返回空字符串"),
  confidence: z.coerce.number().min(0).max(1).describe("识别的置信度（0-1）"),
  reasoning: z.string().describe("简要说明使用了哪些文本/元素来识别学生姓名和班级"),
});

export type StudentRecognition = z.infer<typeof recognitionSchema>;

export async function recognizeStudentInfo(imageBuffer: Buffer, modelKey: AIModelKey): Promise<AiResult<StudentRecognition>> {
  return generateStructured({
    ...structuredTarget(modelKey),
    image: imageBuffer,
    schema: recognitionSchema,
    timeoutMs: 60_000,
    instructions: `请分析这份作业图片，识别学生姓名和班级信息。

重点关注：
- 页面右上角或左上角的姓名
- 标题部分的学生信息、姓名栏或签名区域
- 班级标识（如"7年级2班"、"Class 7-2"等）

如果无法找到清晰信息，请返回空字符串并设置较低的置信度。`,
    jsonTemplate: `{
  "studentName": "学生姓名，找不到则为空字符串",
  "className": "班级信息，找不到则为空字符串",
  "confidence": 0.8,
  "reasoning": "识别过程的简要说明"
}`,
  });
}

// ─── Assignment / exam grading ─────────────────────────────────────────

export const analysisSchema = z.object({
  score: z.number().min(0).max(100).nullable().describe("换算为百分制的得分（0-100）。卷面有分数时按卷面换算，否则根据答题正确情况估算"),
  grade: z.string().nullable().describe("卷面上原样可见的成绩标注（如 '92'、'18/20'、'A'、'优'），没有则为 null"),
  feedback: z.string().describe("总体反馈"),
  strengths: z.array(z.string()).describe("学生表现良好的方面"),
  improvements: z.array(z.string()).describe("需要改进的方面"),
  knowledgeAreas: z.array(z.string()).describe("本次作业/试卷考查到的全部知识点（包括做对的），使用简短中文名称"),
  mistakes: z.array(z.object({
    description: z.string().describe("错误的描述"),
    knowledgeArea: z.string().describe("此错误对应的知识点，与 knowledgeAreas 中的名称保持一致"),
    originalQuestionText: z.string().nullable().describe("出错题目的原文，看不清则为 null"),
    studentAnswer: z.string().nullable().describe("学生的作答，看不清则为 null"),
    correctAnswer: z.string().nullable().describe("正确答案，无法确定则为 null"),
  })).describe("识别出的具体错误"),
});

export type SubmissionAnalysis = {
  score: number | null;
  grade: string | null;
  feedback: string;
  strengths: string[];
  improvements: string[];
  knowledgeAreas: string[];
  mistakes: Array<{
    description: string;
    knowledgeArea: string;
    originalQuestionText: string | null;
    studentAnswer: string | null;
    correctAnswer: string | null;
  }>;
};

export type SubmissionKind = "assignment" | "exam";

const UNCATEGORIZED_KNOWLEDGE_AREA = "未分类";

function optionalText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
}

function textList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map(optionalText).filter((item): item is string => item !== null);
}

/**
 * Validates and normalizes whatever the model returned. Throws when the
 * response carries no usable grading information, so the submission is
 * marked as failed instead of persisting fabricated data.
 */
export function normalizeAnalysisResult(raw: unknown): SubmissionAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI 返回结果格式不正确");
  }
  const data = raw as Record<string, unknown>;

  const grade = optionalText(data.grade);
  const score = normalizeScore(data.score) ?? normalizeScore(grade);

  const mistakes = (Array.isArray(data.mistakes) ? data.mistakes : [])
    .map((item): SubmissionAnalysis["mistakes"][number] | null => {
      if (typeof item === "string") {
        const description = optionalText(item);
        return description
          ? { description, knowledgeArea: UNCATEGORIZED_KNOWLEDGE_AREA, originalQuestionText: null, studentAnswer: null, correctAnswer: null }
          : null;
      }
      if (!item || typeof item !== "object") return null;
      const m = item as Record<string, unknown>;
      const description = optionalText(m.description);
      if (!description) return null;
      return {
        description,
        knowledgeArea: optionalText(m.knowledgeArea) ?? UNCATEGORIZED_KNOWLEDGE_AREA,
        originalQuestionText: optionalText(m.originalQuestionText),
        studentAnswer: optionalText(m.studentAnswer),
        correctAnswer: optionalText(m.correctAnswer),
      };
    })
    .filter((m): m is SubmissionAnalysis["mistakes"][number] => m !== null);

  const feedback = optionalText(data.feedback) ?? "";
  if (!feedback && score === null && mistakes.length === 0) {
    throw new Error("AI 未返回有效的批改内容");
  }

  return {
    score,
    grade,
    feedback: feedback || "已完成批改。",
    strengths: textList(data.strengths),
    improvements: textList(data.improvements),
    knowledgeAreas: textList(data.knowledgeAreas),
    mistakes,
  };
}

const MAX_KNOWN_AREAS_IN_PROMPT = 60;

export function buildAnalysisInstructions(kind: SubmissionKind, knownAreas: readonly string[] = []) {
  const label = kind === "exam" ? "试卷" : "作业";
  const areaHint = knownAreas.length
    ? `\n6. 本班已有的知识点名称如下。意思相同或相近时必须原样使用这些名称，只有确实没有合适的才新建：\n${knownAreas
        .slice(0, MAX_KNOWN_AREAS_IN_PROMPT)
        .map((name) => `「${name}」`)
        .join("、")}`
    : "";
  return `你是一名经验丰富的中小学教师，请批改这份学生${label}图片。

批改要求：
1. score：换算为百分制（0-100）的数字。卷面有分数时按卷面换算（例如 18/20 记为 90）；没有分数时根据各题对错估算。完全无法判断时为 null。
2. grade：卷面上原样可见的成绩标注，没有则为 null。
3. knowledgeAreas：列出本${label}考查到的全部知识点（包括做对的），使用简短的中文名称，如"分数加减法""一元一次方程"。
4. mistakes：逐条列出错误，knowledgeArea 必须与 knowledgeAreas 中的名称一致；尽量给出题目原文、学生作答和正确答案。
5. feedback / strengths / improvements：给出具体、建设性的评价，帮助学生改进。${areaHint}`;
}

const ANALYSIS_JSON_TEMPLATE = `{
  "score": 85,
  "grade": "卷面成绩标注或 null",
  "feedback": "总体反馈",
  "strengths": ["表现良好的方面"],
  "improvements": ["需要改进的方面"],
  "knowledgeAreas": ["知识点1", "知识点2"],
  "mistakes": [
    {
      "description": "错误描述",
      "knowledgeArea": "知识点1",
      "originalQuestionText": "题目原文或 null",
      "studentAnswer": "学生作答或 null",
      "correctAnswer": "正确答案或 null"
    }
  ]
}`;

export async function analyzeSubmissionImage(
  imageBuffer: Buffer,
  modelKey: AIModelKey,
  kind: SubmissionKind = "assignment",
  knownAreas: readonly string[] = [],
): Promise<AiResult<SubmissionAnalysis>> {
  return generateStructured({
    ...structuredTarget(modelKey),
    image: imageBuffer,
    schema: analysisSchema,
    parse: normalizeAnalysisResult,
    instructions: buildAnalysisInstructions(kind, knownAreas),
    jsonTemplate: ANALYSIS_JSON_TEMPLATE,
  });
}

// ─── Targeted practice questions ───────────────────────────────────────

const difficultySchema = z
  .string()
  .transform((value) => (["easy", "medium", "hard"].includes(value) ? value : "medium") as "easy" | "medium" | "hard");

export const targetedQuestionsSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(1).describe("题目内容"),
    options: z.array(z.string()).optional().describe("选择题选项（如有）"),
    correctAnswer: z.string().describe("正确答案"),
    explanation: z.string().describe("解题思路与知识点解释"),
    knowledgeArea: z.string().describe("针对的知识点"),
    difficulty: difficultySchema.describe("easy / medium / hard"),
    mistakeType: z.string().describe("针对的错误类型"),
  })).min(1).describe("练习题列表"),
  summary: z.string().describe("本次练习题的总体说明"),
});

export type TargetedQuestions = z.infer<typeof targetedQuestionsSchema>;

interface QuestionGenerationInput {
  mistakes: Array<{
    description: string;
    originalQuestionText?: string | null;
    studentAnswer?: string | null;
    correctAnswer?: string | null;
    knowledgeArea?: { name: string } | null;
  }>;
  teachingMaterials: Array<{
    title: string;
    description?: string | null;
    textContent?: string | null;
    knowledgeArea?: { name: string } | null;
  }>;
  studentName: string;
  questionCount: number;
  difficultyLevel: "easy" | "medium" | "hard";
  modelKey: AIModelKey;
}

export async function generateTargetedQuestions(input: QuestionGenerationInput): Promise<AiResult<TargetedQuestions>> {
  const knowledgeBaseContext = input.teachingMaterials
    .map((material) => {
      const content = material.textContent || `${material.title}${material.description ? ` - ${material.description}` : ""}`;
      return `[${material.knowledgeArea?.name || "未分类"}] ${material.title}: ${content}`;
    })
    .join("\n\n");

  const mistakeAnalysis = input.mistakes
    .map((mistake) =>
      [
        `错误类型: ${mistake.description}`,
        `知识领域: ${mistake.knowledgeArea?.name || "未分类"}`,
        mistake.originalQuestionText ? `原题: ${mistake.originalQuestionText}` : "",
        mistake.studentAnswer ? `学生答案: ${mistake.studentAnswer}` : "",
        mistake.correctAnswer ? `正确答案: ${mistake.correctAnswer}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return generateStructured({
    ...structuredTarget(input.modelKey),
    schema: targetedQuestionsSchema,
    temperature: 0.5,
    instructions: `请基于以下信息为"${input.studentName}"生成 ${input.questionCount} 道针对性练习题。

## 学生错误分析
${mistakeAnalysis}

## 教师知识库参考资料
${knowledgeBaseContext || "（无）"}

## 要求
- 难度等级：${input.difficultyLevel}
- 题目数量：${input.questionCount} 道
- 针对学生的具体错误模式设计，利用教师知识库内容作为权威参考
- 提供详细的解题思路和知识点解释`,
    jsonTemplate: `{
  "questions": [
    {
      "question": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correctAnswer": "正确答案",
      "explanation": "详细解释",
      "knowledgeArea": "知识领域",
      "difficulty": "easy / medium / hard",
      "mistakeType": "针对的错误类型"
    }
  ],
  "summary": "本次练习题的总体说明"
}`,
  });
}

// ─── Class roster recognition ──────────────────────────────────────────

export const rosterSchema = z.object({
  students: z.array(z.object({
    studentName: z.string(),
    studentId: z.union([z.string(), z.number()]).nullable().optional()
      .transform((value) => (value == null ? undefined : String(value).trim() || undefined)),
    confidence: z.coerce.number().min(0).max(1).catch(0.7),
    reasoning: z.string().catch("自动识别"),
  })),
  confidence: z.coerce.number().min(0).max(1).catch(0.7),
  reasoning: z.string().catch("批量学生信息识别完成"),
});

export type RosterRecognition = z.infer<typeof rosterSchema>;

export async function recognizeClassRoster(imageBuffer: Buffer, modelKey: AIModelKey): Promise<AiResult<RosterRecognition>> {
  return generateStructured({
    ...structuredTarget(modelKey),
    image: imageBuffer,
    schema: rosterSchema,
    temperature: 0.1,
    timeoutMs: 90_000,
    instructions: `你是一个专业的学生名单识别助手，请仔细分析图片中的学生信息，精确识别学生姓名和学号。

识别要求：
1. 识别每个学生的完整姓名（通常 2-4 个中文字符），姓名不要重复
2. 识别学号（数字组合，如 001、2023001）；没有明确学号时 studentId 为 null，不要猜测或编造
3. 置信度基于文字清晰度和识别准确性
4. 过滤掉与学生名单无关的文字

常见格式：座位表、花名册（序号 姓名 学号）、考试签到表、作业名单。`,
    jsonTemplate: `{
  "students": [
    {"studentName": "张三", "studentId": "001", "confidence": 0.95, "reasoning": "清晰识别姓名和学号"}
  ],
  "confidence": 0.9,
  "reasoning": "整体识别情况说明"
}`,
  });
}

// ─── Class progress insight ────────────────────────────────────────────

export const classProgressSchema = z.object({
  progressPercentage: z.coerce.number().min(0).max(100).transform(Math.round),
  keyInsights: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  strengthAreas: z.array(z.string()),
  improvementAreas: z.array(z.string()),
  summary: z.string(),
});

export type ClassProgressInsight = z.infer<typeof classProgressSchema>;

export async function analyzeClassProgressData(instructions: string, modelKey: AIModelKey): Promise<AiResult<ClassProgressInsight>> {
  return generateStructured({
    ...structuredTarget(modelKey),
    schema: classProgressSchema,
    timeoutMs: 60_000,
    instructions,
    jsonTemplate: `{
  "progressPercentage": 75,
  "keyInsights": ["关键洞察1", "关键洞察2", "关键洞察3"],
  "recommendedActions": ["建议行动1", "建议行动2", "建议行动3"],
  "strengthAreas": ["优势领域1", "优势领域2"],
  "improvementAreas": ["需改进领域1", "需改进领域2"],
  "summary": "一句话总结班级进度状况"
}`,
  });
}
