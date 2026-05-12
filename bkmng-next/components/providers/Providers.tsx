"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { FeatureFlagProvider } from "@/context/FeatureFlagContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureFlagProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
