"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronRight, ChevronDown, Search, X, Plus, AlertTriangle, Zap, CalendarCheck2, CalendarX, Mail, TrendingDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAccounts, useUseCases, useAceDisplayNames, useAccountRevenueSummaries, useSignalCounts, useRefreshBook, type SignalCountEntry, type Account, type RevenueSummary } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { withFlagGate } from "@/components/ui/flag-gate";

type PSNote = { note_id: string; content: string; created_at: string; author_id: string };

type UseCase = {
  use_case_id: string; account_id: string; use_case_name: string;
  stage: string; status: string; target_go_live_date: string | null;
  ps_notes: PSNote[];
};

type SortField = "account_name" | "engagement_status" | "status" | "industry" | "use_case_count" | "credits";

function dollarShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}


function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ENGAGEMENT_DOT: Record<string, string> = {
  "Low": "bg-sky-400",
  "Normal": "bg-emerald-400",
  "High": "bg-violet-400",
};
const ENGAGEMENT_BADGE: Record<string, string> = {
  "Low": "bg-sky-50 text-sky-700 border-sky-200",
  "Normal": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "High": "bg-violet-50 text-violet-700 border-violet-200",
};
const STATUS_BADGE: Record<string, string> = {
  "not started": "bg-slate-50 text-slate-500 border-slate-200",
  "active": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "complete": "bg-blue-50 text-blue-700 border-blue-200",
  "stopped": "bg-slate-100 text-slate-500 border-slate-300",
  "paused": "bg-amber-50 text-amber-700 border-amber-200",
};
const STAGE_BADGE: Record<string, string> = {
  "2 - Scoping": "bg-slate-50 text-slate-600 border-slate-200",
  "3 - Technical / Business Validation": "bg-sky-50 text-sky-700 border-sky-200",
  "5 - Implementation In Progress": "bg-violet-50 text-violet-700 border-violet-200",
  "8 - Use Case Lost": "bg-red-50 text-red-700 border-red-200",
};

