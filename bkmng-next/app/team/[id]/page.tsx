"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useAccounts, useUseCases, useAceDisplayNames } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Account = { account_id: string; account_name: string; status: string; engagement_status: string; ace_assigned: string; total_credits_allocated: number };
type UseCase = { use_case_id: string; account_id: string; account_name: string; use_case_name: string; stage: string; status: string; target_go_live_date: string | null };

function StatusDot({ status }: { status: string }) {
  const cls = status === "Active" || status === "Go Live" ? "bg-emerald-500"
    : status === "At Risk" ? "bg-amber-500"
    : status === "Onboarding" ? "bg-sky-500" : "bg-slate-300";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} />;
}

function StageChip({ stage }: { stage: string }) {
  const cls = stage === "Deployed" ? "bg-emerald-50 text-emerald-700"
    : stage === "Impl In Progress" ? "bg-sky-50 text-sky-700"
    : stage === "Impl Pending" ? "bg-slate-100 text-slate-600"
    : stage === "Go-Live" ? "bg-violet-50 text-violet-700"
    : "bg-slate-50 text-slate-500";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{stage}</span>;
}

function creditsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

export default function TeamMemberPage() {
  const params = useParams<{ id: string }>();
  const aceId = params?.id ?? "";

  const { data: accounts = [] } = useAccounts() as { data: Account[] };
  const { data: useCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };

  const name = (aceDisplayNames as Record<string, string>)[aceId] ?? aceId;
  const myAccounts = useMemo(() => (accounts as Account[]).filter((a) => a.ace_assigned === aceId), [accounts, aceId]);
  const myAccountIds = useMemo(() => new Set(myAccounts.map((a) => a.account_id)), [myAccounts]);
  const myUseCases = useMemo(() => (useCases as UseCase[]).filter((uc) => myAccountIds.has(uc.account_id)), [useCases, myAccountIds]);

  const stats = useMemo(() => ({
    accounts: myAccounts.length,
    useCases: myUseCases.length,
    deployed: myUseCases.filter((uc) => uc.stage === "Deployed").length,
    inProgress: myUseCases.filter((uc) => uc.stage === "Impl In Progress" || uc.stage === "Impl Pending").length,
    blocked: myUseCases.filter((uc) => uc.status === "Blocked").length,
    atRisk: myAccounts.filter((a) => a.status === "At Risk").length,
  }), [myAccounts, myUseCases]);

  const upcomingGoLives = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...myUseCases]
      .filter((uc) => uc.target_go_live_date && uc.target_go_live_date >= today)
      .sort((a, b) => (a.target_go_live_date ?? "").localeCompare(b.target_go_live_date ?? ""))
      .slice(0, 5);
  }, [myUseCases]);

  return (
    <div className="min-h-full bg-slate-50/50">
      <div className="px-6 py-6 space-y-3">
        <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to Team
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{aceId}</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Accounts", value: stats.accounts, cls: "text-slate-900" },
            { label: "Use Cases", value: stats.useCases, cls: "text-slate-900" },
            { label: "Deployed", value: stats.deployed, cls: "text-emerald-600" },
            { label: "In Progress", value: stats.inProgress, cls: "text-sky-600" },
            { label: "Blocked", value: stats.blocked, cls: "text-red-600" },
            { label: "At Risk", value: stats.atRisk, cls: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-center">
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Building2 size={14} style={{ color: "var(--snow-500)" }} /> Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No accounts.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myAccounts.map((acc) => (
                  <Link key={acc.account_id} href={`/accounts/${acc.account_id}`}
                    className="grid grid-cols-[auto_1fr_auto] gap-2 items-center py-2 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors">
                    <StatusDot status={acc.status} />
                    <span className="text-sm font-medium text-slate-800 truncate hover:text-sky-600">{acc.account_name}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{creditsShort(acc.total_credits_allocated)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} style={{ color: "var(--snow-500)" }} /> Upcoming Go-Lives
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingGoLives.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No upcoming go-lives.</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingGoLives.map((uc) => (
                    <li key={uc.use_case_id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{uc.use_case_name}</p>
                        <p className="text-xs text-slate-500">{uc.account_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StageChip stage={uc.stage} />
                        <span className="text-xs text-slate-500 tabular-nums">{uc.target_go_live_date}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" /> Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.blocked === 0 && stats.atRisk === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 size={14} /> All accounts on track
                </p>
              ) : (
                <ul className="space-y-2">
                  {myUseCases.filter((uc) => uc.status === "Blocked").map((uc) => (
                    <li key={uc.use_case_id} className="flex gap-2 items-start text-sm">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <p className="text-slate-800">{uc.use_case_name} is blocked</p>
                        <p className="text-xs text-slate-500">{uc.account_name}</p>
                      </div>
                    </li>
                  ))}
                  {myAccounts.filter((a) => a.status === "At Risk").map((acc) => (
                    <li key={acc.account_id} className="flex gap-2 items-start text-sm">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <Link href={`/accounts/${acc.account_id}`} className="text-slate-800 hover:text-sky-600 hover:underline">
                        {acc.account_name} is at risk
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
