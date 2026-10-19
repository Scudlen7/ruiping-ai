import { loadEnv } from "vite";

const TEST_DATABASE_NAME = "teachai_test";

/**
 * Integration tests use their own database: TEST_DATABASE_URL if set, otherwise
 * DATABASE_URL from .env with the database name replaced by `teachai_test`.
 */
export function testDatabaseUrl(): string {
  const fileEnv = loadEnv("test", process.cwd(), "");
  const explicit = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
  if (!base) {
    throw new Error("运行测试需要 DATABASE_URL 或 TEST_DATABASE_URL（用于推导 teachai_test 测试库地址）");
  }
  const url = new URL(base);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

/** Refuses to run destructive test setup against anything but a `*_test` database. */
export function assertTestDatabase(databaseUrl: string): void {
  const name = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`拒绝在非测试数据库上运行集成测试（数据库名必须以 _test 结尾，当前为 "${name}"）`);
  }
}

/** Environment for test workers: fake credentials only, real keys from .env are never used. */
export function buildTestEnv(): Record<string, string> {
  return {
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl(),
    JWT_SECRET: "vitest-only-jwt-secret-0123456789",
    SILICONCLOUD_API_KEY: "test-siliconcloud-key",
    ALIBABA_BAILIAN_API_KEY: "",
    OPENAI_API_KEY: "",
    OSS_ACCESS_KEY_ID: "test-access-key",
    OSS_ACCESS_KEY_SECRET: "test-access-secret",
    OSS_ENDPOINT: "oss-test.example.com",
    OSS_BUCKET: "edureview-test",
    OSS_REGION: "oss-test",
    AI_DAILY_LIMIT_PER_USER: "5",
    AI_MAX_OUTPUT_TOKENS: "1024",
    ALLOW_REGISTRATION: "false",
    TRUST_PROXY: "false",
    PDF_BROWSER_PATH: "",
  };
}
