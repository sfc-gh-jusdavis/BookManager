"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { withFlagGate } from "@/components/ui/flag-gate";
import { useAccounts, type Account } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

const ENGAGEMENT_COLORS: Record<string, string> = {
  "Low":    "bg-sky-400",
  "Normal": "bg-emerald-500",
  "High":   "bg-violet-500",
};

const ENGAGEMENT_BADGE: Record<string, string> = {
  "Low":    "bg-sky-50 text-sky-700 border-sky-200",
  "Normal": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "High":   "bg-violet-50 text-violet-700 border-violet-200",
};

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

type GanttRow = {
  account: Account;
  startDate: Date | null;
  endDate: Date | null;
};

function TimelinePage() {
  const { currentUser } = useAuth();
  const { data: allAccounts = [], isLoading } = useAccounts();
  const [offsetMonths, setOffsetMonths] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const windowStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1 + offsetMonths);
    return d;
  }, [today, offsetMonths]);

  const windowEnd = useMemo(() => {
    const d = new Date(windowStart);
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [windowStart]);

  const wMs = windowStart.getTime();
  const spanMs = windowEnd.getTime() - wMs;

  const myAccounts = useMemo((): Account[] => {
    if (!currentUser) return allAccounts as Account[];
    if (currentUser.role === "acem") return allAccounts as Account[];
    return (allAccounts as Account[]).filter((a) => a.ace_assigned === currentUser.email);
  }, [allAccounts, currentUser]);

  const rows = useMemo((): GanttRow[] => {
    return myAccounts.map((a) => {
      const startDate = parseDate(a.engagement_start_date);
      const endDate = parseDate(a.rolloff_date) ?? (startDate ? addDays(startDate, 90) : null);
      return { account: a, startDate, endDate };
    });
  }, [myAccounts]);

  const filteredRows = useMemo(() => {
    switch (filterStatus) {
      case "dated":   return rows.filter((r) => r.startDate && r.account.status.toLowerCase() !== "stopped");
      case "undated": return rows.filter((r) => !r.startDate && r.account.status.toLowerCase() !== "stopped");
      case "active": case "not started": case "complete": case "paused": case "stopped":
        return rows.filter((r) => r.account.status.toLowerCase() === filterStatus);
      default: return rows.filter((r) => r.account.status.toLowerCase() !== "stopped");
    }
  }, [rows, filterStatus]);

  const sorted = useMemo(() => {
    const dated   = filteredRows.filter((r) => r.startDate).sort((a, b) => (a.startDate!.getTime() - b.startDate!.getTime()));
    const undated = filteredRows.filter((r) => !r.startDate).sort((a, b) => a.account.account_name.localeCompare(b.account.account_name));
    return { dated, undated };
  }, [filteredRows]);

  const monthTicks = useMemo(() => {
    const ticks: { label: string; pct: number }[] = [];
    const d = new Date(windowStart);
    d.setDate(1);
    for (let i = 0; i <= 7; i++) {
      const pct = ((d.getTime() - wMs) / spanMs) * 100;
      if (pct >= 0 && pct <= 101) {
        ticks.push({ label: formatMonthYear(d), pct });
      }
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, [windowStart, wMs, spanMs]);

  const todayPct = ((today.getTime() - wMs) / spanMs) * 100;

  function getBar(row: GanttRow): { left: number; width: number; clipped: boolean } | null {
    if (!row.startDate || !row.endDate) return null;
    const sMs = row.startDate.getTime();
    const eMs = row.endDate.getTime();
    if (eMs < wMs || sMs > windowEnd.getTime()) return { left: 0, width: 0, clipped: true };
    const cStart = Math.max(sMs, wMs);
    const cEnd   = Math.min(eMs, windowEnd.getTime());
    const left  = ((cStart - wMs) / spanMs) * 100;
    const width = ((cEnd - cStart) / spanMs) * 100;
    return { left, width, clipped: sMs < wMs || eMs > windowEnd.getTime() };
  }

  function getBarClasses(row: GanttRow): string {
    const base = ENGAGEMENT_COLORS[row.account.engagement_status] ?? "bg-slate-400";
    const isNotStarted = row.account.status.toLowerCase() === "not started";
    if (isNotStarted) return `border-2 border-dashed border-slate-300 bg-transparent`;
    if (row.account.status.toLowerCase() === "complete") return `${base} opacity-50`;
    if (row.account.status.toLowerCase() === "stopped")  return `bg-slate-300`;
    if (row.account.status.toLowerCase() === "paused")   return `bg-amber-400`;
    return base;
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header bar */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-slate-400" />
          <h1 className="text-sm font-semibold text-slate-800">Engagement Timeline</h1>
          <span className="text-[11px] text-slate-400">
            {formatMonthYear(windowStart)} → {formatMonthYear(windowEnd)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:border-sky-400"
          >
            <option value="all">All accounts</option>
            <option value="dated">With dates</option>
            <option value="undated">No dates</option>
            <option value="active">Active</option>
            <option value="not started">Not Started</option>
            <option value="complete">Complete</option>
            <option value="paused">Paused</option>
            <option value="stopped">Stopped</option>
          </select>
          <button onClick={() => setOffsetMonths((o) => o - 3)} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors" title="Back 3 months">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setOffsetMonths(0)} className="px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50 transition-colors">
            Today
          </button>
          <button onClick={() => setOffsetMonths((o) => o + 3)} className="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors" title="Forward 3 months">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex flex-1 overflow-y-auto min-h-0">
        {/* Left: account names */}
        <div className="w-48 shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10">
          {/* Month header spacer */}
          <div className="h-7 border-b border-slate-100 bg-slate-50" />
          {sorted.dated.map((row) => (
            <Link
              key={row.account.account_id}
              href={`/accounts/${row.account.account_id}`}
              className="flex flex-col justify-center px-3 h-11 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
            >
              <span className="text-[11px] font-medium text-slate-700 truncate group-hover:text-sky-600">{row.account.account_name}</span>
              <span className={`text-[9px] px-1 py-px rounded-full border font-medium w-fit mt-0.5 ${ENGAGEMENT_BADGE[row.account.engagement_status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
                {row.account.engagement_status}
              </span>
            </Link>
          ))}
          {sorted.undated.length > 0 && (
            <>
              <div className="h-6 border-b border-dashed border-slate-200 bg-slate-50 flex items-center px-3">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">No dates ({sorted.undated.length})</span>
              </div>
              {sorted.undated.map((row) => (
                <Link
                  key={row.account.account_id}
                  href={`/accounts/${row.account.account_id}`}
                  className="flex flex-col justify-center px-3 h-9 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                >
                  <span className="text-[11px] text-slate-400 truncate group-hover:text-sky-600">{row.account.account_name}</span>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* Right: chart */}
        <div className="flex-1 overflow-x-hidden relative">
          {/* Month tick header */}
          <div className="relative h-7 border-b border-slate-100 bg-slate-50 shrink-0">
            {monthTicks.map((tick, i) => (
              <div key={i} className="absolute top-0 bottom-0 flex items-center" style={{ left: `${tick.pct}%` }}>
                <div className="w-px h-full bg-slate-200" />
                <span className="text-[10px] text-slate-400 ml-1 whitespace-nowrap">{tick.label}</span>
              </div>
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-20" style={{ left: `${todayPct}%` }}>
                <span className="absolute -top-0.5 left-1 text-[9px] text-sky-500 font-semibold whitespace-nowrap">Today</span>
              </div>
            )}
          </div>

          {/* Dated rows */}
          {sorted.dated.map((row) => {
            const bar = getBar(row);
            const isNotStarted = row.account.status.toLowerCase() === "not started";
            return (
              <div key={row.account.account_id} className="relative h-11 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                {monthTicks.map((tick, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-50" style={{ left: `${tick.pct}%` }} />
                ))}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-sky-100 z-10" style={{ left: `${todayPct}%` }} />
                )}
                {bar && bar.width > 0 && (
                  <div
                    className={`absolute top-2 bottom-2 rounded transition-all z-20 ${getBarClasses(row)}`}
                    style={{ left: `${bar.left}%`, width: `${Math.max(bar.width, 0.5)}%` }}
                    title={`${row.account.account_name}\nStatus: ${row.account.status} · Engagement: ${row.account.engagement_status}\n${row.startDate ? formatShort(row.startDate) : "?"} → ${row.endDate ? formatShort(row.endDate) : "?"}`}
                  >
                    {!isNotStarted && bar.width > 5 && (
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate pointer-events-none">
                        {row.startDate && row.endDate ? `${formatShort(row.startDate)} – ${formatShort(row.endDate)}` : ""}
                      </span>
                    )}
                    {isNotStarted && bar.width > 5 && (
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] text-slate-400 truncate pointer-events-none">
                        {row.startDate && row.endDate ? `${formatShort(row.startDate)} – ${formatShort(row.endDate)}` : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Undated rows section */}
          {sorted.undated.length > 0 && (
            <>
              <div className="h-6 border-b border-dashed border-slate-200 bg-slate-50/80 flex items-center px-3">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">No dates set</span>
              </div>
              {sorted.undated.map((row) => (
                <div key={row.account.account_id} className="relative h-9 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  {monthTicks.map((tick, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-50" style={{ left: `${tick.pct}%` }} />
                  ))}
                  <div className="absolute inset-0 flex items-center px-4">
                    <span className="text-[11px] text-slate-300 italic">Set engagement dates on account detail</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Legend footer */}
      <div className="px-6 py-2 border-t border-slate-100 bg-white flex items-center gap-5 shrink-0 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Legend</span>
        {Object.entries(ENGAGEMENT_COLORS).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className={`w-3 h-3 rounded ${color}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-4 h-3 rounded border-2 border-dashed border-slate-300" />
          Not started
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <span className="w-3 h-3 rounded bg-amber-400" />
          Paused
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-blue-500">
          <span className="w-3 h-3 rounded bg-blue-400 opacity-50" />
          Complete
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-sky-500 ml-auto">
          <span className="w-0.5 h-4 bg-sky-400" />
          Today
        </span>
        <span className="text-[11px] text-slate-400">
          {sorted.dated.length} with dates · {sorted.undated.length} without
        </span>
      </div>
    </div>
  );
}

export default withFlagGate(TimelinePage, "page_timeline");
