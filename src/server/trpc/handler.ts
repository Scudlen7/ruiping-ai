import { defineEventHandler, getRequestIP, toWebRequest } from "@tanstack/react-start/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { env } from "~/server/env";
import { CLIENT_HEADER } from "~/server/auth/session";
import { startGradingWorker } from "~/server/services/grading";
import { createContext } from "./context";
import { appRouter } from "./root";

startGradingWorker();

export default defineEventHandler((event) => {
  const request = toWebRequest(event);
  if (!request) {
    console.error("No request received in tRPC handler");
    return new Response("No request", { status: 400 });
  }

  if (request.headers.get(CLIENT_HEADER) !== "1") {
    return Response.json(
      { error: { message: "请求来源无效", code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  const clientIp = getRequestIP(event, { xForwardedFor: env.TRUST_PROXY }) ?? "unknown";

  return fetchRequestHandler({
    endpoint: "/trpc",
    req: request,
    router: appRouter,
    createContext: ({ req, resHeaders }) => createContext({ req, resHeaders, clientIp }),
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[tRPC ERROR] ${path}:`, error.cause ?? error);
      } else if (env.NODE_ENV === "development") {
        console.warn(`[tRPC] ${path}: ${error.code} ${error.message}`);
      }
    },
  });
});
