"use client";

import { ReactNode } from "react";

export function HealthTile({
  children,
  isActive,
  onClick,
  accentClass = "border-slate-200",
}: {
  children: ReactNode;
  isActive: boolean;
  onClick: () => void;
  accentClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isActive}
      className={`w-full text-left rounded-2xl border p-5 shadow-sm bg-white transition-all hover:shadow-md cursor-pointer min-h-[240px] flex flex-col ${accentClass} ${
        isActive ? "ring-2 ring-sky-400 shadow-md" : ""
      }`}
    >
      {children}
    </button>
  );
}
