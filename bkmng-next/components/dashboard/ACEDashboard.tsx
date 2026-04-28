"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, TrendingUp, CalendarClock, Zap,
  Sparkles, PhoneMissed, TrendingDown, ShieldAlert, CalendarCheck2,
  MessageSquare, ChevronRight, Cpu, CheckCheck, X, Activity, Clock,
  Mail, CalendarX, ClipboardList, FileText, Calendar, GanttChart,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PRIORITY_COLORS, PRIORITY_LABEL } from "@/components/alerts/AlertRow";
import {
  useAccounts, useUseCases, useGongCalls, useNBA, useSituations,
  useRecentAdoptions, useAlerts, useAlertCount,
  useMarkAlertRead, useDismissAlert,
  type GongCall, type NBAItem, type NBAResponse, type FeatureAdoption, type AlertItem, type CompositePattern,
} from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── types ────────────────────────────────────────────────────────────────────
type Account = {
  account_id: string; account_name: string; status: string;
  engagement_status: string; total_credits_allocated: number;
  ace_assigned: string;
  meetings_last_30d: number; upcoming_meetings_5d: number;
  last_meeting_date: string | null; emails_last_30d: number;
  last_email_date: string | null; email_trend: string | null;
  engagement_start_date?: string | null;
  rolloff_date?: string | null;
};
type UseCase = {
  use_case_id: string; account_id: string; account_name: string;
  use_case_name: string; stage: string; status: string;
  go_live_date: string | null; target_go_live_date: string | null;
  implementation_start_date: string | null;
  ps_notes_summary: string | null;
};

// ─── constants ────────────────────────────────────────────────────────────────
const SIGNAL_LABELS: Record<string, string> = {
  open_sev1_ticket: "Sev-1 Ticket",
  open_sev2_ticket: "Sev-2 Ticket",
  escalated_ticket: "Escalated",
  long_running_ticket: "Long-Running Ticket",
  ticket_volume_spike: "Ticket Volume",
  no_interaction_14d: "No Interaction (14d)",
  no_interaction_7d: "No Interaction (7d)",
  champion_silent: "Champion Silent",
  capacity_warning: "Capacity Warning",
  consumption_spike: "Consumption Spike",
  consumption_dip: "Consumption Dip",
  contract_ending: "Contract Ending",
  expansion_signal: "Expansion Signal",
  new_feature_adoption: "Feature Adoption",
  go_live_approaching: "Go-Live Approaching",
  open_tmr: "Open TMR",
  blocker: "Blocker",
  at_risk: "At Risk",
  use_case_no_go_live: "Missing Go-Live",
  use_case_no_impl_start: "Missing Impl Start",
  use_case_stale_notes: "Stale Notes",
  stage_stalled: "Stage Stalled",
  upcoming_meeting: "Upcoming Meeting",
  no_upcoming_meeting: "No Meeting Scheduled",
  meeting_momentum: "Meeting Momentum",
  email_silence: "Email Silence",
  email_declining: "Email Declining",
  security_gap_critical: "Security Gap (Critical)",
  security_gap_high: "Security Gap (High)",
};

const SIGNAL_CATEGORY: Record<string, string> = {
  open_sev1_ticket: "support", open_sev2_ticket: "support",
  escalated_ticket: "support", long_running_ticket: "support",
  ticket_volume_spike: "support",
  no_interaction_14d: "engagement", no_interaction_7d: "engagement",
  champion_silent: "engagement",
  consumption_spike: "consumption", consumption_dip: "consumption",
  capacity_warning: "consumption", contract_ending: "consumption",
  expansion_signal: "expansion", new_feature_adoption: "expansion",
  go_live_approaching: "go_live",
  open_tmr: "use_case", blocker: "use_case", at_risk: "use_case",
  use_case_no_go_live: "use_case", use_case_no_impl_start: "use_case", use_case_stale_notes: "use_case", stage_stalled: "use_case",
  upcoming_meeting: "engagement", no_upcoming_meeting: "engagement",
  meeting_momentum: "engagement", email_silence: "engagement",
  email_declining: "engagement",
  security_gap_critical: "support", security_gap_high: "support",
};

