"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, FileText, Clock, CheckCircle2, AlertTriangle, HelpCircle, User } from "lucide-react";
import { useTMRs } from "@/hooks/useApi";
import type { TMR } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-sky-50 text-sky-700 border-sky-200",
  "Pending Manager Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Pending Specialist Manager Review": "bg-amber-50 text-amber-700 border-amber-200",
  "Clarification Needed": "bg-orange-50 text-orange-700 border-orange-200",
  "Closed": "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  "New": FileText,
  "Pending Manager Review": Clock,
  "Pending Specialist Manager Review": Clock,
  "Clarification Needed": HelpCircle,
  "Closed": CheckCircle2,
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const Icon = STATUS_ICONS[status] ?? AlertTriangle;
  const label = status === "Pending Specialist Manager Review" ? "Pending Spec. Review" : status;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon size={10} />{label}
    </span>
  );
}

function AssignedCell({ tmr }: { tmr: TMR }) {
  const name = tmr.assigned_resource_name ?? tmr.assigned_resource_email;
  if (!name) return <span className="text-slate-400 text-sm">Unassigned</span>;
  return (
    <div>
      <p className="text-sm text-slate-800">{name}</p>
      {tmr.assigned_resource_name && tmr.assigned_resource_email && (
        <p className="text-[11px] text-slate-400">{tmr.assigned_resource_email}</p>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  "All", "New", "Pending Manager Review", "Pending Specialist Manager Review",
  "Clarification Needed", "Closed",
];

export default function TMRsPage() {
  const { data: tmrs = [], isLoading } = useTMRs() as { data: TMR[]; isLoading: boolean };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tmrs.filter((t) => {
      if (q && !t.account_name.toLowerCase().includes(q)
        && !(t.activity_requested ?? "").toLowerCase().includes(q)
        && !(t.assigned_resource_name ?? "").toLowerCase().includes(q)
        && !(t.assigned_resource_email ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tmrs, search, statusFilter]);

  const stats = useMemo(() => {
    const open = tmrs.filter((t) => t.status !== "Closed").length;
    const pending = tmrs.filter((t) =>
      t.status === "Pending Manager Review" || t.status === "Pending Specialist Manager Review"
    ).length;
    const newCount = tmrs.filter((t) => t.status === "New").length;
    const closed = tmrs.filter((t) => t.status === "Closed").length;
    return { total: tmrs.length, open, pending, newCount, closed };
  }, [tmrs]);

  const hasFilters = search || statusFilter !== "All";

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">TMRs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Technical Milestone Requests — Account Engineer engagements</p>
      </div>

      <div className="px-6 py-4 grid grid-cols-2 xl:grid-cols-4 gap-3 border-b border-slate-100">
        {[
          { label: "Total", value: stats.total, cls: "text-slate-900" },
          { label: "Open", value: stats.open, cls: "text-sky-600" },
          { label: "Pending Review", value: stats.pending, cls: "text-amber-600" },
          { label: "Closed", value: stats.closed, cls: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-4 py-3">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search account or specialist…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white w-56 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="py-1.5 pl-2.5 pr-6 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "All" ? "Status: All" : o}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("All"); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Account", "Activity Requested", "Status", "Assigned To", "Requestor", "Requested Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                      No TMRs match your filters.
                    </td>
                  </tr>
                ) : filtered.map((tmr) => (
                  <tr key={tmr.tmr_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/accounts/${tmr.account_id}`}
                        className="text-sm font-medium text-slate-800 hover:text-sky-600 hover:underline"
                      >
                        {tmr.account_name}
                      </Link>
                      {tmr.engagement_type && (
                        <p className="text-xs text-slate-400 mt-0.5">{tmr.engagement_type}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[200px]">
                      <p className="truncate">{tmr.activity_requested ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={tmr.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <AssignedCell tmr={tmr} />
                    </td>
                    <td className="px-4 py-3.5">
                      {tmr.requestor ? (
                        <div>
                          <p className="text-sm text-slate-700">{tmr.requestor}</p>
                          {tmr.requestor_email && (
                            <p className="text-[11px] text-slate-400">{tmr.requestor_email}</p>
                          )}
                        </div>
                      ) : <span className="text-sm text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDate(tmr.requested_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
