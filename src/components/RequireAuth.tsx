import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/authStore";

type Role = "teacher" | "parent";

const HOME_BY_ROLE = {
  teacher: "/dashboard",
  parent: "/parent-dashboard",
} as const;

const SESSION_STALE_MS = 5 * 60 * 1000;

/**
 * Auth guard. The persisted store lets returning users see the page immediately, while `getSession`
 * confirms the httpOnly session cookie with the server; a missing or revoked session clears the store
 * and sends the user to the landing page. With `role`, users of the other role go to their own home.
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { isAuthenticated, userRole, setTeacherAuth, setParentAuth, clearAuth } = useAuthStore();

  const sessionQuery = useQuery({
    ...trpc.getSession.queryOptions(),
    staleTime: SESSION_STALE_MS,
    retry: false,
  });
  const session = sessionQuery.data;

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      clearAuth();
    } else if (session.role === "teacher") {
      setTeacherAuth(session.teacher);
    } else {
      setParentAuth(session.parent);
    }
  }, [session, clearAuth, setTeacherAuth, setParentAuth]);

  const sessionRole = session ? session.role : session === null ? null : userRole;
  const signedIn = session === undefined ? isAuthenticated : session !== null;
  const wrongRole = signedIn && !!role && sessionRole !== role;

  useEffect(() => {
    if (session === null || (session === undefined && !isAuthenticated && !sessionQuery.isFetching)) {
      void navigate({ to: "/" });
    } else if (wrongRole && sessionRole) {
      void navigate({ to: HOME_BY_ROLE[sessionRole], replace: true });
    }
  }, [session, isAuthenticated, sessionQuery.isFetching, wrongRole, sessionRole, navigate]);

  if (!signedIn || wrongRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600 text-lg">加载中...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