const MS_PER_DAY = 86_400_000;
const TERMINAL_STAGE_PREFIXES = ["0 -", "7 - Deployed", "8 -"];
function isTerminalStage(stage: string) {
  return TERMINAL_STAGE_PREFIXES.some((p) => stage.startsWith(p));
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
function fmtDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── signal icon ──────────────────────────────────────────────────────────────
function SignalIcon({ type, size = 13 }: { type: string; size?: number }) {
  const base = "shrink-0 mt-0.5";
  if (type === "open_sev1_ticket" || type === "escalated_ticket")
    return <ShieldAlert size={size} className={`${base} text-red-500`} />;
  if (type === "open_sev2_ticket")
    return <AlertTriangle size={size} className={`${base} text-orange-500`} />;
  if (type === "long_running_ticket" || type === "ticket_volume_spike")
    return <Clock size={size} className={`${base} text-amber-500`} />;
  if (type === "no_interaction_14d" || type === "no_interaction_7d" || type === "champion_silent")
    return <PhoneMissed size={size} className={`${base} text-slate-400`} />;
  if (type === "capacity_warning")
    return <AlertTriangle size={size} className={`${base} text-emerald-600`} />;
  if (type === "consumption_spike")
    return <TrendingUp size={size} className={`${base} text-emerald-500`} />;
  if (type === "consumption_dip")
    return <TrendingDown size={size} className={`${base} text-amber-500`} />;
  if (type === "contract_ending")
    return <CalendarClock size={size} className={`${base} text-amber-600`} />;
  if (type === "go_live_approaching")
    return <CalendarCheck2 size={size} className={`${base} text-sky-500`} />;
  if (type === "open_tmr")
    return <MessageSquare size={size} className={`${base} text-orange-500`} />;
  if (type === "blocker")
    return <ShieldAlert size={size} className={`${base} text-red-600`} />;
  if (type === "at_risk")
    return <AlertTriangle size={size} className={`${base} text-amber-500`} />;
  if (type === "new_feature_adoption" || type === "expansion_signal")
    return <Sparkles size={size} className={`${base} text-violet-500`} />;
  if (type === "use_case_no_go_live" || type === "use_case_no_impl_start" || type === "use_case_stale_notes" || type === "stage_stalled")
    return <Activity size={size} className={`${base} text-slate-400`} />;
  if (type === "upcoming_meeting" || type === "meeting_momentum")
    return <CalendarCheck2 size={size} className={`${base} text-emerald-500`} />;
  if (type === "no_upcoming_meeting")
    return <CalendarX size={size} className={`${base} text-amber-500`} />;
  if (type === "email_silence")
    return <Mail size={size} className={`${base} text-amber-500`} />;
  if (type === "email_declining")
    return <TrendingDown size={size} className={`${base} text-rose-400`} />;
  if (type === "security_gap_critical")
    return <ShieldAlert size={size} className={`${base} text-red-600`} />;
  if (type === "security_gap_high")
    return <ShieldAlert size={size} className={`${base} text-orange-500`} />;
  return <Zap size={size} className={`${base} text-slate-400`} />;
}

// ─── priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low;
  const label = PRIORITY_LABEL[priority] ?? priority;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
      {children}
    </p>
  );
}

