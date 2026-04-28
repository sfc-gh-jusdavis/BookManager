"use client";

import { Sidebar } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";
import { ACEChatProvider, useACEChatConfig } from "@/context/ACEChatContext";
import { ACEChat } from "@/components/dashboard/ACEChat";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const { config } = useACEChatConfig();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 text-center text-xs text-blue-600">
          See any bugs or have any feedback?{" "}
          <a
            href="https://docs.google.com/spreadsheets/d/17i0BCpNojuFHsojLfFBEc4zdkAIatOUvoZKr3ikruX4/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:text-blue-800"
          >
            Report here.
          </a>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--snow-500)", borderTopColor: "transparent" }}
            />
          </div>
        ) : (
          children
        )}
      </main>
      <ACEChat nbaContext={config.nbaContext} accountId={config.accountId} />
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ACEChatProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ACEChatProvider>
  );
}
