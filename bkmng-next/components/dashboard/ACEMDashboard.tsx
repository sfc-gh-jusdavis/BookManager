"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Building2, CheckCircle2, AlertTriangle, CalendarCheck,
  BarChart3, Users, ShieldAlert, GitPullRequestArrow,
} from "lucide-react";
import { useAccounts, useUseCases, useForecasts, useAceDisplayNames } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Account = { account_id: string; account_name: string; status: string; ace_assigned: string };
type UseCase = {
  use_case_id: string; account_id: string; account_name: string;
  use_case_name: string; stage: string; status: string; target_go_live_date: string | null;
};
type Forecast = {
  use_case_id: string; account_id: string; auto_category: string;
  override_category: string | null; override_by: string | null;
  override_note: string | null; pending_approval: boolean;
};

const PIPELINE_STAGES = [
  "Discovery","Scoping","Technical Win","Use Case Won",
  "Impl Pending","Impl In Progress","Go-Live","Deployed",
] as const;

const TODAY = new Date().toISOString().slice(0, 10);

function StatusDot({ status }: { status: string }) {
  const cls = status === "Active" || status === "Go Live" ? "bg-emerald-500"
    : status === "At Risk" ? "bg-amber-500"
    : status === "Onboarding" ? "bg-sky-500" : "bg-slate-300";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} title={status} />;
}