// ─── focus queue item ─────────────────────────────────────────────────────────
function FocusQueueItem({
  item, alert, onRead, onDismiss,
}: {
  item: NBAItem;
  alert?: AlertItem;
  onRead?: () => void;
  onDismiss?: () => void;
}) {
  const label = SIGNAL_LABELS[item.signal_type] ?? item.signal_type;
  const isUnread = alert && !alert.is_read;
  const borderCls = item.priority === "high"
    ? "border-l-red-400"
    : item.priority === "medium"
    ? "border-l-amber-400"
    : "border-l-slate-200";
  const nbaCtx = encodeURIComponent(
    JSON.stringify({ id: item.id, type: item.signal_type, text: item.text, summary: item.summary })
  );

  return (
    <div className={`border border-slate-100 border-l-2 ${borderCls} rounded-lg bg-white p-3 hover:bg-slate-50/80 transition-colors ${isUnread ? "bg-sky-50/20" : ""}`}>
      <div className="flex items-start gap-2">
        <SignalIcon type={item.signal_type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Link href={`/accounts/${item.account_id}`}
              className="text-[12px] font-semibold text-slate-800 hover:text-sky-700 truncate">
              {item.account_name}
            </Link>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded font-medium">{label}</span>
            <PriorityBadge priority={item.priority} />
            {isUnread && <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{item.summary || item.text}</p>
        </div>
        {alert && (
          <div className="flex gap-1 shrink-0">
            {isUnread && (
              <button onClick={onRead}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Mark read">
                <CheckCheck size={12} />
              </button>
            )}
            <button onClick={onDismiss}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-400 transition-colors"
              title="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={`/accounts/${item.account_id}?tab=assistant&nba=${nbaCtx}`}
          className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-700 font-medium">
          <Sparkles size={9} />
          Open with ACE
          <ChevronRight size={9} />
        </Link>
        <Link
          href={`/accounts/${item.account_id}`}
          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
          View Account
          <ChevronRight size={9} />
        </Link>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
type FocusFilter = "all" | "high" | "support" | "engagement" | "consumption" | "expansion";

export function ACEDashboard() {
  const { currentUser } = useAuth();
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");

  const { data: allAccounts = [] } = useAccounts() as { data: Account[] };
  const { data: allUseCases = [] } = useUseCases() as { data: UseCase[] };
  const { data: allGongCalls = [] } = useGongCalls() as { data: GongCall[] };
  const { data: nbaResponse, isLoading: nbaLoading } = useNBA() as { data: NBAResponse | undefined; isLoading: boolean };
  const clientItems = nbaResponse?.client ?? [];
  const adminItems = nbaResponse?.admin ?? [];
  const { data: situations = [] } = useSituations() as { data: CompositePattern[] };
  const { data: recentAdoptions = [] } = useRecentAdoptions(7) as { data: FeatureAdoption[] };
  const { data: alerts = [] } = useAlerts() as { data: AlertItem[] };
  const { data: alertCount } = useAlertCount() as { data: { count: number } | undefined };
  const { mutate: markRead } = useMarkAlertRead();
  const { mutate: dismiss } = useDismissAlert();

  const myAccounts = useMemo(() => allAccounts as Account[], [allAccounts]);
  const myAccountIds = useMemo(() => new Set(myAccounts.map((a) => a.account_id)), [myAccounts]);
  const myUseCases = useMemo(
    () => (allUseCases as UseCase[]).filter((uc) => myAccountIds.has(uc.account_id)),
    [allUseCases, myAccountIds]
  );
  const accountMap = useMemo(
    () => new Map(myAccounts.map((a) => [a.account_id, a])),
    [myAccounts]
  );

  const alertBySignalId = useMemo(
    () => new Map(alerts.filter((a) => a.signal_id).map((a) => [a.signal_id!, a])),
    [alerts]
  );

  const today = useMemo(() => startOfToday(), []);

  const upcomingGoLives = useMemo(() => {
    return [...myUseCases]
      .filter((uc) => {
        const d = uc.go_live_date ?? uc.target_go_live_date;
        return d && parseLocalDate(d) > today;
      })
      .sort((a, b) => {
        const da = a.go_live_date ?? a.target_go_live_date ?? "";
        const db = b.go_live_date ?? b.target_go_live_date ?? "";
        return parseLocalDate(da).getTime() - parseLocalDate(db).getTime();
      })
      .slice(0, 5);
  }, [myUseCases, today]);

  const recentCalls = useMemo(() => {
    const cutoff = today.getTime() - 7 * MS_PER_DAY;
    return (allGongCalls as GongCall[])
      .filter((c) => myAccountIds.has(c.account_id) && new Date(c.call_date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime())
      .slice(0, 4);
  }, [allGongCalls, myAccountIds, today]);

  const contractEndings = useMemo(
    () => clientItems.filter((i) => i.signal_type === "contract_ending"),
    [clientItems]
  );

  const upcomingMeetingAccounts = useMemo(
    () => myAccounts
      .filter((a) => (a.upcoming_meetings_5d ?? 0) > 0)
      .sort((a, b) => (b.upcoming_meetings_5d ?? 0) - (a.upcoming_meetings_5d ?? 0))
      .slice(0, 4),
    [myAccounts]
  );

  const hygieneUseCases = useMemo(
    () => myUseCases.filter((uc) => !isTerminalStage(uc.stage)),
    [myUseCases]
  );

  const missingPsNotes = useMemo(
    () => hygieneUseCases.filter((uc) => !uc.ps_notes_summary),
    [hygieneUseCases]
  );

  const missingDates = useMemo(
    () =>
      hygieneUseCases.filter(
        (uc) =>
          (!uc.go_live_date && !uc.target_go_live_date) ||
          !uc.implementation_start_date
      ),
    [hygieneUseCases]
  );

  const atRiskCount = myAccounts.filter(
    (a) => a.status === "At Risk" || a.engagement_status === "At Risk"
  ).length;

  const goLivesThisQ = myUseCases.filter((uc) => {
    const d = uc.go_live_date ?? uc.target_go_live_date;
    return d && d >= "2026-04-01" && d <= "2026-06-30";
  }).length;

  const highCount = clientItems.filter((i) => i.priority === "high").length;
  const unreadCount = alertCount?.count ?? 0;

  const brief = useMemo(() => {
    if (highCount === 0 && unreadCount === 0 && adminItems.length === 0)
      return "Your book looks healthy today — no urgent items.";
    const parts: string[] = [];
    if (highCount > 0) parts.push(`${highCount} high-priority signal${highCount !== 1 ? "s" : ""}`);
    if (unreadCount > 0) parts.push(`${unreadCount} unread alert${unreadCount !== 1 ? "s" : ""}`);
    if (adminItems.length > 0) parts.push(`${adminItems.length} admin task${adminItems.length !== 1 ? "s" : ""}`);
    return `${parts.join(", ")} need${parts.length === 1 && highCount === 1 ? "s" : ""} your attention.`;
  }, [highCount, unreadCount, adminItems.length]);

  const dayStr = useMemo(
    () => today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    [today]
  );

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const filterCounts: Record<FocusFilter, number> = useMemo(() => ({
    all: clientItems.length,
    high: clientItems.filter((i) => i.priority === "high").length,
    support: clientItems.filter((i) => SIGNAL_CATEGORY[i.signal_type] === "support").length,
    engagement: clientItems.filter((i) => SIGNAL_CATEGORY[i.signal_type] === "engagement").length,
    consumption: clientItems.filter((i) => SIGNAL_CATEGORY[i.signal_type] === "consumption").length,
    expansion: clientItems.filter((i) => SIGNAL_CATEGORY[i.signal_type] === "expansion").length,
  }), [clientItems]);

  const FILTER_LABELS: Record<FocusFilter, string> = {
    all: "All",
    high: "High",
    support: "Support",
    engagement: "Engagement",
    consumption: "Consumption",
    expansion: "Expansion",
  };

  const activeFilters = (Object.keys(filterCounts) as FocusFilter[]).filter(
    (k) => k === "all" || filterCounts[k] > 0
  );

  const focusItems = useMemo(() => {
    const seen = new Set<string>();
    return clientItems
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        if (focusFilter === "all") return true;
        if (focusFilter === "high") return item.priority === "high";
        return SIGNAL_CATEGORY[item.signal_type] === focusFilter;
      })
      .sort((a, b) => {
        const aAlert = alertBySignalId.get(a.id);
        const bAlert = alertBySignalId.get(b.id);
        const aUnread = aAlert && !aAlert.is_read ? 0 : 1;
        const bUnread = bAlert && !bAlert.is_read ? 0 : 1;
        if (aUnread !== bUnread) return aUnread - bUnread;
        const rank = { high: 0, medium: 1, low: 2 };
        return rank[a.priority] - rank[b.priority];
      });
  }, [clientItems, focusFilter, alertBySignalId]);

  const nextGoLiveDate = upcomingGoLives[0]
    ? (upcomingGoLives[0].go_live_date ?? upcomingGoLives[0].target_go_live_date)
    : null;

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {timeGreeting}, {currentUser?.display_name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{brief}</p>
        </div>
        <span className="text-xs text-slate-400 mt-1 shrink-0">{dayStr}</span>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/accounts" className="block">
          <Card className="hover:border-sky-200 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-sky-600">{myAccounts.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">My Accounts</p>
              {atRiskCount > 0
                ? <p className="text-[10px] text-amber-600 font-medium mt-1">{atRiskCount} at risk</p>
                : <p className="text-[10px] text-emerald-600 font-medium mt-1">All on track</p>
              }
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className={`text-2xl font-bold ${clientItems.length > 0 ? "text-violet-600" : "text-slate-400"}`}>
              {clientItems.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Active Signals</p>
            {highCount > 0
              ? <p className="text-[10px] text-red-500 font-medium mt-1">{highCount} high priority</p>
              : adminItems.length > 0
              ? <p className="text-[10px] text-slate-400 mt-1">{adminItems.length} admin tasks</p>
              : <p className="text-[10px] text-slate-400 mt-1">No urgent items</p>
            }
          </CardContent>
        </Card>

        <Link href="/alerts" className="block">
          <Card className="hover:border-sky-200 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <p className={`text-2xl font-bold ${unreadCount > 0 ? "text-red-600" : "text-slate-400"}`}>
                {unreadCount}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Unread Alerts</p>
              {unreadCount > 0
                ? <p className="text-[10px] text-sky-600 font-medium mt-1">View all →</p>
                : <p className="text-[10px] text-slate-400 mt-1">All clear</p>
              }
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-emerald-600">{goLivesThisQ}</p>
            <p className="text-xs text-slate-500 mt-0.5">Go-Lives This Q</p>
            {nextGoLiveDate
              ? <p className="text-[10px] text-sky-600 font-medium mt-1">Next: {fmtDate(nextGoLiveDate)}</p>
              : <p className="text-[10px] text-slate-400 mt-1">None scheduled</p>
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">

        {/* ── Focus Queue ──────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-sky-500" />
              <h2 className="text-sm font-semibold text-slate-800">Your Focus</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {focusItems.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeFilters.map((key) => (
                <button
                  key={key}
                  onClick={() => setFocusFilter(key)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                    focusFilter === key
                      ? "bg-sky-100 text-sky-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {FILTER_LABELS[key]}
                  {key !== "all" && filterCounts[key] > 0 && (
                    <span className="ml-1 opacity-60">({filterCounts[key]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Situations ───────────────────────────────────────────────── */}
          {situations.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Situations</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{situations.length}</span>
              </div>
              <div className="space-y-2">
                {situations.slice(0, 5).map((s) => (
                  <div key={s.pattern_id} className={`rounded-lg border p-3 ${
                    s.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    s.severity === 'high' ? 'border-orange-200 bg-orange-50' :
                    s.category === 'opportunity' ? 'border-green-200 bg-green-50' :
                    'border-slate-200 bg-slate-50'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold ${
                          s.severity === 'critical' ? 'text-red-600' :
                          s.severity === 'high' ? 'text-orange-600' :
                          s.category === 'opportunity' ? 'text-green-700' :
                          'text-slate-600'
                        }`}>{s.severity === 'critical' ? '🔴' : s.severity === 'high' ? '🟠' : s.category === 'opportunity' ? '🟢' : '🔵'}</span>
                        <span className="text-xs font-semibold text-slate-800">{s.pattern_name}</span>
                      </div>
                      <a href={`/accounts/${s.account_id}`} className="text-[10px] text-sky-600 hover:underline shrink-0">{s.account_name}</a>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-1">{s.description}</p>
                    <p className="text-[11px] text-slate-500"><span className="font-medium">→</span> {s.recommended_action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Signals ──────────────────────────────────────────────────────── */}
          {situations.length > 0 && focusItems.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Signals</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{focusItems.length}</span>
            </div>
          )}

          {nbaLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-4 animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-slate-100 rounded w-full mb-1" />
                  <div className="h-2 bg-slate-100 rounded w-4/6" />
                </div>
              ))}
            </div>
          ) : focusItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-10 text-center">
              <Zap size={22} className="text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {focusFilter === "all"
                  ? "No active signals — your book looks healthy."
                  : `No ${FILTER_LABELS[focusFilter].toLowerCase()} signals.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {focusItems.map((item) => {
                const alert = alertBySignalId.get(item.id);
                return (
                  <FocusQueueItem
                    key={item.id}
                    item={item}
                    alert={alert}
                    onRead={() => alert && markRead(alert.alert_id)}
                    onDismiss={() => alert && dismiss(alert.alert_id)}
                  />
                );
              })}
            </div>
          )}

          {/* ── Admin Tasks ──────────────────────────────────────────────────── */}
          {adminItems.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Admin Tasks</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{adminItems.length}</span>
              </div>
              <div className="space-y-1.5">
                {adminItems.map((item) => {
                  const label = SIGNAL_LABELS[item.signal_type] ?? item.signal_type;
                  return (
                    <div key={item.id} className="border border-slate-100 border-l-2 border-l-slate-200 rounded-lg bg-white px-3 py-2 hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-2">
                        <SignalIcon type={item.signal_type} size={11} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/accounts/${item.account_id}`}
                              className="text-[11px] font-medium text-slate-700 hover:text-sky-700 truncate">
                              {item.account_name}
                            </Link>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">{label}</span>
                          </div>
                          {item.summary && (
                            <p className="text-[10px] text-slate-400 leading-snug truncate mt-0.5">{item.summary}</p>
                          )}
                        </div>
                        <Link href={`/accounts/${item.account_id}`}
                          className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0">
                          <ChevronRight size={11} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <CalendarClock size={13} className="text-sky-500" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingMeetingAccounts.length > 0 && (
                <div>
                  <SectionLabel>Upcoming Meetings (14d)</SectionLabel>
                  <div className="space-y-1.5">
                    {upcomingMeetingAccounts.map((acc) => (
                      <Link key={acc.account_id} href={`/accounts/${acc.account_id}`}
                        className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CalendarCheck2 size={10} className="text-emerald-500 shrink-0" />
                          <p className="text-[11px] text-slate-700 truncate">{acc.account_name}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-600 shrink-0 ml-2">
                          {acc.upcoming_meetings_5d}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {upcomingGoLives.length > 0 && (
                <div>
                  <SectionLabel>Go-Lives</SectionLabel>
                  <div className="space-y-1.5">
                    {upcomingGoLives.slice(0, 4).map((uc) => {
                      const glDate = uc.go_live_date ?? uc.target_go_live_date!;
                      const days = daysBetween(today, parseLocalDate(glDate));
                      const dayColor = days > 14 ? "text-emerald-600" : days >= 7 ? "text-amber-600" : "text-red-600";
                      return (
                        <Link key={uc.use_case_id} href={`/accounts/${uc.account_id}`}
                          className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{uc.use_case_name}</p>
                            <p className="text-[10px] text-sky-600 truncate">{uc.account_name}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className={`text-[10px] font-semibold ${dayColor}`}>{days}d</p>
                            <p className="text-[10px] text-slate-400">{fmtDate(glDate)}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {contractEndings.length > 0 && (
                <div>
                  <SectionLabel>Contract Endings</SectionLabel>
                  <div className="space-y-1.5">
                    {contractEndings.slice(0, 3).map((item) => (
                      <Link key={item.id} href={`/accounts/${item.account_id}`}
                        className="flex items-center gap-2 hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
                        <CalendarClock size={11} className="text-amber-500 shrink-0" />
                        <p className="text-[11px] text-slate-700 truncate flex-1">{item.account_name}</p>
                        <ChevronRight size={10} className="text-slate-300 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {upcomingGoLives.length === 0 && contractEndings.length === 0 && upcomingMeetingAccounts.length === 0 && (
                <p className="text-xs text-slate-400 py-1">Nothing scheduled soon.</p>
              )}
            </CardContent>
          </Card>

          {/* Opportunities */}
          {recentAdoptions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-violet-500" />
                  Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SectionLabel>New Feature Adoptions (7d)</SectionLabel>
                <div className="space-y-1.5">
                  {recentAdoptions.slice(0, 5).map((fa, i) => (
                    <Link key={`${fa.account_id}-${fa.feature_raw}-${i}`}
                      href={`/accounts/${fa.account_id}`}
                      className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-700 truncate">{fa.feature_name}</p>
                        <p className="text-[10px] text-sky-600 truncate">{fa.account_name}</p>
                      </div>
                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {fa.category}
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          {recentCalls.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Activity size={13} className="text-emerald-500" />
                  Recent Calls (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {recentCalls.map((call) => {
                    const dateStr = call.call_date.split("T")[0]!;
                    const daysAgo = daysBetween(parseLocalDate(dateStr), today);
                    const acc = accountMap.get(call.account_id);
                    return (
                      <Link key={call.call_id} href={`/accounts/${call.account_id}`}
                        className="flex items-start gap-2 hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors">
                        <MessageSquare size={11} className="text-slate-300 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-slate-700 truncate">
                            {acc?.account_name ?? call.account_id}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{call.title ?? "Gong call"}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Use Case Hygiene */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ClipboardList size={13} className="text-amber-500" />
                Use Case Hygiene
                {(missingPsNotes.length + missingDates.length) > 0 ? (
                  <span className="ml-auto text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                    {missingPsNotes.length + missingDates.length} items
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] font-normal text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                    all clear
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingPsNotes.length === 0 && missingDates.length === 0 && (
                <p className="text-xs text-slate-400 py-1">No hygiene issues — all active use cases have PS notes and dates.</p>
              )}
              {missingPsNotes.length > 0 && (
                  <div>
                    <SectionLabel>Missing PS Notes ({missingPsNotes.length})</SectionLabel>
                    <div className="space-y-1">
                      {missingPsNotes.slice(0, 4).map((uc) => (
                        <Link
                          key={uc.use_case_id}
                          href={`/accounts/${uc.account_id}`}
                          className="flex items-start gap-1.5 hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors"
                        >
                          <FileText size={10} className="text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-slate-700 truncate">{uc.use_case_name}</p>
                            <p className="text-[10px] text-sky-600 truncate">{uc.account_name}</p>
                          </div>
                        </Link>
                      ))}
                      {missingPsNotes.length > 4 && (
                        <p className="text-[10px] text-slate-400 pl-4">+{missingPsNotes.length - 4} more</p>
                      )}
                    </div>
                  </div>
                )}
                {missingDates.length > 0 && (
                  <div>
                    <SectionLabel>Missing Dates ({missingDates.length})</SectionLabel>
                    <div className="space-y-1">
                      {missingDates.slice(0, 4).map((uc) => {
                        const noGoLive = !uc.go_live_date && !uc.target_go_live_date;
                        const noImpl = !uc.implementation_start_date;
                        const tag = noGoLive && noImpl ? "no dates" : noGoLive ? "no go-live" : "no impl start";
                        return (
                          <Link
                            key={uc.use_case_id}
                            href={`/accounts/${uc.account_id}`}
                            className="flex items-start gap-1.5 hover:bg-slate-50 -mx-1 px-1 rounded py-0.5 transition-colors"
                          >
                            <Calendar size={10} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-slate-700 truncate">{uc.use_case_name}</p>
                              <p className="text-[10px] text-sky-600 truncate">{uc.account_name}</p>
                            </div>
                            <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded shrink-0 ml-1">{tag}</span>
                          </Link>
                        );
                      })}
                      {missingDates.length > 4 && (
                        <p className="text-[10px] text-slate-400 pl-4">+{missingDates.length - 4} more</p>
                      )}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Engagement Timeline mini */}
          {(() => {
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            const wStart = new Date(today);
            wStart.setDate(1);
            wStart.setMonth(wStart.getMonth() - 1);
            const wEnd = new Date(wStart);
            wEnd.setMonth(wEnd.getMonth() + 6);
            const wMs = wStart.getTime();
            const spanMs = wEnd.getTime() - wMs;
            const todayPct = ((today.getTime() - wMs) / spanMs) * 100;
            const ENGAGEMENT_COLORS: Record<string, string> = {
              "Low": "bg-sky-400", "Normal": "bg-emerald-500", "High": "bg-violet-500",
            };
            const datedAccounts = myAccounts
              .filter((a) => a.engagement_start_date)
              .sort((a, b) => {
                const ad = new Date(a.engagement_start_date!.slice(0, 10) + "T12:00:00").getTime();
                const bd = new Date(b.engagement_start_date!.slice(0, 10) + "T12:00:00").getTime();
                return ad - bd;
              })
              .slice(0, 8);
            return (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <GanttChart size={13} className="text-slate-400" />
                      Engagement Timeline
                    </div>
                    <Link href="/timeline" className="text-[10px] text-sky-600 hover:underline font-normal">
                      Full view →
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  {datedAccounts.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-2 text-center">
                      No engagement dates set yet.{" "}
                      <Link href="/accounts" className="text-sky-600 hover:underline">Add dates on account detail.</Link>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      <div className="relative h-4 mb-1">
                        {todayPct >= 0 && todayPct <= 100 && (
                          <div className="absolute top-0 bottom-0 w-px bg-sky-300" style={{ left: `${todayPct}%` }}>
                            <span className="absolute top-0 left-1 text-[9px] text-sky-500 whitespace-nowrap">Today</span>
                          </div>
                        )}
                      </div>
                      {datedAccounts.map((acc) => {
                        const sTime = new Date(acc.engagement_start_date!.slice(0, 10) + "T12:00:00").getTime();
                        const eTime = acc.rolloff_date
                          ? new Date(acc.rolloff_date.slice(0, 10) + "T12:00:00").getTime()
                          : sTime + 90 * 86400000;
                        const cStart = Math.max(sTime, wMs);
                        const cEnd   = Math.min(eTime, wEnd.getTime());
                        if (cEnd <= wMs || cStart >= wEnd.getTime()) return null;
                        const leftPct  = ((cStart - wMs) / spanMs) * 100;
                        const widthPct = ((cEnd - cStart) / spanMs) * 100;
                        const barColor = acc.status.toLowerCase() === "not started"
                          ? "bg-transparent border border-dashed border-slate-300"
                          : acc.status.toLowerCase() === "paused" ? "bg-amber-400"
                          : acc.status.toLowerCase() === "complete" ? "bg-slate-300"
                          : (ENGAGEMENT_COLORS[acc.engagement_status] ?? "bg-slate-400");
                        return (
                          <Link key={acc.account_id} href={`/accounts/${acc.account_id}`}
                            className="flex items-center gap-1.5 py-0.5 hover:bg-slate-50 -mx-1 px-1 rounded group transition-colors">
                            <span className="text-[10px] text-slate-600 truncate w-20 shrink-0 group-hover:text-sky-600">{acc.account_name}</span>
                            <div className="flex-1 relative h-3 bg-slate-50 rounded overflow-hidden">
                              {todayPct >= 0 && todayPct <= 100 && (
                                <div className="absolute top-0 bottom-0 w-px bg-sky-200" style={{ left: `${todayPct}%` }} />
                              )}
                              <div
                                className={`absolute top-0 bottom-0 rounded ${barColor}`}
                                style={{ left: `${Math.max(0, leftPct).toFixed(1)}%`, width: `${Math.max(widthPct, 1).toFixed(1)}%` }}
                              />
                            </div>
                          </Link>
                        );
                      })}
                      {myAccounts.filter((a) => a.engagement_start_date).length > 8 && (
                        <p className="text-[10px] text-slate-400 pt-0.5">
                          +{myAccounts.filter((a) => a.engagement_start_date).length - 8} more on{" "}
                          <Link href="/timeline" className="text-sky-600 hover:underline">full timeline</Link>
                        </p>
                      )}
                      {myAccounts.filter((a) => !a.engagement_start_date).length > 0 && (
                        <p className="text-[10px] text-slate-400 pt-0.5">
                          {myAccounts.filter((a) => !a.engagement_start_date).length} accounts with no dates set
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
