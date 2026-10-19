import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";

type TeacherProfile = { id: number; phoneNumber: string; name: string };
type ParentProfile = {
  id: number;
  phoneNumber: string;
  name: string;
  children: { id: number; name: string; schoolName: string; grade: string; className: string }[];
};

/**
 * Records a successful login: updates the display store and primes the cached `getSession` answer,
 * so a stale "signed out" result cannot bounce the user back to the landing page.
 */
export function useSignIn() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setTeacherAuth = useAuthStore((s) => s.setTeacherAuth);
  const setParentAuth = useAuthStore((s) => s.setParentAuth);

  const teacher = useCallback(
    (profile: TeacherProfile) => {
      setTeacherAuth(profile);
      queryClient.setQueryData(trpc.getSession.queryKey(), { role: "teacher" as const, teacher: profile });
    },
    [trpc, queryClient, setTeacherAuth],
  );

  const parent = useCallback(
    (profile: ParentProfile) => {
      setParentAuth(profile);
      queryClient.setQueryData(trpc.getSession.queryKey(), { role: "parent" as const, parent: profile });
    },
    [trpc, queryClient, setParentAuth],
  );

  return { teacher, parent };
}
