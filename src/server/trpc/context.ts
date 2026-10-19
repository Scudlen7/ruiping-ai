import { readCookie, SESSION_COOKIE } from "~/server/auth/session";

export type TRPCContext = {
  /** Raw session token from the httpOnly cookie; verified lazily by `authedProcedure`. */
  sessionToken: string | null;
  clientIp: string;
  /** Response headers of the current request, used to set or clear the session cookie. */
  resHeaders: Headers;
};

export function createContext(options: { req: Request; resHeaders: Headers; clientIp: string }): TRPCContext {
  return {
    sessionToken: readCookie(options.req.headers.get("cookie"), SESSION_COOKIE),
    clientIp: options.clientIp,
    resHeaders: options.resHeaders,
  };
}
