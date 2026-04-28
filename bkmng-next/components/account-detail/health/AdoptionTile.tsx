"use client";

import { Cpu, ChevronRight } from "lucide-react";
import { HealthTile } from "./HealthTile";
import type { AccountAdoptionData, AdoptionSignals } from "@/hooks/useApi";

const SIG_KEYS: { key: keyof AdoptionSignals; label: string }[] = [
  { key: "sig_pipeline", label: "Pipeline" },
  { key: "sig_transforms", label: "Transforms" },
  { key: "sig_bi", label: "BI" },
  { key: "sig_cost", label: "Cost Gov" },
  { key: "sig_collab", label: "Collab" },
  { key: "sig_obs", label: "Observability" },
  { key: "sig_aiml", label: "AI/ML" },
  { key: "sig_spcs", label: "SPCS" },
];

export function AdoptionTile({
  adoption,
  isActive,
  onOpen,
}: {
  adoption: AccountAdoptionData | undefined;
  isActive: boolean;
  onOpen: () => void;
}) {
  const signals = adoption?.signals;
  const activeCount = signals
    ? SIG_KEYS.filter((s) => (signals[s.key] as number) === 1).length
    : 0;
  const accentClass =
    activeCount >= 5
      ? "border-emerald-200"
      : activeCount >= 3
      ? "border-amber-200"
      : "border-slate-200";

  const newFeatures = (adoption?.features ?? []).filter((f) => f.is_new_30d);
  const recentFeatures = [...(adoption?.features ?? [])]
    .sort((a, b) => (a.days_since_first_use ?? 999) - (b.days_since_first_use ?? 999))
    .slice(0, 3);

  return (
    <HealthTile isActive={isActive} onClick={onOpen} accentClass={accentClass}>
      <div className="flex items-center gap-2 mb-1">
        <Cpu
          size={15}
          className={activeCount >= 5 ? "text-emerald-500" : activeCount >= 3 ? "text-amber-500" : "text-slate-400"}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Adoption</span>
      </div>

      <div className="mt-2 mb-3 flex items-end gap-2">
        <div>
          <span className="text-4xl font-bold text-slate-800 tabular-nums leading-none">
            {activeCount}
          </span>
          <span className="text-lg font-bold text-slate-400 tabular-nums">/8</span>
        </div>
        <span className="text-sm text-slate-500 mb-1">categories</span>
        {newFeatures.length > 0 && (
          <span className="ml-auto mb-1 text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
            +{newFeatures.length} new
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="grid grid-cols-8 gap-1">
          {SIG_KEYS.map(({ key, label }) => {
            const active = signals ? (signals[key] as number) === 1 : false;
            return (
              <div
                key={key}
                title={label}
                className={`h-2 rounded-sm ${active ? "bg-emerald-400" : "bg-slate-100"}`}
              />
            );
          })}
        </div>
        <div className="grid grid-cols-8 gap-1 mt-0.5">
          {SIG_KEYS.map(({ key, label }) => {
            const active = signals ? (signals[key] as number) === 1 : false;
            return (
              <p
                key={key}
                className={`text-[7px] text-center leading-tight truncate ${active ? "text-emerald-600 font-semibold" : "text-slate-300"}`}
              >
                {label}
              </p>
            );
          })}
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {recentFeatures.length > 0 ? (
          recentFeatures.map((f, i) => (
            <div key={`${f.feature_raw}-${i}`} className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{f.feature_name}</span>
              {f.is_new_30d && (
                <span className="text-[9px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-1.5 shrink-0">
                  NEW
                </span>
              )}
            </div>
          ))
        ) : (
          <p className="text-[11px] text-slate-400">No feature activity yet</p>
        )}
        {signals?.missing_categories && (
          <p className="text-[9px] text-slate-400 pt-1">
            Not detected: {signals.missing_categories}
          </p>
        )}
      </div>

      <div className="mt-auto pt-3 flex items-center border-t border-slate-100">
        <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1">
          {isActive ? "Hide details" : "View all features"}
          <ChevronRight size={12} className={`transition-transform ${isActive ? "rotate-90" : ""}`} />
        </span>
      </div>
    </HealthTile>
  );
}
