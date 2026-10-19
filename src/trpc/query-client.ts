import {
  defaultShouldDehydrateQuery,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import SuperJSON from "superjson";
import { useAuthStore } from "~/stores/authStore";

function isUnauthorized(error: unknown): boolean {
  return error instanceof TRPCClientError && (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED";
}

const createQueryClient = (): QueryClient => {
  const client: QueryClient = new QueryClient({
    // A query rejected as UNAUTHORIZED means the session cookie expired or was revoked. Re-checking the
    // session lets RequireAuth clear the store and send the user back to the landing page.
    queryCache: new QueryCache({
      onError: (error) => {
        if (isUnauthorized(error) && typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          void client.invalidateQueries({ queryKey: [["getSession"]] });
        }
      },
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 3,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
  return client;
};

let clientQueryClientSingleton: QueryClient | undefined = undefined;

export const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  return (clientQueryClientSingleton ??= createQueryClient());
};
