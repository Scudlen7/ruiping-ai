import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Display-only copy of the signed-in account. The credential itself is an httpOnly session cookie that
 * JavaScript cannot read; `RequireAuth` re-validates this state against the server (`getSession`).
 */

type Teacher = {
  id: number;
  phoneNumber: string;
  name: string;
};

type Parent = {
  id: number;
  phoneNumber: string;
  name: string;
  children?: {
    id: number;
    name: string;
    schoolName: string;
    grade: string;
    className: string;
  }[];
};

type UserRole = "teacher" | "parent";

type AuthStore = {
  userRole: UserRole | null;
  teacher: Teacher | null;
  parent: Parent | null;
  isAuthenticated: boolean;
  setTeacherAuth: (teacher: Teacher) => void;
  setParentAuth: (parent: Parent) => void;
  /** Clears local state only; use `useLogout` to also end the server session. */
  clearAuth: () => void;
};

const signedOut = { userRole: null, teacher: null, parent: null, isAuthenticated: false } as const;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...signedOut,
      setTeacherAuth: (teacher) => set({ userRole: "teacher", teacher, parent: null, isAuthenticated: true }),
      setParentAuth: (parent) => set({ userRole: "parent", parent, teacher: null, isAuthenticated: true }),
      clearAuth: () => set(signedOut),
    }),
    {
      name: "auth-storage",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ userRole, teacher, parent, isAuthenticated }) => ({ userRole, teacher, parent, isAuthenticated }),
      // v1 kept the bearer token in localStorage; drop it and require a cookie-based login.
      migrate: () => ({ ...signedOut }),
    },
  ),
);
