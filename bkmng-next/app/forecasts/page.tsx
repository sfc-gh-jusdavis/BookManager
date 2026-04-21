"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Target, TrendingUp, Layers, BarChart3, ChevronDown, ChevronRight,
  Zap, AlertTriangle, Pencil,
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
};
type Account = { account_id: string; ace_assigned: string };

const QUARTERS = ["Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026", "FY"];
const CURRENT_QUARTER = "Q2-2026";

function effectiveCategory(f: Forecast): string {
  return f.override_category ?? f.auto_category;
}

function catColors(cat: string): string {
  if (cat === "Commit") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (cat === "Most Likely") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function CatBadge({ f }: { f: Forecast }) {
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

function UtilBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-slate-400">No contract</span>;
  const clamped = Math.min(pct, 120);
  const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-sky-400" : pct >= 25 ? "bg-amber-400" : "bg-red-400";
  const textColor = pct >= 100 ? "text-emerald-600 font-semibold" : pct >= 75 ? "text-sky-600" : pct >= 25 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${textColor}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function KPIBucket({ label, count, icon, colorClass }: {
  label: string; count: number; icon: React.ReactNode; colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${colorClass}`}>
          {icon}{label}
        </div>
        <p className="text-3xl font-bold text-slate-900">{count}</p>
        <p className="text-xs text-slate-500 mt-0.5">use cases</p>
      </CardContent>
    </Card>
  );
}

type QuarterCounts = { commit: number; mostLikely: number; stretch: number; total: number };

function countsByAccount(
  forecasts: Forecast[],
  accountId: string,
  quarter: string,
  allQuarters: string[],
): QuarterCounts {
  const qs = quarter === "FY" ? allQuarters : [quarter];
  const seen = new Set<string>();
  let commit = 0, mostLikely = 0, stretch = 0;
  for (const f of forecasts) {
    if (f.account_id !== accountId) continue;
    if (!qs.includes(f.quarter)) continue;
    if (seen.has(f.use_case_id)) continue;
    seen.add(f.use_case_id);
    const cat = effectiveCategory(f);
    if (cat === "Commit") commit++;
    else if (cat === "Most Likely") mostLikely++;
    else stretch++;
  }
  return { commit, mostLikely, stretch, total: commit + mostLikely + stretch };
}

interface ExpandedRowProps {
  accountId: string;
  quarter: string;
  allQuarters: string[];
  forecasts: Forecast[];
  useCaseMap: Map<string, UseCase>;
  catFilter: string;
  ucAssessmentMap: Map<string, UseCaseAssessment>;
  breakdownMap: Map<string, BreakdownSummary>;
  accountAssessment: AccountAssessment | undefined;
}

function ExpandedRow({ accountId, quarter, allQuarters, forecasts, useCaseMap, catFilter, ucAssessmentMap, breakdownMap, accountAssessment }: ExpandedRowProps) {
  const qs = quarter === "FY" ? allQuarters : [quarter];
  const rows: Forecast[] = [];
  const seen = new Set<string>();
  for (const f of forecasts) {
    if (f.account_id !== accountId) continue;
    if (!qs.includes(f.quarter)) continue;
    if (seen.has(f.use_case_id)) continue;
    seen.add(f.use_case_id);
    if (catFilter !== "All" && catFilter !== "Overrides" && effectiveCategory(f) !== catFilter) continue;
    if (catFilter === "Overrides" && f.override_category === null) continue;
    rows.push(f);
  }

  if (rows.length === 0) return (
    <tr className="bg-slate-50/50">
      <td colSpan={7} className="px-12 py-3 text-xs text-slate-400 italic">No use cases for this filter.</td>
    </tr>
  );

  return (
    <>
      {accountAssessment && (
        <tr className="bg-violet-50/40 border-b border-violet-100">
          <td colSpan={7} className="pl-12 pr-4 py-2">
            <div className="flex items-start gap-3">
              <Zap size={13} className="text-violet-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[11px] font-semibold text-violet-700">AI Insight</span>
                {accountAssessment.rationale && (
                  <p className="text-[11px] text-slate-600 mt-0.5">{accountAssessment.rationale}</p>
                )}
                {accountAssessment.recommended_actions && (
                  <p className="text-[11px] text-slate-500 mt-0.5 italic">{accountAssessment.recommended_actions}</p>
                )}
              </div>
              {accountAssessment.ai_priority_score != null && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-700 border-violet-200">
                  {accountAssessment.ai_priority_score.toFixed(1)} / 10
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
      {rows.map((f) => {
        const uc = useCaseMap.get(f.use_case_id);
        const ucAssessment = ucAssessmentMap.get(f.use_case_id);
        const bdSummary = breakdownMap.get(f.use_case_id);
        const tierColor = ucAssessment?.ai_tier === "high" ? "bg-red-50 text-red-700 border-red-200"
          : ucAssessment?.ai_tier === "medium" ? "bg-amber-50 text-amber-700 border-amber-200"
          : ucAssessment?.ai_tier === "low" ? "bg-slate-50 text-slate-600 border-slate-200"
          : null;
        return (
          <tr key={`${f.use_case_id}:${f.quarter}`} className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50">
            <td className="pl-12 pr-4 py-2.5 text-sm text-slate-700" colSpan={2}>
              {uc?.use_case_name ?? f.use_case_id}
              <span className="ml-2 text-[11px] text-slate-400">{uc?.stage}</span>
              {f.override_note && (
                <p className="text-[11px] text-slate-400 italic mt-0.5">
                  <Pencil size={9} className="inline mr-1 opacity-60" />
                  {f.override_note}
                  {f.override_by && <span className="not-italic"> — {f.override_by}</span>}
                </p>
              )}
              {ucAssessment?.rationale && (
                <p className="text-[10px] text-slate-400 italic mt-0.5">{ucAssessment.rationale}</p>
              )}
            </td>
            <td className="px-4 py-2.5" colSpan={5}>
              <div className="flex items-center gap-3 flex-wrap">
                <CatBadge f={f} />
                {ucAssessment && tierColor && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tierColor}`}>
                    <Zap size={9} />AI {ucAssessment.ai_tier}
                    {ucAssessment.confidence != null && (
                      <span className="opacity-70">({Math.round(ucAssessment.confidence * 100)}%)</span>
                    )}
                  </span>
                )}
                {bdSummary && (
                  <Link href={`/accounts/${f.account_id}?tab=overview`}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors">
                    <Layers size={9} />
                    Splittable ({bdSummary.total_sub_use_cases} sub-UCs)
                  </Link>
                )}
                {f.pending_approval && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Pending Review
                  </span>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </>
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allQuarters = QUARTERS.filter((q) => q !== "FY");

  const scopedAccountIds = useMemo(() => {
    if (isManager) return new Set((accounts as Account[]).map((a) => a.account_id));
    return new Set((accounts as Account[]).filter((a) => a.ace_assigned === currentUser?.email).map((a) => a.account_id));
  }, [accounts, isManager, currentUser]);

  const useCaseMap = useMemo(() => {
    const m = new Map<string, UseCase>();
    for (const uc of allUseCases as UseCase[]) m.set(uc.use_case_id, uc);
    return m;
  }, [allUseCases]);

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

  const accountsWithData = useMemo(() => {
    const ids = new Set<string>();
    for (const f of scopedForecasts) ids.add(f.account_id);
    if (proj?.accounts) for (const a of proj.accounts) if (scopedAccountIds.has(a.account_id)) ids.add(a.account_id);
    return Array.from(ids).sort((a, b) => (accountNames.get(a) ?? "").localeCompare(accountNames.get(b) ?? ""));
  }, [scopedForecasts, proj, scopedAccountIds, accountNames]);

  const projMap = useMemo(() => {
    const m = new Map<string, AccountConsumptionProjection>();
    if (proj?.accounts) for (const a of proj.accounts) m.set(a.account_id, a);
    return m;
  }, [proj]);

  const globalCounts = useMemo(() => {
    const qs = quarter === "FY" ? allQuarters : [quarter];
    const seen = new Set<string>();
    let commit = 0, mostLikely = 0, stretch = 0;
    for (const f of scopedForecasts) {
      if (!qs.includes(f.quarter)) continue;
      const key = `${f.use_case_id}:${f.quarter}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cat = effectiveCategory(f);
      if (cat === "Commit") commit++;
      else if (cat === "Most Likely") mostLikely++;
      else stretch++;
    }
    return { commit, mostLikely, stretch, total: commit + mostLikely + stretch };
  }, [scopedForecasts, quarter, allQuarters]);

  const overrideCount = useMemo(() =>
    scopedForecasts.filter((f) => f.override_category !== null).length,
    [scopedForecasts]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isLoading = accsLoading || fcLoading || projLoading;
  const isFY = quarter === "FY";

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Forecasts</h1>
        <p className="text-sm text-slate-500 mt-0.5">Use case forecasts and consumption by account</p>
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
      </div>

      <div className="px-6 py-4 flex-1">
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <KPIBucket label="Total" count={globalCounts.total} icon={<BarChart3 size={12} />} colorClass="bg-slate-100 text-slate-600" />
              <KPIBucket label="Commit" count={globalCounts.commit} icon={<Target size={12} />} colorClass="bg-emerald-50 text-emerald-700" />
              <KPIBucket label="Most Likely" count={globalCounts.mostLikely} icon={<TrendingUp size={12} />} colorClass="bg-blue-50 text-blue-700" />
              <KPIBucket label="Stretch" count={globalCounts.stretch} icon={<Layers size={12} />} colorClass="bg-amber-50 text-amber-700" />
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[52rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-5" />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Account</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">
                      {isFY ? "FY Consumption" : `${quarter} Consumption`}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">vs Capacity</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-emerald-700">Commit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-blue-700">Most Likely</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-amber-700">Stretch</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsWithData.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">No data available.</td></tr>
                  ) : accountsWithData.map((accId) => {
                    const projAcct = projMap.get(accId);
                    const uc_counts = countsByAccount(scopedForecasts, accId, quarter, allQuarters);
                    const isExp = expanded.has(accId);

                    const consumption = isFY
                      ? (projAcct ? projAcct.fy_total : null)
                      : (projAcct ? (() => {
                          const qd = projAcct.quarters[quarter];
                          return qd ? (qd.actual + qd.projected) : null;
                        })() : null);
                    const utilPct = isFY
                      ? projAcct?.pct_capacity_projected ?? null
                      : null;

                    const name = accountNames.get(accId) ?? accId;
                    const acctAssessment = acctAssessmentMap.get(accId);                    const hasRows = (catFilter === "All"
                      ? uc_counts.total
                      : catFilter === "Overrides"
                        ? scopedForecasts.filter((f) => f.account_id === accId && f.override_category !== null).length
                        : (catFilter === "Commit" ? uc_counts.commit
                          : catFilter === "Most Likely" ? uc_counts.mostLikely
                          : uc_counts.stretch)) > 0;

                    return (
                      <>
                        <tr
                          key={accId}
                          className={`border-b border-slate-100 hover:bg-slate-50 ${isExp ? "bg-slate-50/60" : ""} ${uc_counts.total > 0 ? "cursor-pointer" : ""}`}
                          onClick={() => { if (uc_counts.total > 0) toggleExpand(accId); }}
                        >
                          <td className="px-4 py-3.5 text-slate-400 w-5">
                            {uc_counts.total > 0 && (
                              isExp
                                ? <ChevronDown size={14} />
                                : <ChevronRight size={14} />
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/accounts/${accId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-slate-800 hover:text-sky-600 hover:underline"
                            >
                              {name}
                            </Link>
                            {projAcct?.contract_capacity && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{fmtK(projAcct.contract_capacity)} credit capacity</p>
                            )}
                            {acctAssessment && acctAssessment.ai_priority_score != null && (
                              <span className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                acctAssessment.priority_tier === "critical" || acctAssessment.priority_tier === "high"
                                  ? "bg-violet-100 text-violet-700 border-violet-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                <Zap size={9} />{acctAssessment.ai_priority_score.toFixed(1)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums">
                            {consumption != null ? (
                              <span className="text-sm text-slate-700">{fmtK(consumption)}</span>
                            ) : <span className="text-slate-400 text-sm">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <UtilBar pct={isFY ? utilPct : (projAcct?.pct_capacity_projected ?? null)} />
                          </td>
                          <td className="px-4 py-3.5">
                            {uc_counts.commit > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                {uc_counts.commit}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            {uc_counts.mostLikely > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                {uc_counts.mostLikely}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            {uc_counts.stretch > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                {uc_counts.stretch}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                        </tr>
                        {isExp && hasRows && (
                          <ExpandedRow
                            key={`${accId}-expanded`}
                            accountId={accId}
                            quarter={quarter}
                            allQuarters={allQuarters}
                            forecasts={scopedForecasts}
                            useCaseMap={useCaseMap}
                            catFilter={catFilter}
                            ucAssessmentMap={ucAssessmentMap}
                            breakdownMap={breakdownMap}
                            accountAssessment={acctAssessment}
                          />
                        )}
                      </>
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