function EngagementCell({ status }: { status: string }) {
  const dot = ENGAGEMENT_DOT[status] ?? "bg-slate-300";
  const badge = ENGAGEMENT_BADGE[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status.replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_BADGE[stage] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const label = stage.includes(" - ") ? (stage.split(" - ")[1] ?? stage) : stage;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SpendBar({ rev }: { rev: RevenueSummary | undefined }) {
  if (!rev || rev.total_consumed_revenue == null || rev.contract_capacity == null || rev.contract_capacity === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const pct = Math.min((rev.total_consumed_revenue / rev.contract_capacity) * 100, 100);
  const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-sky-400" : pct >= 25 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 tabular-nums">
        {dollarShort(rev.total_consumed_revenue)}<span className="text-slate-400">/{dollarShort(rev.contract_capacity)}</span>
      </span>
    </div>
  );
}

function ExpandedRow({ account, useCases, rev, sigCounts }: { account: Account; useCases: UseCase[]; rev: RevenueSummary | undefined; sigCounts: SignalCountEntry | undefined }) {
  const preview = useCases.slice(0, 3);
  return (
    <div className="px-6 py-5 bg-slate-50 border-t border-slate-100">
      <div className="grid grid-cols-3 gap-5">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Use Cases</p>
          {preview.length === 0 ? (
            <p className="text-xs text-slate-400">No use cases.</p>
          ) : (
            <div className="space-y-2">
              {preview.map((uc) => {
                const latest = uc.ps_notes?.length
                  ? [...uc.ps_notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  : null;
                return (
                  <div key={uc.use_case_id} className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{uc.use_case_name}</p>
                      <StageBadge stage={uc.stage} />
                    </div>
                    {uc.target_go_live_date && (
                      <p className="text-[11px] text-slate-400 mb-1">Target: {formatDate(uc.target_go_live_date)}</p>
                    )}
                    {latest && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-2">
                        &ldquo;{latest.content.slice(0, 120)}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
              {useCases.length > 3 && (
                <p className="text-[11px] text-slate-400 pl-1">+{useCases.length - 3} more use cases</p>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Credit Usage</p>
          <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
            {rev ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">$ Consumed</span>
                  <span className="text-sm font-bold text-slate-800">
                    {rev.total_consumed_revenue != null ? dollarShort(rev.total_consumed_revenue) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">$ Capacity</span>
                  <span className="text-sm font-bold text-slate-800">
                    {rev.contract_capacity != null ? dollarShort(rev.contract_capacity) : "—"}
                  </span>
                </div>
                {rev.total_consumed_revenue != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">$ Spend (90d)</span>
                    <span className="text-sm font-bold text-slate-800">{dollarShort(rev.total_consumed_revenue)}</span>
                  </div>
                )}
                {rev.predicted_overage_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Overage Forecast</span>
                    <span className="text-xs font-medium text-amber-600">{formatDate(rev.predicted_overage_date)}</span>
                  </div>
                )}
                <SpendBar rev={rev} />
              </>
            ) : (
              <p className="text-xs text-slate-400">No contract data.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Signals</p>
          <div className="rounded-lg bg-white border border-slate-200 p-3">
            {!sigCounts || sigCounts.total === 0 ? (
              <p className="text-xs text-slate-400">No active signals.</p>
            ) : (
              <div className="space-y-1.5">
                {sigCounts.high > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-red-700">
                      <AlertTriangle size={11} className="text-red-500" />High priority
                    </span>
                    <span className="text-xs font-bold text-red-700">{sigCounts.high}</span>
                  </div>
                )}
                {sigCounts.medium > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle size={11} className="text-amber-500" />Medium priority
                    </span>
                    <span className="text-xs font-bold text-amber-700">{sigCounts.medium}</span>
                  </div>
                )}
                {sigCounts.low > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Low priority</span>
                    <span className="text-xs font-medium text-slate-600">{sigCounts.low}</span>
                  </div>
                )}
                <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total signals</span>
                  <span className="text-xs font-semibold text-slate-700">{sigCounts.total}</span>
                </div>
                {account.new_adoption_30d && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                    <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-0.5">New Adoption</p>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{account.new_adoption_30d}</p>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Activity</p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarCheck2 size={11} className="text-emerald-500" />Meetings (30d)
                    </span>
                    <span className="text-xs font-medium text-slate-700">{account.meetings_last_30d ?? 0}</span>
                  </div>
                  {(() => {
                    const lmd = account.last_meeting_date;
                    if (!lmd) {
                      return (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <CalendarX size={11} className="text-rose-500" />Last meeting
                          </span>
                          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0 text-[10px] font-medium text-rose-700">never</span>
                        </div>
                      );
                    }
                    const days = Math.floor((Date.now() - new Date(lmd).getTime()) / 86_400_000);
                    const chipCls = days > 14
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : days > 7
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700";
                    const iconCls = days > 14 ? "text-rose-500" : days > 7 ? "text-amber-500" : "text-emerald-500";
                    return (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <CalendarX size={11} className={iconCls} />Last meeting
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${chipCls}`}>
                          {days}d ago
                        </span>
                      </div>
                    );
                  })()}
                  {(account.upcoming_meetings_5d ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 pl-4">Upcoming (14d)</span>
                      <span className="text-xs font-medium text-emerald-600">{account.upcoming_meetings_5d}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail size={11} className="text-sky-400" />Emails (30d)
                    </span>
                    <span className="text-xs font-medium text-slate-700">{account.emails_last_30d ?? 0}</span>
                  </div>
                  {account.email_trend && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 pl-4">Email trend</span>
                      <span className={`text-xs font-medium ${account.email_trend === "increasing" ? "text-emerald-600" : account.email_trend === "declining" ? "text-rose-600" : "text-slate-500"}`}>
                        {account.email_trend}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <Link
          href={`/accounts/${account.account_id}?tab=resources`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus size={12} /> Add Info
        </Link>
        <Link
          href={`/accounts/${account.account_id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Full Account <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = ["not started", "active", "paused", "complete", "stopped"];
const DEFAULT_STATUS_FILTER = ["not started", "active", "paused"];
const ENGAGEMENT_OPTIONS = ["All", "Low", "Normal", "High"];

function AccountsPage() {
  const { currentUser } = useAuth();
  const { data: accounts = [], isLoading: accsLoading } = useAccounts() as { data: Account[]; isLoading: boolean };
  const { data: useCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };
  const { data: revSummaries = {} } = useAccountRevenueSummaries() as { data: Record<string, RevenueSummary> };
  const { data: signalCounts = {} } = useSignalCounts() as { data: Record<string, SignalCountEntry> };

  const [search, setSearch] = useState("");
  const { refresh: refreshBook, isRefreshing: bookRefreshing } = useRefreshBook();
  const [statusFilter, setStatusFilter] = useState<string[]>(DEFAULT_STATUS_FILTER);
  const [engFilter, setEngFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [aceFilter, setAceFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("account_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const useCasesByAccount = useMemo(() => {
    const m: Record<string, UseCase[]> = {};
    for (const uc of useCases as UseCase[]) {
      if (!m[uc.account_id]) m[uc.account_id] = [];
      m[uc.account_id]!.push(uc);
    }
    return m;
  }, [useCases]);

  const roleScoped = useMemo(() => accounts as Account[], [accounts]);

  const industries = useMemo(() => ["All", ...new Set(roleScoped.map((a) => a.industry).filter((x): x is string => !!x)).values()].sort(), [roleScoped]);
  const aces = useMemo(() => {
    const ids = [...new Set(roleScoped.map((a) => a.ace_assigned))].sort();
    return [{ id: "All", label: "All" }, ...ids.map((id) => ({ id, label: (aceDisplayNames as Record<string, string>)[id] ?? id }))];
  }, [roleScoped, aceDisplayNames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roleScoped.filter((a) => {
      if (q && !a.account_name.toLowerCase().includes(q)) return false;
      if (!statusFilter.includes(a.status)) return false;
      if (engFilter !== "All" && a.engagement_status !== engFilter) return false;
      if (industryFilter !== "All" && a.industry !== industryFilter) return false;
      if (aceFilter !== "All" && a.ace_assigned !== aceFilter) return false;
      return true;
    });
  }, [roleScoped, search, statusFilter, engFilter, industryFilter, aceFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "account_name": cmp = a.account_name.localeCompare(b.account_name); break;
        case "engagement_status": cmp = a.engagement_status.localeCompare(b.engagement_status); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "industry": cmp = (a.industry ?? "").localeCompare(b.industry ?? ""); break;
        case "use_case_count": cmp = a.use_case_count - b.use_case_count; break;
        case "credits": {
          const ra = (revSummaries as Record<string, RevenueSummary>)[a.account_id];
          const rb = (revSummaries as Record<string, RevenueSummary>)[b.account_id];
          cmp = (ra?.pct_consumed ?? -1) - (rb?.pct_consumed ?? -1);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir, revSummaries]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="w-3 inline-block" />;
    return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  const statusFilterChanged =
    statusFilter.length !== DEFAULT_STATUS_FILTER.length ||
    !DEFAULT_STATUS_FILTER.every((s) => statusFilter.includes(s));
  const hasFilters = search || statusFilterChanged || engFilter !== "All" || industryFilter !== "All" || aceFilter !== "All";

  const COL_HEADERS: { field: SortField; label: string }[] = [
    { field: "account_name", label: "Account Name" },
    { field: "engagement_status", label: "Engagement" },
    { field: "status", label: "Status" },
    { field: "industry", label: "Industry" },
    { field: "use_case_count", label: "Use Cases" },
    { field: "credits", label: "$ Spend" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-slate-50/40">
      <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {currentUser?.role === "acem" ? "All Accounts" : "My Accounts"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Showing {filtered.length} of {roleScoped.length} accounts
          </p>
        </div>
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-2.5 border-b border-slate-100 bg-white">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search accounts…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white w-52 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select value={engFilter} onChange={(e) => setEngFilter(e.target.value)}
          className="py-1.5 pl-2.5 pr-7 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
          {ENGAGEMENT_OPTIONS.map((o) => <option key={o} value={o}>{o === "All" ? "All engagements" : o}</option>)}
        </select>

        <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((s) => {
            const active = statusFilter.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setStatusFilter((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                  )
                }
                aria-pressed={active}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? STATUS_BADGE[s] ?? "bg-slate-100 text-slate-700 border-slate-200"
                    : "bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:border-slate-300"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}
          className="py-1.5 pl-2.5 pr-7 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
          {industries.map((o) => <option key={o} value={o}>{o === "All" ? "All industries" : o}</option>)}
        </select>

        {currentUser?.role === "acem" && (
          <select value={aceFilter} onChange={(e) => setAceFilter(e.target.value)}
            className="py-1.5 pl-2.5 pr-7 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
            {aces.map((o) => <option key={o.id} value={o.id}>{o.id === "All" ? "All ACEs" : o.label}</option>)}
          </select>
        )}

        <button
          type="button"
          onClick={refreshBook}
          disabled={bookRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50 ml-auto"
        >
          <RefreshCw size={13} className={bookRefreshing ? "animate-spin" : ""} />
          {bookRefreshing ? "Refreshing…" : "Refresh Book"}
        </button>

        {hasFilters && (
          <button type="button"
            onClick={() => { setSearch(""); setStatusFilter(DEFAULT_STATUS_FILTER); setEngFilter("All"); setIndustryFilter("All"); setAceFilter("All"); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 px-6 py-4">
        {accsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {COL_HEADERS.map(({ field, label }) => (
                    <th key={field} scope="col"
                      className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 select-none"
                      onClick={() => toggleSort(field)}>
                      <span className="flex items-center gap-1">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      No accounts match your filters.
                    </td>
                  </tr>
                ) : sorted.map((account) => {
                  const isExpanded = expandedIds.has(account.account_id);
                  const ucs = useCasesByAccount[account.account_id] ?? [];
                  const rev = (revSummaries as Record<string, RevenueSummary>)[account.account_id];
                  const sigCounts = (signalCounts as Record<string, SignalCountEntry>)[account.account_id];
                  return (
                    <Fragment key={account.account_id}>
                      <tr
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 cursor-pointer ${isExpanded ? "bg-slate-50" : ""}`}
                        onClick={(e) => toggleExpand(account.account_id, e)}
                      >
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                          <Link
                            href={`/accounts/${account.account_id}`}
                            className="hover:text-sky-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {account.account_name}
                          </Link>
                          <p className="text-xs text-slate-400 font-normal mt-0.5">
                            {(aceDisplayNames as Record<string, string>)[account.ace_assigned] ?? account.ace_assigned}
                          </p>
                          {(sigCounts || account.new_adoption_30d) && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {sigCounts && sigCounts.high > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  <AlertTriangle size={9} />{sigCounts.high}
                                </span>
                              )}
                              {sigCounts && sigCounts.high === 0 && sigCounts.medium > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  <AlertTriangle size={9} />{sigCounts.medium}
                                </span>
                              )}
                              {account.new_adoption_30d && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                                  <Zap size={9} />adoption
                                </span>
                              )}
                              {(account.upcoming_meetings_5d ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <CalendarCheck2 size={9} />{account.upcoming_meetings_5d}
                                </span>
                              )}
                              {account.email_trend === "declining" && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                  <Mail size={9} />↓
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <EngagementCell status={account.engagement_status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={account.status} />
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{account.industry}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums font-medium">{account.use_case_count}</td>
                        <td className="px-4 py-3.5">
                          <SpendBar rev={rev} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <ExpandedRow account={account} useCases={ucs} rev={rev} sigCounts={sigCounts} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default withFlagGate(AccountsPage, "page_accounts_list");
