"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import { HealthTile } from "./HealthTile";
import { PRIORITY_DOT } from "@/components/alerts/AlertRow";
import type { AlertItem } from "@/hooks/useApi";

function PriorityBar({ alerts }: { alerts: AlertItem[] }) {
  const high = alerts.filter((a) => a.priority === "high").length;
  const medium = alerts.filter((a) => a.priority === "medium").length;
  const low = alerts.filter((a) => a.priority === "low").length;
  const total = alerts.length;
  if (total === 0) return null;
  return (
    <div className="flex rounded-full overflow-hidden h-2 w-full gap-px">
      {high > 0 && (
        <div className="bg-red-400" style={{ width: `${(high / total) * 100}%` }} />
      )}
      {medium > 0 && (
        <div className="bg-amber-400" style={{ width: `${(medium / total) * 100}%` }} />
      )}
      {low > 0 && (
        <div className="bg-slate-300" style={{ width: `${(low / total) * 100}%` }} />
      )}
    </div>
  );
}

export function AlertsTile({
  alerts,
  isActive,
  onOpen,
}: {
  alerts: AlertItem[];
  isActive: boolean;
  onOpen: () => void;
}) {
  const unread = alerts.filter((a) => !a.is_read);
  const high = alerts.filter((a) => a.priority === "high").length;
  const medium = alerts.filter((a) => a.priority === "medium").length;
  const low = alerts.filter((a) => a.priority === "low").length;
  const accentClass =
    high > 0
      ? "border-red-200"
      : medium > 0
      ? "border-amber-200"
      : "border-slate-200";

  const topPreviews = [...alerts]
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2);
    })
    .slice(0, 3);

  return (
    <HealthTile isActive={isActive} onClick={onOpen} accentClass={accentClass}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle
            size={15}
            className={high > 0 ? "text-red-500" : medium > 0 ? "text-amber-500" : "text-slate-400"}
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Alerts</span>
        </div>
        {unread.length > 0 && (
          <span className="text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 font-bold">
            {unread.length} new
          </span>
        )}
      </div>

      <div className="mt-2 mb-3">
        <span className="text-4xl font-bold text-slate-800 tabular-nums leading-none">
          {alerts.length}
        </span>
        <span className="ml-1.5 text-sm text-slate-500">active</span>
      </div>

      {alerts.length > 0 ? (
        <>
          <div className="mb-3">
            <PriorityBar alerts={alerts} />
            <div className="flex items-center gap-4 mt-1.5">
              {high > 0 && (
                <span className="text-[11px] flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT.high}`} />
                  <span className="text-slate-600 font-medium">{high} high</span>
                </span>
              )}
              {medium > 0 && (
                <span className="text-[11px] flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT.medium}`} />
                  <span className="text-slate-600 font-medium">{medium} medium</span>
                </span>
              )}
              {low > 0 && (
                <span className="text-[11px] flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT.low}`} />
                  <span className="text-slate-600 font-medium">{low} low</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {topPreviews.map((a) => (
              <div key={a.alert_id} className="flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[a.priority] ?? PRIORITY_DOT.low}`} />
                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2 min-w-0">
                  {a.text || a.signal_type.replace(/_/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center">
          <p className="text-sm text-slate-400">No active alerts</p>
        </div>
      )}

      <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100">
        <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1">
          {isActive ? "Hide details" : "View all alerts"}
          <ChevronRight size={12} className={`transition-transform ${isActive ? "rotate-90" : ""}`} />
        </span>
      </div>
    </HealthTile>
  );
}