function KPICard({ label, value, icon, colorClass }: { label: string; value: string | number; icon: React.ReactNode; colorClass: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm text-slate-500 font-normal flex items-center gap-1.5">
          <span className={colorClass}>{icon}</span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function WidgetCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <span style={{ color: "var(--snow-500)" }}>{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function effectiveCategory(f: Forecast): string {
  return f.override_category ?? f.auto_category;
}

export function ACEMDashboard() {
  const { data: allAccounts = [] } = useAccounts() as { data: Account[] };
  const { data: allUseCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: forecasts = [] } = useForecasts() as { data: Forecast[] };
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };

  const kpis = useMemo(() => {
    const total = (allAccounts as Account[]).length;
    const onTrack = (allAccounts as Account[]).filter((a) => a.status === "Active" || a.status === "Go Live").length;
    const atRisk = (allAccounts as Account[]).filter((a) => a.status === "At Risk").length;
    const goLivesThisMonth = (allUseCases as UseCase[]).filter((uc) => {
      if (!uc.target_go_live_date) return false;
      const [y, m] = uc.target_go_live_date.split("-").map(Number);
      const now = new Date();
      return y === now.getFullYear() && m === now.getMonth() + 1;
    }).length;
    return { total, onTrackPct: total ? Math.round((onTrack / total) * 100) : 0, atRisk, goLivesThisMonth };
  }, [allAccounts, allUseCases]);

  const pipelineData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of PIPELINE_STAGES) counts.set(s, 0);
    for (const uc of allUseCases as UseCase[]) counts.set(uc.stage, (counts.get(uc.stage) ?? 0) + 1);
    return PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  }, [allUseCases]);

  const aceIds = useMemo(() => [...new Set((allAccounts as Account[]).map((a) => a.ace_assigned))].sort(), [allAccounts]);

  const teamCards = useMemo(() => aceIds.map((aceId) => {
    const name = (aceDisplayNames as Record<string, string>)[aceId] ?? aceId;
    const accounts = (allAccounts as Account[]).filter((a) => a.ace_assigned === aceId);
    const accountIds = new Set(accounts.map((a) => a.account_id));
    const useCases = (allUseCases as UseCase[]).filter((uc) => accountIds.has(uc.account_id));
    const blocked = useCases.filter((uc) => uc.status === "Blocked").length;
    const atRiskAccs = accounts.filter((a) => a.status === "At Risk").length;
    const deployed = useCases.filter((uc) => uc.stage === "Deployed").length;
    const inProgress = useCases.filter((uc) => uc.stage === "Impl In Progress" || uc.stage === "Impl Pending").length;
    return { aceId, name, accountCount: accounts.length, useCaseCount: useCases.length, deployed, inProgress, blocked, atRisk: atRiskAccs, accounts };
  }), [aceIds, allAccounts, allUseCases, aceDisplayNames]);

  const managerAlerts = useMemo(() => {
    const alerts: { id: string; kind: "blocked" | "overdue" | "at-risk"; message: string; accountId: string }[] = [];
    const blockedMap = new Map<string, { name: string; count: number }>();
    for (const uc of allUseCases as UseCase[]) {
      if (uc.status !== "Blocked") continue;
      const cur = blockedMap.get(uc.account_id) ?? { name: uc.account_name, count: 0 };
      cur.count++; blockedMap.set(uc.account_id, cur);
    }
    for (const [id, v] of blockedMap) {
      alerts.push({ id: `b-${id}`, kind: "blocked", message: `${v.name} has ${v.count} blocked use case${v.count === 1 ? "" : "s"}`, accountId: id });
    }
    for (const uc of allUseCases as UseCase[]) {
      if (uc.target_go_live_date && uc.target_go_live_date < TODAY)
        alerts.push({ id: `o-${uc.use_case_id}`, kind: "overdue", message: `${uc.use_case_name} @ ${uc.account_name} is past target`, accountId: uc.account_id });
    }
    for (const acc of allAccounts as Account[]) {
      if (acc.status === "At Risk")
        alerts.push({ id: `r-${acc.account_id}`, kind: "at-risk", message: `${acc.account_name} marked At Risk`, accountId: acc.account_id });
    }
    return alerts;
  }, [allUseCases, allAccounts]);

  const pendingAdjustments = useMemo(() => (forecasts as Forecast[]).filter((f) => f.pending_approval).map((f) => {
    const uc = (allUseCases as UseCase[]).find((u) => u.use_case_id === f.use_case_id);
    return { ...f, useCaseName: uc?.use_case_name ?? f.use_case_id, accountName: uc?.account_name ?? f.account_id, submitterName: (aceDisplayNames as Record<string, string>)[f.override_by ?? ""] ?? f.override_by ?? "Unknown" };
  }), [forecasts, allUseCases, aceDisplayNames]);

  const catClass = (cat: string) =>
    cat === "Commit" ? "bg-emerald-50 text-emerald-700" : cat === "Most Likely" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";

  return (
    <>
      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-500">Account health across your team</p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Total Accounts" value={kpis.total} icon={<Building2 size={14} />} colorClass="text-sky-600" />
        <KPICard label="On Track" value={`${kpis.onTrackPct}%`} icon={<CheckCircle2 size={14} />} colorClass="text-emerald-600" />
        <KPICard label="At Risk" value={kpis.atRisk} icon={<AlertTriangle size={14} />} colorClass="text-amber-600" />
        <KPICard label="Go-Lives This Month" value={kpis.goLivesThisMonth} icon={<CalendarCheck size={14} />} colorClass="text-violet-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WidgetCard title="Team Pipeline" icon={<BarChart3 size={15} />}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={pipelineData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" fill="#29B5E8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        <WidgetCard title="Team Members" icon={<Users size={15} />}>
          <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
            {teamCards.map((m) => (
              <Link key={m.aceId} href={`/team/${m.aceId}`}
                className="group rounded-lg border border-slate-100 p-3 hover:border-slate-200 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-800 group-hover:text-sky-600">{m.name}</p>
                  <span className="flex gap-1">
                    {m.accounts.map((a) => <StatusDot key={a.account_id} status={a.status} />)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs text-slate-500">
                  <span><span className="font-semibold text-slate-700">{m.accountCount}</span> accts</span>
                  <span><span className="font-semibold text-slate-700">{m.inProgress}</span> active</span>
                  <span><span className="font-semibold text-emerald-600">{m.deployed}</span> deployed</span>
                  {m.blocked > 0 ? <span className="text-red-600 font-medium">{m.blocked} blocked</span> : <span />}
                </div>
              </Link>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Manager Alerts" icon={<ShieldAlert size={15} />}>
          {managerAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No active alerts.</p>
          ) : (
            <ul className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {managerAlerts.map((alert) => (
                <li key={alert.id} className="flex gap-2 items-start">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${alert.kind === "blocked" ? "bg-red-500" : "bg-amber-500"}`} />
                  <Link href={`/accounts/${alert.accountId}`} className="text-sm text-slate-700 hover:text-sky-600 hover:underline leading-snug">
                    {alert.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>

        <WidgetCard title="Pending Forecast Adjustments" icon={<GitPullRequestArrow size={15} />}>
          {pendingAdjustments.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No pending adjustments.</p>
          ) : (
            <ul className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {pendingAdjustments.map((adj) => (
                <li key={adj.use_case_id} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-700">{adj.useCaseName}</p>
                  <p className="text-xs text-slate-500 mb-1">{adj.accountName}</p>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">by {adj.submitterName}</span>
                    <span className="rounded-full px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px]">{adj.auto_category}</span>
                    <span className="text-slate-400">→</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catClass(effectiveCategory(adj))}`}>{effectiveCategory(adj)}</span>
                  </div>
                  <Link href="/forecasts" className="inline-block mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5 hover:bg-emerald-100">Review</Link>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>
    </div>
    </>
  );
}
