import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db";
import { browserSession, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const attemptLogin = (ip: string, phoneNumber: string) =>
  browserSession(ip).run((api) => api.loginTeacher({ phoneNumber, password: "Wrong1234" }));

describe("persistent rate limiting", () => {
  it("blocks a phone number after 5 attempts per minute, even from different IPs", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(attemptLogin(`198.51.100.${i}`, "13800000009")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(attemptLogin("198.51.100.99", "13800000009")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("blocks a single IP that sprays many phone numbers", async () => {
    for (let i = 0; i < 20; i++) {
      await expect(attemptLogin("198.51.100.200", `1380000${String(i).padStart(4, "0")}`)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    await expect(attemptLogin("198.51.100.200", "13811112222")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(attemptLogin("198.51.100.201", "13811112222")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("stores counters in PostgreSQL so they survive a restart", async () => {
    await expect(attemptLogin("198.51.100.7", "13800000010")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const buckets = await db.rateLimitBucket.findMany({ orderBy: { key: "asc" } });
    expect(buckets.map((b) => b.key)).toEqual(["loginTeacher:ip:198.51.100.7", "loginTeacher:phone:13800000010"]);
  });

  it("starts a new window once the old one expires", async () => {
    await db.rateLimitBucket.create({
      data: { key: "loginTeacher:phone:13800000011", count: 99, resetAt: new Date(Date.now() - 1000) },
    });
    await expect(attemptLogin("198.51.100.8", "13800000011")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
