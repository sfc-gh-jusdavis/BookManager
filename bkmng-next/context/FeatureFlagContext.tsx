"use client";

import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { FEATURE_FLAGS, type FlagKey } from "@/lib/flags";

type FlagsMap = Record<string, boolean>;

interface FeatureFlagContextValue {
  flags: FlagsMap;
  isLoading: boolean;
  isEnabled: (key: FlagKey) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

async function fetchMyFlags(mockUserId: string | undefined): Promise<FlagsMap> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mockUserId) headers["X-Mock-User"] = mockUserId;
  const res = await fetch("/api/feature-flags/me", { headers });
  if (!res.ok) return {};
  const data = (await res.json()) as { flags: FlagsMap };
  return data.flags || {};
}

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.user_id;

  const { data, isLoading } = useQuery({
    queryKey: ["feature-flags", userId],
    queryFn: () => fetchMyFlags(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const flags = data || {};
  const isEnabled = (key: FlagKey) => {
    if (process.env.NODE_ENV !== "production" && !(key in FEATURE_FLAGS)) {
      console.error(`useFeatureFlag: unregistered key "${key}". Add it to bkmng-next/lib/flags.ts`);
    }
    if (key in flags) return Boolean(flags[key]);
    // Fallback to registry default if API hasn't responded yet
    return FEATURE_FLAGS[key]?.default_enabled ?? false;
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, isLoading, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error("useFeatureFlags must be used inside <FeatureFlagProvider>");
  return ctx;
}

export function useFeatureFlag(key: FlagKey): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(key);
}
