import jwt from "jsonwebtoken";
import { db } from "~/server/db";
import { env } from "~/server/env";

export const SESSION_COOKIE = "edureview_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Header the web client sends on every request. Browsers only attach custom headers to cross-origin requests
 * after a CORS preflight, which this server never approves, so requiring it on mutations blocks CSRF.
 */
export const CLIENT_HEADER = "x-edureview-client";

export type SessionIdentity = { teacherId: number } | { parentId: number };
export type AuthPayload = { teacherId?: number; parentId?: number };

type TokenClaims = AuthPayload & { tv?: number };

export function signSessionToken(identity: SessionIdentity, tokenVersion: number): string {
  return jwt.sign({ ...identity, tv: tokenVersion }, env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

function cookieAttributes(maxAgeSeconds: number): string {
  const attributes = [`Path=/`, `Max-Age=${maxAgeSeconds}`, "HttpOnly", "SameSite=Lax"];
  if (env.NODE_ENV === "production") attributes.push("Secure");
  return attributes.join("; ");
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(SESSION_TTL_SECONDS)}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(0)}`;
}

/**
 * Verifies the session token and checks it against the account's current token version, so tokens issued
 * before a logout stop working immediately. Returns null for any invalid, expired or revoked token.
 */
export async function resolveSession(token: string | null | undefined): Promise<AuthPayload | null> {
  if (!token) return null;

  let claims: TokenClaims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET) as TokenClaims;
  } catch {
    return null;
  }
  if (typeof claims.tv !== "number") return null;

  if (typeof claims.teacherId === "number") {
    const teacher = await db.teacher.findUnique({ where: { id: claims.teacherId }, select: { tokenVersion: true } });
    return teacher?.tokenVersion === claims.tv ? { teacherId: claims.teacherId } : null;
  }
  if (typeof claims.parentId === "number") {
    const parent = await db.parent.findUnique({ where: { id: claims.parentId }, select: { tokenVersion: true } });
    return parent?.tokenVersion === claims.tv ? { parentId: claims.parentId } : null;
  }
  return null;
}

/** Invalidates every outstanding session of the account. */
export async function revokeSessions(auth: AuthPayload): Promise<void> {
  if (auth.teacherId != null) {
    await db.teacher.update({ where: { id: auth.teacherId }, data: { tokenVersion: { increment: 1 } } });
  } else if (auth.parentId != null) {
    await db.parent.update({ where: { id: auth.parentId }, data: { tokenVersion: { increment: 1 } } });
  }
}
