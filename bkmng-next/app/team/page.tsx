"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BarChart3, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAccounts, useUseCases, useAceDisplayNames } from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { withFlagGate } from "@/components/ui/flag-gate";

type Account = { account_id: string; account_name: string; status: string; ace_assigned: string };
type UseCase = { use_case_id: string; account_id: string; stage: string; status: string };

function StatusDot({ status }: { status: string }) {
  const cls = status === "Active" || status === "Go Live" ? "bg-emerald-500"
    : status === "At Risk" ? "bg-amber-500"
    : status === "Onboarding" ? "bg-sky-500" : "bg-slate-300";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${cls}`} title={status} />;
}

function TeamPage() {
  const { currentUser } = useAuth();
  const isManager = currentUser?.role === "acem";

  const { data: accounts = [] } = useAccounts() as { data: Account[] };
  const { data: useCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };

  const aceIds = useMemo(() => [...new Set((accounts as Account[]).map((a) => a.ace_assigned))].sort(), [accounts]);

  const teamCards = useMemo(() => aceIds.map((aceId) => {
    const name = (aceDisplayNames as Record<string, string>)[aceId] ?? aceId;
    const myAccounts = (accounts as Account[]).filter((a) => a.ace_assigned === aceId);
    const accountIds = new Set(myAccounts.map((a) => a.account_id));
    const myUseCases = (useCases as UseCase[]).filter((uc) => accountIds.has(uc.account_id));
    return {
      aceId, name,
      accountCount: myAccounts.length,
      useCaseCount: myUseCases.length,
      deployed: myUseCases.filter((uc) => uc.stage === "Deployed").length,
      inProgress: myUseCases.filter((uc) => uc.stage === "Impl In Progress" || uc.stage === "Impl Pending").length,
      blocked: myUseCases.filter((uc) => uc.status === "Blocked").length,
      atRisk: myAccounts.filter((a) => a.status === "At Risk").length,
      accounts: myAccounts,
    };
  }), [aceIds, accounts, useCases, aceDisplayNames]);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Users size={32} className="text-slate-300" />
        <p className="text-slate-500">Team view is only available to managers.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-5 border-b border-slate-100">
        <h1 className="text-xl font-semibold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500 mt-0.5">{aceIds.length} account executives</p>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teamCards.map((m) => (
          <Link key={m.aceId} href={`/team/${m.aceId}`}>
            <Card className="group hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900 group-hover:text-sky-600">{m.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.aceId}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {m.accounts.map((a) => <StatusDot key={a.account_id} status={a.status} />)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center mt-4 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xl font-bold text-slate-900">{m.accountCount}</p>
                    <p className="text-xs text-slate-500">Accounts</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900">{m.useCaseCount}</p>
                    <p className="text-xs text-slate-500">Use Cases</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-600">{m.deployed}</p>
                    <p className="text-xs text-slate-500">Deployed</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-3 text-xs">
                  <span className="flex items-center gap-1 text-sky-600">
                    <BarChart3 size={11} />{m.inProgress} in progress
                  </span>
                  {m.blocked > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle size={11} />{m.blocked} blocked
                    </span>
                  )}
                  {m.atRisk > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle size={11} />{m.atRisk} at risk
                    </span>
                  )}
                  {m.blocked === 0 && m.atRisk === 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={11} />All on track
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default withFlagGate(TeamPage, "page_team");
