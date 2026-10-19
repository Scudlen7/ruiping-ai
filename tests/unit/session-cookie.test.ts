import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  readCookie,
  sessionCookie,
  signSessionToken,
} from "~/server/auth/session";

describe("session cookie helpers", () => {
  it("reads a cookie among others and decodes it", () => {
    expect(readCookie("a=1; edureview_session=abc%2Edef; b=2", SESSION_COOKIE)).toBe("abc.def");
    expect(readCookie("a=1", SESSION_COOKIE)).toBeNull();
    expect(readCookie(null, SESSION_COOKIE)).toBeNull();
  });

  it("issues an HttpOnly, SameSite=Lax cookie valid for 7 days", () => {
    const cookie = sessionCookie("token");
    expect(cookie).toContain(`${SESSION_COOKIE}=token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(SESSION_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("clears the cookie with Max-Age=0", () => {
    expect(clearedSessionCookie()).toContain("Max-Age=0");
  });

  it("embeds the identity and token version in the JWT", () => {
    const claims = jwt.decode(signSessionToken({ teacherId: 7 }, 3)) as Record<string, unknown>;
    expect(claims).toMatchObject({ teacherId: 7, tv: 3 });
  });
});
