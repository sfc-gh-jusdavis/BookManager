"use client";

// @flag-exempt: gated at call site via panel_health_adoption flag in app/accounts/[id]/page.tsx (Bucket 4)

import { Sparkles, ChevronRight } from "lucide-react";
import { HealthTile } from "./HealthTile";
import type { AIAdoptionData, AISurfaceKey, AIAdoptionWeek } from "@/hooks/useApi";

const SURFACES: {
  key: AISurfaceKey;
  label: string;
  barClass: string;
  dotClass: string;
  cardClass: string;
  numClass: string;
}[] = [
  { key: "cli", label: "CoCo CLI", barClass: "bg-violet-400", dotClass: "bg-violet-500", cardClass: "border-violet-100 bg-violet-50/40", numClass: "text-violet-800" },
  { key: "desktop", label: "CoCo Desktop", barClass: "bg-sky-400", dotClass: "bg-sky-500", cardClass: "border-sky-100 bg-sky-50/40", numClass: "text-sky-800" },
  { key: "snowsight", label: "CoCo Snowsight", barClass: "bg-emerald-400", dotClass: "bg-emerald-500", cardClass: "border-emerald-100 bg-emerald-50/40", numClass: "text-emerald-800" },
  { key: "si", label: "Snowflake Intelligence", barClass: "bg-amber-400", dotClass: "bg-amber-500", cardClass: "border-amber-100 bg-amber-50/40", numClass: "text-amber-800" },
];

function StackedSparkline({ trend }: { trend: AIAdoptionWeek[] }) {
  const totals = trend.map((w) => w.cli_users + w.desktop_users + w.snowsight_users + w.si_users);
  const maxVal = Math.max(...totals, 1);
  return (
    <div className="flex items-end gap-0.5 h-12 w-full">
      {trend.map((w, i) => {
        const total = totals[i] ?? 0;
        const heightPct = (total / maxVal) * 100;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col-reverse rounded-sm overflow-hidden"
            style={{ height: `${Math.max(heightPct, 4)}%` }}
            title={`${w.week_start}: ${total} users`}
          >
            {SURFACES.map((s) => {
              const v = (w as unknown as Record<string, number>)[`${s.key}_users`] ?? 0;
              if (v === 0) return null;
              const segPct = (v / Math.max(total, 1)) * 100;
              return (
                <div
                  key={s.key}
                  className={`${s.barClass} opacity-80`}
                  style={{ height: `${segPct}%` }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AIAdoptionTile({
  aiAdoption,
  isActive,
  onOpen,
}: {
  aiAdoption: AIAdoptionData | undefined;
  isActive: boolean;
  onOpen: () => void;
}) {
  const totalUsers = aiAdoption?.total_users_28d ?? 0;
  const totalRequests = aiAdoption?.total_requests_28d ?? 0;
  const surfaces = aiAdoption?.surfaces;
  const trend = aiAdoption?.weekly_trend ?? [];

  const accentClass =
    totalUsers >= 10
      ? "border-violet-200"
      : totalUsers > 0
      ? "border-sky-200"
      : "border-slate-200";

  return (
    <HealthTile isActive={isActive} onClick={onOpen} accentClass={accentClass}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles
            size={15}
            className={totalUsers > 0 ? "text-violet-500" : "text-slate-400"}
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI Adoption</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-800 tabular-nums leading-none">
            {totalUsers}
          </span>
          <span className="text-[11px] text-slate-500">users (L28D)</span>
          <span className="text-slate-300 text-[11px]">·</span>
          <span className="text-[11px] text-slate-500 tabular-nums">{totalRequests.toLocaleString()} prompts</span>
        </div>
      </div>

      {trend.length > 0 && (
        <div className="mb-3">
          <StackedSparkline trend={trend} />
          <p className="text-[9px] text-slate-400 mt-0.5">Weekly users by surface (8 wks)</p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SURFACES.map((s) => {
          const m = surfaces?.[s.key];
          const users = m?.users_28d ?? 0;
          const reqs = m?.requests_28d ?? 0;
          const depth = m?.avg_days_per_user ?? 0;
          return (
            <div key={s.key} className={`rounded-lg border ${s.cardClass} p-2.5 flex flex-col gap-1`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`h-2 w-2 rounded-sm shrink-0 ${s.dotClass}`} />
                <span className="text-[10px] font-medium text-slate-600 truncate">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold tabular-nums leading-none ${users > 0 ? s.numClass : "text-slate-300"}`}>
                  {users}
                </span>
                <span className="text-[10px] text-slate-500">users (L28D)</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Prompts</span>
                <span className="font-medium text-slate-700 tabular-nums">{reqs > 0 ? reqs.toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Depth</span>
                <span className="font-medium text-slate-700 tabular-nums">{depth > 0 ? `${depth}d/user` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 flex items-center border-t border-slate-100">
        <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1">
          {isActive ? "Hide details" : "View details"}
          <ChevronRight size={12} className={`transition-transform ${isActive ? "rotate-90" : ""}`} />
        </span>
      </div>
    </HealthTile>
  );
}
