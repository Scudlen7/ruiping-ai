import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { buildTestEnv } from "./tests/test-env";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    env: buildTestEnv(),
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          // All files share one database, so they must run one after another.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
