"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Zap, Play, Rocket, Coins,
  Layers, Pencil, CalendarClock, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAccounts, useUseCases, useForecasts, useConsumptionProjection, useAccountAssessments, useAllUseCaseAssessments, useAllBreakdownSummaries } from "@/hooks/useApi";
import type { AccountConsumptionProjection, AccountAssessment, UseCaseAssessment, BreakdownSummary } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Forecast = {
  use_case_id: string; account_id: string; quarter: string;
  auto_category: string; override_category: string | null;
  override_by: string | null; override_note: string | null;
  override_at: string | null; pending_approval: boolean;
};
type UseCase = {
  use_case_id: string; account_id: string; account_name: string;
  use_case_name: string; stage: string;
  implementation_start_date: string | null;
  go_live_date: string | null;
  target_go_live_date: string | null;
  lead_se: string | null;
  ace_assigned: string | null;
};
type Account = { account_id: string; ace_assigned: string };

const QUARTERS = ["Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026", "FY"];

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Snowflake FY: Feb 1 – Jan 31, labeled by start year
  // Q1: Feb–Apr, Q2: May–Jul, Q3: Aug–Oct, Q4: Nov–Jan
  let q: number;
  let fyYear: number;
  if (month === 1) { q = 4; fyYear = year - 1; }
  else if (month <= 4) { q = 1; fyYear = year; }
  else if (month <= 7) { q = 2; fyYear = year; }
  else if (month <= 10) { q = 3; fyYear = year; }
  else { q = 4; fyYear = year; }
  const key = `Q${q}-${fyYear}`;
  return QUARTERS.includes(key) ? key : QUARTERS[0];
}

const CURRENT_QUARTER = getCurrentQuarter();

function effectiveCategory(f: Forecast): string {
  return f.override_category ?? f.auto_category;
}

