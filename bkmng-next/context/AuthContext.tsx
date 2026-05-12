"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { CurrentUser, AuthMode } from "@/types/auth";
import { queryClient } from "@/components/providers/Providers";

const MOCK_USER_KEY = "bkmng-mock-user-id";

interface AuthContextValue {
  currentUser: CurrentUser | null;
  isSpcs: boolean;
  isLoading: boolean;
  mockUsers: CurrentUser[];
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiFetch<T>(path: string, mockUserId?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (mockUserId) {
    headers["X-Mock-User"] = mockUserId;
  }
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isSpcs, setIsSpcs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mockUsers, setMockUsers] = useState<CurrentUser[]>([]);
  const [mockUserId, setMockUserId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(MOCK_USER_KEY) || "";
  });

  const loadUser = useCallback(
    async (uid: string) => {
      try {
        const mode = await apiFetch<AuthMode>("/api/auth/mode");
        const users = await apiFetch<CurrentUser[]>("/api/auth/mock-users").catch(() => []);
        setIsSpcs(mode.spcs_mode);
        setMockUsers(users);

        const resolvedUid = uid || users[0]?.user_id || "";
        if (!resolvedUid) {
          setCurrentUser(null);
          return;
        }
        if (resolvedUid !== uid) {
          localStorage.setItem(MOCK_USER_KEY, resolvedUid);
          setMockUserId(resolvedUid);
        }
        const user = await apiFetch<CurrentUser>("/api/auth/me", resolvedUid);
        setCurrentUser(user);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadUser(mockUserId);
  }, [mockUserId, loadUser]);

  const switchUser = useCallback((userId: string) => {
    localStorage.setItem(MOCK_USER_KEY, userId);
    queryClient.clear();
    setMockUserId(userId);
    setIsLoading(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ currentUser, isSpcs, isLoading, mockUsers, switchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
