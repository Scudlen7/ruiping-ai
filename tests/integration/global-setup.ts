import { execSync } from "node:child_process";
import { assertTestDatabase, testDatabaseUrl } from "../test-env";

/** Creates (if needed) and migrates the teachai_test database once per test run. */
export default function setup() {
  const databaseUrl = testDatabaseUrl();
  assertTestDatabase(databaseUrl);
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
