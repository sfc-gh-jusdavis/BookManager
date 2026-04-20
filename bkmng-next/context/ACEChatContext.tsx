"use client";

import { createContext, useContext, useState } from "react";
import type { NBAContext } from "@/components/dashboard/ACEChat";

type ACEChatConfig = {
  nbaContext?: NBAContext | null;
  accountId?: string | null;
};

type ACEChatContextType = {
  config: ACEChatConfig;
  setConfig: (c: ACEChatConfig) => void;
  clearConfig: () => void;
};

const ACEChatContext = createContext<ACEChatContextType>({
  config: {},
  setConfig: () => {},
  clearConfig: () => {},
});

export function ACEChatProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ACEChatConfig>({});

  const setConfig = (c: ACEChatConfig) => setConfigState(c);
  const clearConfig = () => setConfigState({});

  return (
    <ACEChatContext.Provider value={{ config, setConfig, clearConfig }}>
      {children}
    </ACEChatContext.Provider>
  );
}

export function useACEChatConfig() {
  return useContext(ACEChatContext);
}
