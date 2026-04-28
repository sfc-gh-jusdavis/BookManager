"use client";

import { Shield, ChevronRight } from "lucide-react";
import { HealthTile } from "./HealthTile";
import type { SecurityPostureData } from "@/hooks/useApi";

function RingChart({ score, applicable }: { score: number; applicable: number }) {
  const pct = applicable > 0 ? score / applicable : 0;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = pct * circ;
  const color = pct >= 0.8 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#f87171";

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx={36} cy={36} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle
        cx={36}
        cy={36}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold fill-slate-800" fontSize={13} fontWeight={700}>
        {applicable > 0 ? Math.round(pct * 100) : 0}%
      </text>
    </svg>
  );
}

export type SecuritySummary = {
  score: number;
  applicable: number;
  total: number;
  topFailures: string[];
};

export function deriveSecuritySummary(data: SecurityPostureData): SecuritySummary {
  const allMilestones = data.tiers.flatMap((t) => t.milestones);
  const applicable = allMilestones.filter((m) => m.status !== "not_applicable");
  const score = applicable.filter((m) => m.status === "complete").length;
  const failures = applicable
    .filter((m) => m.status !== "complete")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, informational: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    })
    .slice(0, 2)
    .map((m) => m.name);
  return { score, applicable: applicable.length, total: allMilestones.length, topFailures: failures };
}

export function SecurityTile({
  summary,
  isActive,
  onOpen,
}: {
  summary: SecuritySummary | null;
  isActive: boolean;
  onOpen: () => void;
}) {
  const pct = summary && summary.applicable > 0 ? summary.score / summary.applicable : null;
  const healthy = pct !== null && pct >= 0.8;
  const accentClass =
    pct === null
      ? "border-slate-200"
      : pct >= 0.8
      ? "border-emerald-200"
      : pct >= 0.5
      ? "border-amber-200"
      : "border-red-200";

  return (
    <HealthTile isActive={isActive} onClick={onOpen} accentClass={accentClass}>
      <div className="flex items-center gap-2 mb-1">
        <Shield
          size={15}
          className={pct === null ? "text-slate-400" : healthy ? "text-emerald-500" : "text-amber-500"}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Security</span>
      </div>

      <div className="mt-2 mb-4 flex items-center gap-4">
        {summary ? (
          <>
            <RingChart score={summary.score} applicable={summary.applicable} />
            <div>
              <p className={`text-base font-semibold ${healthy ? "text-emerald-700" : "text-amber-700"}`}>
                {healthy ? "Healthy" : "Needs Review"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {summary.score}/{summary.applicable} checks passed
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Shield size={22} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2">
        {summary && summary.topFailures.length > 0 ? (
          <>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Top gaps</p>
            {summary.topFailures.map((name) => (
              <div key={name} className="flex items-start gap-1.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">{name}</p>
              </div>
            ))}
          </>
        ) : summary ? (
          <p className="text-sm text-emerald-600 font-medium">All checks passed</p>
        ) : null}
      </div>

      <div className="mt-auto pt-3 flex items-center border-t border-slate-100">
        <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1">
          {isActive ? "Hide checklist" : "View checklist"}
          <ChevronRight size={12} className={`transition-transform ${isActive ? "rotate-90" : ""}`} />
        </span>
      </div>
    </HealthTile>
  );
}
