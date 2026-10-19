import { describe, expect, it } from "vitest";
import { startOfQuotaDay } from "~/server/ai/usage";

describe("startOfQuotaDay", () => {
  it("resets at midnight China time (UTC+8)", () => {
    expect(startOfQuotaDay(new Date("2026-10-04T15:59:59Z")).toISOString()).toBe("2026-10-03T16:00:00.000Z");
    expect(startOfQuotaDay(new Date("2026-10-04T16:00:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
  });
});
