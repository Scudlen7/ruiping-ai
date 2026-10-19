import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";

/** Ends the server session (revoking the cookie token), clears cached data and returns to the landing page. */
export function useLogout() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { mutateAsync } = useMutation(trpc.logout.mutationOptions());

  return useCallback(async () => {
    try {
      await mutateAsync();
    } catch {
      // The session may already be gone; signing out locally is still correct.
    }
    clearAuth();
    queryClient.clear();
    await navigate({ to: "/", replace: true });
  }, [mutateAsync, clearAuth, queryClient, navigate]);
}