function catColors(cat: string): string {
  if (cat === "Commit") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (cat === "Most Likely") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function CatBadge({ f }: { f: Forecast | undefined }) {
  if (!f) return <span className="text-slate-300 text-xs">—</span>;
  const cat = effectiveCategory(f);
  const isOverridden = f.override_category !== null;
  const tooltip = isOverridden
    ? `Overridden by ${f.override_by ?? "someone"}${f.override_note ? `: "${f.override_note}"` : ""}${f.override_at ? ` (${new Date(f.override_at).toLocaleDateString()})` : ""}`
    : undefined;
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${catColors(cat)} ${isOverridden ? "border-dashed" : ""}`}
    >
      {isOverridden && <Pencil size={9} className="opacity-70" />}
      {cat}
    </span>
  );
}

function fmtK(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function inWindow(iso: string | null | undefined, startIso: string, endIso: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= startIso && d <= endIso;
}

function beforeWindow(iso: string | null | undefined, startIso: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) < startIso;
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

function KPIBucket({ label, count, icon, colorClass, sublabel, valueSuffix }: {
  label: string; count: number | string; icon: React.ReactNode; colorClass: string;
  sublabel?: React.ReactNode; valueSuffix?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${colorClass}`}>
          {icon}{label}
        </div>
        <p className="text-3xl font-bold text-slate-900">{count}{valueSuffix && <span className="text-lg font-semibold text-slate-500 ml-1">{valueSuffix}</span>}</p>
        {sublabel ? (
          <div className="text-xs text-slate-500 mt-0.5">{sublabel}</div>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5">use cases</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForecastsPage() {
  const { currentUser } = useAuth();
  const isManager = currentUser?.role === "acem";

  const { data: accounts = [], isLoading: accsLoading } = useAccounts() as { data: Account[]; isLoading: boolean };
  const { data: allUseCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: apiForecasts = [], isLoading: fcLoading } = useForecasts() as { data: Forecast[]; isLoading: boolean };
  const { data: proj, isLoading: projLoading } = useConsumptionProjection();
  const { data: accountAssessments = [] } = useAccountAssessments() as { data: AccountAssessment[] };
  const { data: ucAssessments = [] } = useAllUseCaseAssessments() as { data: UseCaseAssessment[] };
  const { data: breakdownSummaries = [] } = useAllBreakdownSummaries() as { data: BreakdownSummary[] };

  const [quarter, setQuarter] = useState(CURRENT_QUARTER);
  const [catFilter, setCatFilter] = useState("All");
  const [showNoDates, setShowNoDates] = useState(false);

  const allQuarters = QUARTERS.filter((q) => q !== "FY");

  const scopedAccountIds = useMemo(() => {
    if (isManager) return new Set((accounts as Account[]).map((a) => a.account_id));
    return new Set((accounts as Account[]).filter((a) => a.ace_assigned === currentUser?.email).map((a) => a.account_id));
  }, [accounts, isManager, currentUser]);

  const acctAssessmentMap = useMemo(() => {
    const m = new Map<string, AccountAssessment>();
    for (const a of accountAssessments as AccountAssessment[]) m.set(a.account_id, a);
    return m;
  }, [accountAssessments]);

  const ucAssessmentMap = useMemo(() => {
    const m = new Map<string, UseCaseAssessment>();
    for (const u of ucAssessments as UseCaseAssessment[]) m.set(u.use_case_id, u);
    return m;
  }, [ucAssessments]);

  const breakdownMap = useMemo(() => {
    const m = new Map<string, BreakdownSummary>();
    for (const b of breakdownSummaries as BreakdownSummary[]) m.set(b.use_case_id, b);
    return m;
  }, [breakdownSummaries]);

  const accountNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const uc of allUseCases as UseCase[]) m.set(uc.account_id, uc.account_name);
    if (proj?.accounts) for (const a of proj.accounts) m.set(a.account_id, a.account_name);
    return m;
  }, [allUseCases, proj]);

  const scopedForecasts = useMemo(() =>
    (apiForecasts as Forecast[]).filter((f) => scopedAccountIds.has(f.account_id)),
    [apiForecasts, scopedAccountIds]
  );

  const forecastByUcQuarter = useMemo(() => {
    const m = new Map<string, Forecast>();
    for (const f of scopedForecasts) m.set(`${f.use_case_id}:${f.quarter}`, f);
    return m;
  }, [scopedForecasts]);

  const projMap = useMemo(() => {
    const m = new Map<string, AccountConsumptionProjection>();
    if (proj?.accounts) for (const a of proj.accounts) m.set(a.account_id, a);
    return m;
  }, [proj]);

  const quarterWindow = useMemo(() => {
    if (!proj) return null;
    if (quarter === "FY") {
      return { start: proj.fy_start, end: proj.fy_end, label: proj.fy_label, projKey: null as string | null };
    }
    const idx = allQuarters.indexOf(quarter);
    const q = proj.quarters[idx];
    if (!q) return null;
    return { start: q.start, end: q.end, label: q.label, projKey: q.key };
  }, [proj, quarter, allQuarters]);

  const useCasesByAccount = useMemo(() => {
    const m = new Map<string, UseCase[]>();
    for (const uc of allUseCases as UseCase[]) {
      const arr = m.get(uc.account_id) ?? [];
      arr.push(uc);
      m.set(uc.account_id, arr);
    }
    return m;
  }, [allUseCases, scopedAccountIds]);

  const aceKpis = useMemo(() => {
    const empty = {
      totalUseCases: 0,
      implStarts: 0,
      goLives: 0,
      goLiveCommit: 0,
      goLiveMostLikely: 0,
      goLiveStretch: 0,
      quarterConsumption: 0,
    };
    if (!quarterWindow) return empty;
    const { start, end, projKey } = quarterWindow;
    const qList = quarter === "FY" ? allQuarters : [quarter];

    let totalUseCases = 0, implStarts = 0, goLives = 0;
    let goLiveCommit = 0, goLiveMostLikely = 0, goLiveStretch = 0;

    for (const [, ucs] of useCasesByAccount) {
      for (const uc of ucs) {
        const effectiveGoLive = uc.go_live_date ?? uc.target_go_live_date;
        if (!beforeWindow(effectiveGoLive, start)) totalUseCases++;
        if (inWindow(uc.implementation_start_date, start, end)) implStarts++;
        if (inWindow(effectiveGoLive, start, end)) {
          goLives++;
          let cat: string | null = null;
          for (const q of qList) {
            const f = forecastByUcQuarter.get(`${uc.use_case_id}:${q}`);
            if (f) { cat = effectiveCategory(f); break; }
          }
          if (cat === "Commit") goLiveCommit++;
          else if (cat === "Most Likely") goLiveMostLikely++;
          else goLiveStretch++;
        }
      }
    }

    let quarterConsumption = 0;
    for (const accId of scopedAccountIds) {
      const p = projMap.get(accId);
      if (!p) continue;
      if (projKey == null) {
        quarterConsumption += p.fy_actual ?? 0;
      } else {
        const qd = p.quarters[projKey];
        if (qd) quarterConsumption += qd.actual ?? 0;
      }
    }

    return { totalUseCases, implStarts, goLives, goLiveCommit, goLiveMostLikely, goLiveStretch, quarterConsumption };
  }, [quarterWindow, quarter, allQuarters, useCasesByAccount, forecastByUcQuarter, scopedAccountIds, projMap]);

  const overrideCount = useMemo(() =>
    scopedForecasts.filter((f) => f.override_category !== null).length,
    [scopedForecasts]
  );

  const filteredUseCases = useMemo(() => {
    if (!quarterWindow) return [];
    const { start, end } = quarterWindow;
    const qList = quarter === "FY" ? allQuarters : [quarter];

    const rows: Array<{ uc: UseCase; forecast: Forecast | undefined; implInWindow: boolean; goLiveInWindow: boolean; noDates: boolean }> = [];

    for (const uc of allUseCases as UseCase[]) {
      const effectiveGoLive = uc.go_live_date ?? uc.target_go_live_date;
      const implInWindow = inWindow(uc.implementation_start_date, start, end);
      const goLiveInWindow = inWindow(effectiveGoLive, start, end);
      const noDates = !uc.implementation_start_date && !uc.go_live_date && !uc.target_go_live_date;

      if (!implInWindow && !goLiveInWindow) {
        if (!showNoDates || !noDates) continue;
        if (!isManager && uc.lead_se !== currentUser?.email) continue;
      }

      let forecast: Forecast | undefined;
      for (const q of qList) {
        const f = forecastByUcQuarter.get(`${uc.use_case_id}:${q}`);
        if (f) { forecast = f; break; }
      }

      if (catFilter !== "All") {
        if (catFilter === "Overrides") {
          if (!forecast || forecast.override_category === null) continue;
        } else {
          const cat = forecast ? effectiveCategory(forecast) : null;
          if (cat !== catFilter) continue;
        }
      }

      rows.push({ uc, forecast, implInWindow, goLiveInWindow, noDates });
    }

    rows.sort((a, b) => {
      const aGL = a.uc.go_live_date ?? a.uc.target_go_live_date ?? "";
      const bGL = b.uc.go_live_date ?? b.uc.target_go_live_date ?? "";
      const aImpl = a.uc.implementation_start_date ?? "";
      const bImpl = b.uc.implementation_start_date ?? "";
      const aDate = aGL || aImpl;
      const bDate = bGL || bImpl;
      if (!aDate && !bDate) return (a.uc.account_name ?? "").localeCompare(b.uc.account_name ?? "");
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    });

    return rows;
  }, [quarterWindow, quarter, allQuarters, allUseCases, scopedAccountIds, showNoDates, catFilter, forecastByUcQuarter]);

  const noDatesCount = useMemo(() => {
    if (!quarterWindow) return 0;
    const { start, end } = quarterWindow;
    let count = 0;
    for (const uc of allUseCases as UseCase[]) {
      const effectiveGoLive = uc.go_live_date ?? uc.target_go_live_date;
      const implInWindow = inWindow(uc.implementation_start_date, start, end);
      const goLiveInWindow = inWindow(effectiveGoLive, start, end);
      const noDates = !uc.implementation_start_date && !uc.go_live_date && !uc.target_go_live_date;
      if (!implInWindow && !goLiveInWindow && noDates) {
        if (isManager || uc.lead_se === currentUser?.email) count++;
      }
    }
    return count;
  }, [quarterWindow, allUseCases, scopedAccountIds]);

  const isLoading = accsLoading || fcLoading || projLoading;
  const isFY = quarter === "FY";

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Forecasts</h1>
        <p className="text-sm text-slate-500 mt-0.5">Use case implementation and go-live forecast by quarter</p>
      </div>

      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {QUARTERS.map((q) => (
            <button key={q} type="button" onClick={() => setQuarter(q)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${quarter === q ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-700"}`}>
              {q}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {["All", "Commit", "Most Likely", "Stretch"].map((cat) => (
            <button key={cat} type="button" onClick={() => setCatFilter(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${catFilter === cat ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700"}`}>
              {cat}
            </button>
          ))}
          {overrideCount > 0 && (
            <button type="button" onClick={() => setCatFilter("Overrides")}
              className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${catFilter === "Overrides" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-700"}`}>
              <Pencil size={9} />Overrides ({overrideCount})
            </button>
          )}
        </div>

        {noDatesCount > 0 && (
          <button
            type="button"
            onClick={() => setShowNoDates((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showNoDates
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"
            }`}
          >
            <CalendarClock size={11} />
            {showNoDates ? "Hiding" : "Show"} no-date UCs ({noDatesCount})
          </button>
        )}
      </div>

      <div className="px-6 py-4 flex-1">
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <KPIBucket
                label="Total Use Cases"
                count={aceKpis.totalUseCases}
                icon={<BarChart3 size={12} />}
                colorClass="bg-slate-100 text-slate-600"
                sublabel={`on book through ${quarterWindow?.label ?? ""}`}
              />
              <KPIBucket
                label="Implementation Starts"
                count={aceKpis.implStarts}
                icon={<Play size={12} />}
                colorClass="bg-indigo-50 text-indigo-700"
                sublabel={`in ${quarterWindow?.label ?? ""}`}
              />
              <KPIBucket
                label="Go-Lives"
                count={aceKpis.goLives}
                icon={<Rocket size={12} />}
                colorClass="bg-emerald-50 text-emerald-700"
                sublabel={
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span className="text-emerald-700">Commit {aceKpis.goLiveCommit}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-blue-700">Most Likely {aceKpis.goLiveMostLikely}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-amber-700">Stretch {aceKpis.goLiveStretch}</span>
                  </span>
                }
              />
              <KPIBucket
                label={`${quarterWindow?.label ?? "Quarter"} Consumption`}
                count={fmtK(aceKpis.quarterConsumption)}
                icon={<Coins size={12} />}
                colorClass="bg-sky-50 text-sky-700"
                sublabel="credits consumed"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[52rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Use Case</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Impl Start</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Go-Live</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUseCases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                        No use cases match the selected filters.
                      </td>
                    </tr>
                  ) : filteredUseCases.map(({ uc, forecast, implInWindow, goLiveInWindow, noDates }) => {
                    const effectiveGoLive = uc.go_live_date ?? uc.target_go_live_date;
                    const isActualGoLive = !!uc.go_live_date;
                    const acctAssessment = acctAssessmentMap.get(uc.account_id);
                    const ucAssessment = ucAssessmentMap.get(uc.use_case_id);
                    const bdSummary = breakdownMap.get(uc.use_case_id);

                    const tierColor = ucAssessment?.ai_tier === "high" ? "bg-red-50 text-red-700 border-red-200"
                      : ucAssessment?.ai_tier === "medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                      : ucAssessment?.ai_tier === "low" ? "bg-slate-50 text-slate-600 border-slate-200"
                      : null;

                    return (
                      <tr key={uc.use_case_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-800">{uc.use_case_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Link
                              href={`/accounts/${uc.account_id}`}
                              className="text-[11px] text-sky-600 hover:underline"
                            >
                              {uc.account_name}
                            </Link>
                            {uc.stage && (
                              <span className="text-[10px] text-slate-400">{uc.stage}</span>
                            )}
                            {noDates && (
                              <span className="text-[10px] text-slate-400 italic">no dates</span>
                            )}
                          </div>
                          {ucAssessment?.rationale && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5 leading-snug">{ucAssessment.rationale}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {uc.implementation_start_date ? (
                            <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border ${
                              implInWindow
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}>
                              {implInWindow && <Play size={9} />}
                              {fmtDate(uc.implementation_start_date)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {effectiveGoLive ? (
                            <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border ${
                              goLiveInWindow
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            }`}>
                              {isActualGoLive
                                ? <CheckCircle2 size={9} />
                                : goLiveInWindow && <Rocket size={9} />}
                              {fmtDate(effectiveGoLive)}
                              {!isActualGoLive && (
                                <span className="opacity-60 text-[9px]">target</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <CatBadge f={forecast} />
                          {forecast?.pending_approval && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ucAssessment && tierColor && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierColor}`}>
                                <Zap size={9} />AI {ucAssessment.ai_tier}
                                {ucAssessment.confidence != null && (
                                  <span className="opacity-70">({Math.round(ucAssessment.confidence * 100)}%)</span>
                                )}
                              </span>
                            )}
                            {acctAssessment && acctAssessment.ai_priority_score != null && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                acctAssessment.priority_tier === "critical" || acctAssessment.priority_tier === "high"
                                  ? "bg-violet-100 text-violet-700 border-violet-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                <Zap size={9} />{acctAssessment.ai_priority_score.toFixed(1)}
                              </span>
                            )}
                            {bdSummary && (
                              <Link href={`/accounts/${uc.account_id}?tab=overview`}
                                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors">
                                <Layers size={9} />
                                {bdSummary.total_sub_use_cases} sub-UCs
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
