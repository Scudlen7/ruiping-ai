import { z } from "zod";
import "dotenv/config";

const PLACEHOLDER_PATTERN = /your-|placeholder|change-me|^sk-$|^xxx/i;

/** Empty strings and template placeholders count as "not configured". */
const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() && !PLACEHOLDER_PATTERN.test(value) ? value.trim() : undefined),
  z.string().optional(),
);

function blankAsUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (typeof value === "string" && !value.trim() ? undefined : value), schema);
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    BASE_URL: z.string().optional(),
    BASE_URL_OTHER_PORT: z.string().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL 未配置"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET 至少需要 16 个字符"),

    SILICONCLOUD_API_KEY: optionalSecret,
    ALIBABA_BAILIAN_API_KEY: optionalSecret,
    OPENAI_API_KEY: optionalSecret,
    AI_DAILY_LIMIT_PER_USER: blankAsUndefined(z.coerce.number().int().positive().default(200)),
    AI_MAX_OUTPUT_TOKENS: blankAsUndefined(z.coerce.number().int().min(256).default(4096)),

    OSS_ACCESS_KEY_ID: optionalSecret,
    OSS_ACCESS_KEY_SECRET: optionalSecret,
    OSS_ENDPOINT: optionalSecret,
    OSS_BUCKET: optionalSecret,
    OSS_REGION: optionalSecret,

    PDF_BROWSER_PATH: optionalSecret,
    TRUST_PROXY: z.preprocess((value) => value === "true" || value === "1", z.boolean()),
    ALLOW_REGISTRATION: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.SILICONCLOUD_API_KEY && !value.ALIBABA_BAILIAN_API_KEY && !value.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SILICONCLOUD_API_KEY"],
        message: "至少需要配置一个 AI 服务密钥：SILICONCLOUD_API_KEY / ALIBABA_BAILIAN_API_KEY / OPENAI_API_KEY",
      });
    }
    if (value.NODE_ENV === "production" && PLACEHOLDER_PATTERN.test(value.JWT_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "生产环境必须把 JWT_SECRET 换成随机长字符串",
      });
    }
  });

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`环境变量配置错误：\n${lines.join("\n")}`);
  }
  return result.data;
}

export const env = parseEnv();

export function isOssConfigured(): boolean {
  return Boolean(
    env.OSS_ACCESS_KEY_ID && env.OSS_ACCESS_KEY_SECRET && env.OSS_ENDPOINT && env.OSS_BUCKET && env.OSS_REGION,
  );
}
