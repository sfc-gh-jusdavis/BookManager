"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Users, Clock, Plus, FileText, Sparkles, Bookmark, BookmarkCheck, Archive, ChevronDown, Cpu,
  CalendarCheck2, Mail, TrendingDown, TrendingUp, AlertTriangle, VideoOff, Video, RefreshCw, Layers, BarChart3, List, ExternalLink, Pencil, Check, X,
} from "lucide-react";
import {
  useAccount, useAccountUseCases, useAccountGongCalls, useUpcomingMeetings,
  useAceDisplayNames, useAccountRevenueSummary,
  useAccountTracking, useSetAccountTracking, useDeleteAccountTracking,
  useAccountAdoption, useMeetingActivity, useEmailActivity,
  useUpdateAccountFields, useAccountContext, useAddAccountContext, useAccountBriefing,
  useRefreshAccount,
  useAddTimelineContext, useDeleteTimelineContext,
  useAccountBreakdowns, useAccountAlerts, useMarkAlertRead, useDismissAlert,
  useMuteAlert, useSecurityPosture,
} from "@/hooks/useApi";
import type { GongCall, AccountAdoptionData, MeetingActivity, EmailActivity, ContextNote, AccountBriefing, UseCaseBreakdownItem, AlertItem } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { NotesTimeline } from "@/components/account-detail/NotesTimeline";
import { AIChatPanel } from "@/components/account-detail/AIChatPanel";
import { MeetingPrepView } from "@/components/account-detail/MeetingPrepView";
import { SecurityPostureChecklist } from "@/components/account-detail/SecurityPostureChecklist";
import { AlertsTile } from "@/components/account-detail/health/AlertsTile";
import { EngagementTile } from "@/components/account-detail/health/EngagementTile";
import { AdoptionTile } from "@/components/account-detail/health/AdoptionTile";
import { SecurityTile, deriveSecuritySummary } from "@/components/account-detail/health/SecurityTile";
import { AlertRow } from "@/components/alerts/AlertRow";
import type { NBAContext } from "@/components/dashboard/ACEChat";
import { useAuth } from "@/context/AuthContext";
import { sfUseCaseUrl } from "@/lib/utils";
import { useACEChatConfig } from "@/context/ACEChatContext";

type PSNote = { note_id: string; content: string; created_at: string; author_id: string };

type UseCase = {
  use_case_id: string; account_id: string; use_case_name: string;
  stage: string; status: string; target_go_live_date: string | null;
  notes: string | null; ps_notes_summary: string | null;
  ps_notes: PSNote[];
  description?: string | null;
  lead_se?: string | null;
  created_date?: string | null;
  complexity?: string | null;
  meddpicc_overall_score?: number | null;
  last_note_date?: string | null;
};

type Resource = {
  resource_id: string; account_id: string; title: string; resource_type: string;
  link_type: string | null; content: string; created_by: string; created_at: string;
};

type RevenueSummary = {
  account_id: string;
  net_acv: number | null;
  net_tcv: number | null;
  contract_capacity: number | null;
  total_consumed_revenue: number | null;
  capacity_remaining: number | null;
  total_consumed_credits: number | null;
  pct_consumed: number | null;
  predicted_overage_date: string | null;
  last_actual_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  wow_credits_pct_change: number | null;
  mom_credits_pct_change: number | null;
};

type AccountData = {
  account_id: string; account_name: string; status: string; engagement_status: string;
  industry: string; region: string; ace_assigned: string; collaborators: string[];
  total_credits_allocated: number; activation_start_date: string;
  consumption_ytd?: number; meetings_last_30d: number; upcoming_meetings_5d: number;
  no_recording?: boolean;
  lead_se_email?: string | null;
  ae_email?: string | null;
  ae_name?: string | null;
  engagement_start_date?: string | null;
  rolloff_date?: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function extractUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/href=["']([^"']+)["']/);
  if (match) return match[1] ?? null;
  if (raw.startsWith("http")) return raw;
  return null;
}

function dollarShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toFixed(0)}`;
}

function parseTakeaways(raw: string | null | undefined): { recap?: string; next_steps?: string[] } {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    const recap = typeof obj.recap === "string" ? obj.recap : undefined;
    let next_steps: string[] | undefined;
    if (typeof obj.next_steps === "string") {
      try {
        const arr = JSON.parse(obj.next_steps);
        if (Array.isArray(arr)) next_steps = arr.map(String);
      } catch { /* skip */ }
    }
    return { recap, next_steps };
  } catch {
    return {};
  }
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

const ENGAGEMENT_BADGE: Record<string, string> = {
  "Low": "bg-sky-50 text-sky-700 border-sky-200",
  "Normal": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "High": "bg-violet-50 text-violet-700 border-violet-200",
};
const STATUS_BADGE: Record<string, string> = {
  "Active": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Go Live": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "At Risk": "bg-amber-50 text-amber-700 border-amber-200",
  "Onboarding": "bg-sky-50 text-sky-700 border-sky-200",
  "Churned": "bg-red-50 text-red-700 border-red-200",
  "Blocked": "bg-red-50 text-red-700 border-red-200",
  "Deployed": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Technical Win": "bg-blue-50 text-blue-700 border-blue-200",
  "Use Case Won": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "not started": "bg-slate-50 text-slate-500 border-slate-200",
  "active": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "complete": "bg-blue-50 text-blue-700 border-blue-200",
  "stopped": "bg-slate-100 text-slate-500 border-slate-300",
  "paused": "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_OPTIONS = ["not started", "active", "complete", "stopped", "paused"] as const;
const ENGAGEMENT_OPTIONS = ["Low", "Normal", "High"] as const;
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
const STAGE_BADGE: Record<string, string> = {
  "2 - Scoping": "bg-slate-50 text-slate-600 border-slate-200",
  "3 - Technical / Business Validation": "bg-sky-50 text-sky-700 border-sky-200",
  "5 - Implementation In Progress": "bg-violet-50 text-violet-700 border-violet-200",
  "8 - Use Case Lost": "bg-red-50 text-red-700 border-red-200",
};

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_BADGE[stage] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const label = stage.includes(" - ") ? (stage.split(" - ")[1] ?? stage) : stage;
  return <Badge text={label} cls={cls} />;
}

function NoteContent({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 500;
  if (text.length <= LIMIT) {
    return <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{text}</p>;
  }
  return (
    <div>
      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
        {expanded ? text : `${text.slice(0, LIMIT)}…`}
      </p>
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-sky-600 hover:text-sky-700 mt-1">
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function UseCasePane({
  title, count, useCases, isOpen, onToggle, accountStatus,
}: {
  title: string; count: number; useCases: UseCase[]; isOpen: boolean; onToggle: () => void; accountStatus?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {count}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100">
          {useCases.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No use cases found.</p>
          ) : useCases.map((uc) => (
            <UseCaseCard key={uc.use_case_id} uc={uc} accountStatus={accountStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

const EFFORT_COLORS: Record<string, string> = {
  small: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  large: "bg-red-50 text-red-700 border-red-200",
};

const WORKLOAD_COLORS: Record<string, string> = {
  "Data Engineering": "bg-blue-50 text-blue-700 border-blue-200",
  "AI/ML": "bg-purple-50 text-purple-700 border-purple-200",
  "Data Warehouse/Analytics": "bg-sky-50 text-sky-700 border-sky-200",
  "Data Lake": "bg-teal-50 text-teal-700 border-teal-200",
  "Data Sharing": "bg-orange-50 text-orange-700 border-orange-200",
  "Applications/SPCS": "bg-pink-50 text-pink-700 border-pink-200",
};

const WORKLOAD_BAR_COLORS: Record<string, string> = {
  "Data Engineering": "#60a5fa",
  "AI/ML": "#c084fc",
  "Data Warehouse/Analytics": "#38bdf8",
  "Data Lake": "#2dd4bf",
  "Data Sharing": "#fb923c",
  "Applications/SPCS": "#f472b6",
  "Data Governance": "#34d399",
};

const EFFORT_DAYS_FALLBACK: Record<string, number> = { small: 15, medium: 30, large: 60 };

function getEstDays(sub: UseCaseBreakdownItem): number {
  if (sub.sub_estimated_days && sub.sub_estimated_days > 0) return sub.sub_estimated_days;
  const effort = (sub.sub_estimated_effort ?? "").replace(/^effort:\s*/i, "").toLowerCase().trim();
  return EFFORT_DAYS_FALLBACK[effort] ?? 30;
}

function computeGanttBars(items: UseCaseBreakdownItem[]) {
  const sorted = [...items].sort((a, b) => (a.sub_use_case_index ?? 0) - (b.sub_use_case_index ?? 0));
  const startDays = new Map<number, number>();
  const bars: { sub: UseCaseBreakdownItem; startDay: number; days: number; cleanName: string }[] = [];

  for (const item of sorted) {
    const idx = item.sub_use_case_index ?? 0;
    const depIdx = item.sub_dependency_index ?? 0;
    const days = getEstDays(item);
    let start = 0;
    if (depIdx > 0) {
      const depStart = startDays.get(depIdx) ?? 0;
      const depItem = sorted.find(i => i.sub_use_case_index === depIdx);
      const depDays = depItem ? getEstDays(depItem) : 0;
      start = depStart + depDays;
    }
    startDays.set(idx, start);
    const cleanName = (item.sub_use_case_name ?? "").replace(/^\d+\.\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").replace(/^\*{2}SUB-UC\d+:\*{2}\s*/, "").trim();
    bars.push({ sub: item, startDay: start, days, cleanName });
  }

  const totalDays = Math.max(...bars.map(b => b.startDay + b.days), 1);
  return { bars, totalDays };
}

function GanttTimeline({ items }: { items: UseCaseBreakdownItem[] }) {
  const { bars, totalDays } = useMemo(() => computeGanttBars(items), [items]);

  const tickInterval = totalDays <= 30 ? 5 : totalDays <= 60 ? 10 : totalDays <= 120 ? 15 : 30;
  const ticks: number[] = [];
  for (let d = 0; d <= totalDays; d += tickInterval) ticks.push(d);
  if (ticks[ticks.length - 1] < totalDays) ticks.push(totalDays);

  return (
    <div className="space-y-1">
      <div className="relative h-5 mb-1">
        {ticks.map((d) => (
          <span key={d} className="absolute text-[9px] text-slate-400 -translate-x-1/2" style={{ left: `${(d / totalDays) * 100}%` }}>
            {d}d
          </span>
        ))}
      </div>
      <div className="relative">
        {ticks.map((d) => (
          <div key={d} className="absolute top-0 bottom-0 border-l border-dashed border-slate-200" style={{ left: `${(d / totalDays) * 100}%`, height: `${bars.length * 32 + 4}px` }} />
        ))}
        <div className="space-y-1.5 relative">
          {bars.map((bar) => {
            const leftPct = (bar.startDay / totalDays) * 100;
            const widthPct = Math.max((bar.days / totalDays) * 100, 2);
            const barColor = WORKLOAD_BAR_COLORS[bar.sub.sub_workload ?? ""] ?? "#94a3b8";
            return (
              <div key={bar.sub.breakdown_id ?? bar.sub.sub_use_case_index} className="relative h-7 group">
                <div
                  className="absolute top-0 h-7 rounded-md flex items-center px-2 overflow-hidden cursor-default transition-opacity hover:opacity-90"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "40px", backgroundColor: barColor }}
                  title={`${bar.cleanName}\n${bar.days}d | ${bar.sub.sub_workload}\n${bar.sub.sub_rationale ?? ""}`}
                >
                  <span className="text-[10px] font-medium text-white truncate">{bar.cleanName}</span>
                  <span className="ml-auto text-[9px] text-white/80 shrink-0 pl-1">{bar.days}d</span>
                </div>
              </div>

            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400">
        <span>Estimated total: ~{totalDays} working days</span>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(WORKLOAD_BAR_COLORS).filter(([wl]) => bars.some(b => b.sub.sub_workload === wl)).map(([wl, cls]) => (
            <span key={wl} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: cls }} />
              <span>{wl}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownSection({ breakdowns }: { breakdowns: UseCaseBreakdownItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "timeline">("timeline");
  if (breakdowns.length === 0) return null;

  const grouped = breakdowns.reduce((acc, b) => {
    const key = b.use_case_id;
    if (!acc[key]) acc[key] = { parent: b.parent_use_case_name ?? "Unknown", score: b.splittability_score ?? 0, overall: b.overall_rationale, items: [] };
    acc[key].items.push(b);
    return acc;
  }, {} as Record<string, { parent: string; score: number; overall?: string | null; items: UseCaseBreakdownItem[] }>);

  const parents = Object.values(grouped).sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-violet-50/50 transition-colors">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-violet-500" />
          <span className="text-sm font-semibold text-violet-800">Use Case Split Suggestions</span>
          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            {parents.length} splittable
          </span>
        </div>
        <ChevronDown size={16} className={`text-violet-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-violet-100">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
            <button type="button" onClick={() => setView("list")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <List size={12} /> List
            </button>
            <button type="button" onClick={() => setView("timeline")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === "timeline" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <BarChart3 size={12} /> Timeline
            </button>
          </div>
          {parents.map(({ parent, score, overall, items }) => (
            <div key={parent} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{parent}</p>
                  {overall && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{overall}</p>}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                  score >= 7 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                }`}>
                  {score}/10
                </span>
              </div>
              {view === "timeline" ? (
                <GanttTimeline items={items} />
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {items.sort((a, b) => (a.sub_use_case_index ?? 0) - (b.sub_use_case_index ?? 0)).map((sub) => {
                    const cleanName = (sub.sub_use_case_name ?? "").replace(/^\d+\.\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").replace(/^\*{2}SUB-UC\d+:\*{2}\s*/, "").trim();
                    const effortNorm = (sub.sub_estimated_effort ?? "").replace(/^Effort:\s*/i, "").toLowerCase().trim();
                    const effortCls = EFFORT_COLORS[effortNorm] ?? "bg-slate-50 text-slate-600 border-slate-200";
                    const workloadCls = WORKLOAD_COLORS[sub.sub_workload ?? ""] ?? "bg-slate-50 text-slate-600 border-slate-200";
                    const estDays = getEstDays(sub);
                    return (
                      <div key={sub.breakdown_id ?? sub.sub_use_case_index} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-xs font-semibold text-slate-700">{cleanName}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${workloadCls}`}>
                            {sub.sub_workload}
                          </span>
                          {effortNorm && (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${effortCls}`}>
                              {effortNorm}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 text-[10px] font-medium">
                            ~{estDays}d
                          </span>
                        </div>
                        {sub.sub_rationale && <p className="text-[11px] text-slate-500 leading-relaxed">{sub.sub_rationale}</p>}
                        {sub.sub_key_activities && (
                          <p className="text-[10px] text-slate-400 mt-1">Activities: {sub.sub_key_activities}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UseCaseCard({ uc, accountStatus }: { uc: UseCase; accountStatus?: string | null }) {
  const days = daysUntil(uc.target_go_live_date);
  const daysSinceNote = uc.last_note_date
    ? Math.floor((Date.now() - new Date(uc.last_note_date).getTime()) / 86_400_000)
    : null;
  const normalStatus = (accountStatus ?? "active").toLowerCase();
  const staleThreshold = ["paused", "stopped"].includes(normalStatus) ? 14 : 7;
  const isStaleNotes =
    normalStatus !== "complete" &&
    (daysSinceNote === null || daysSinceNote >= staleThreshold);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <a
              href={sfUseCaseUrl(uc.use_case_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-slate-800 hover:text-sky-600 hover:underline"
            >
              {uc.use_case_name}
            </a>
            <StageBadge stage={uc.stage} />
            {uc.status === "Blocked" && (
              <Badge text="Blocked" cls={STATUS_BADGE["Blocked"]!} />
            )}
            {uc.status === "In Pursuit" && uc.meddpicc_overall_score != null && uc.meddpicc_overall_score < 3 && (
              <span title={`MEDDPICC overall score: ${uc.meddpicc_overall_score}/10`} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                MEDDPICC {uc.meddpicc_overall_score}/10
              </span>
            )}
            {uc.complexity && (
              <Badge text={uc.complexity} cls="bg-slate-50 text-slate-600 border-slate-200" />
            )}
            {isStaleNotes && (
              <span title={daysSinceNote === null ? "No PS notes have been added yet" : `Last PS note was ${daysSinceNote} days ago`} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <AlertTriangle size={10} />
                {daysSinceNote === null ? "No notes yet" : `Notes ${daysSinceNote}d old`}
              </span>
            )}
          </div>
          {uc.description && (
            <p className="text-xs text-slate-500 leading-relaxed">{uc.description}</p>
          )}
        </div>

        {uc.ps_notes_summary && (
          <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={12} className="text-sky-500" />
              <span className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">AI Summary</span>
            </div>
            <p className="text-xs text-sky-800 leading-relaxed">{uc.ps_notes_summary}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          {uc.created_date && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />Created: {formatDate(uc.created_date)}
            </span>
          )}
          {uc.target_go_live_date && (
            <span className="flex items-center gap-1">
              <Clock size={10} />Target: {formatDate(uc.target_go_live_date)}
            </span>
          )}
          {days !== null && (
            <span className={`flex items-center gap-1 font-medium ${days < 0 ? "text-red-500" : days < 30 ? "text-amber-600" : "text-slate-500"}`}>
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
            </span>
          )}
          {uc.lead_se && (
            <span className="flex items-center gap-1">
              <Users size={10} />Lead SE: {uc.lead_se}
            </span>
          )}
        </div>

        {uc.ps_notes?.length > 0 && (
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Notes</p>
            {uc.ps_notes.map((note) => (
              <div key={note.note_id} className="flex gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${avatarColor(note.author_id)}`}>
                  {getInitials(note.author_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-medium text-slate-700">{note.author_id}</span>
                    <span className="text-[11px] text-slate-400">{formatDate(note.created_at)}</span>
                  </div>
                  <NoteContent text={note.content} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type TabKey = "overview" | "adoption" | "timeline" | "prep" | "assistant";
const VALID_TABS: TabKey[] = ["overview", "adoption", "timeline", "prep", "assistant"];

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const accountId = params?.id ?? "";

  const rawTab = searchParams?.get("tab") as TabKey | null;
  const initialTab: TabKey = rawTab && VALID_TABS.includes(rawTab) ? rawTab
    : searchParams?.get("nba") ? "assistant" : "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);

  const nbaContext: NBAContext | null = useMemo(() => {
    const raw = searchParams?.get("nba");
    if (!raw) return null;
    try { return JSON.parse(decodeURIComponent(raw)) as NBAContext; } catch { return null; }
  }, [searchParams]);

  const [editingField, setEditingField] = useState<"status" | "engagement" | null>(null);
  const [editingNotesDocUrl, setEditingNotesDocUrl] = useState(false);
  const [notesDocUrlInput, setNotesDocUrlInput] = useState("");
  const [myPaneOpen, setMyPaneOpen] = useState(true);
  const [otherPaneOpen, setOtherPaneOpen] = useState(false);
  const [showContextInput, setShowContextInput] = useState(false);
  const [contextText, setContextText] = useState("");
  const [contextType, setContextType] = useState("note");
  const [contextSubmitting, setContextSubmitting] = useState(false);
  const [contextResult, setContextResult] = useState<{ summary: string | null; sentiment: string | null } | null>(null);
  const panesInitialized = useRef(false);

  const { currentUser } = useAuth();
  const { setConfig, clearConfig } = useACEChatConfig();

  useEffect(() => {
    setConfig({ nbaContext, accountId });
    return () => clearConfig();
  }, [nbaContext, accountId]);

  const { data: account, isLoading: accLoading } = useAccount(accountId) as { data: AccountData | undefined; isLoading: boolean };
  const { data: useCases = [] } = useAccountUseCases(accountId) as { data: UseCase[] };
  const { data: gongCallsRaw = [] } = useAccountGongCalls(accountId) as { data: GongCall[] };
  const { data: upcomingMeetings = [] } = useUpcomingMeetings(accountId, 5);
  const { data: meetings = [] } = useMeetingActivity(accountId, false) as { data: MeetingActivity[] };
  const { data: emailActivity } = useEmailActivity(accountId) as { data: EmailActivity | undefined };
  const { data: revenueSummary } = useAccountRevenueSummary(accountId) as { data: RevenueSummary | undefined };
  const { data: accountAlerts = [], isLoading: alertsLoading } = useAccountAlerts(accountId);
  const markRead = useMarkAlertRead();
  const dismissAlert = useDismissAlert();
  const muteAlert = useMuteAlert();
  const { data: securityPosture } = useSecurityPosture(tab === "adoption" ? accountId : "");
  const [openTile, setOpenTile] = useState<"alerts" | "engagement" | "adoption" | "security" | null>(null);
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };
  const { data: trackingStatus } = useAccountTracking(accountId);
  useEffect(() => {
    if (trackingStatus) setNotesDocUrlInput(trackingStatus.notes_doc_url ?? "");
  }, [trackingStatus]);
  const { data: adoption } = useAccountAdoption(tab === "adoption" ? accountId : "") as { data: AccountAdoptionData | undefined };
  const setTracking = useSetAccountTracking(accountId);
  const deleteTracking = useDeleteAccountTracking(accountId);
  const updateAccount = useUpdateAccountFields(accountId);
  const addTimelineContext = useAddTimelineContext(accountId);
  const deleteTimelineContext = useDeleteTimelineContext(accountId);
  const { refresh: refreshAccount, isRefreshing } = useRefreshAccount(accountId);
  const { data: breakdowns = [] } = useAccountBreakdowns(accountId) as { data: UseCaseBreakdownItem[] };
  const [showAddContext, setShowAddContext] = useState(false);
  const [addCtxClassification, setAddCtxClassification] = useState("meeting_notes");
  const [addCtxTitle, setAddCtxTitle] = useState("");
  const [addCtxDate, setAddCtxDate] = useState(new Date().toISOString().slice(0, 10));
  const [addCtxContent, setAddCtxContent] = useState("");
  const { data: contextNotes = [] } = useAccountContext(accountId) as { data: ContextNote[] };
  const addContext = useAddAccountContext(accountId);
  const [briefingRefreshKey, setBriefingRefreshKey] = useState(false);
  const { data: briefing, isLoading: briefingLoading } = useAccountBriefing(accountId, briefingRefreshKey) as { data: AccountBriefing | undefined; isLoading: boolean };

  const gongCalls = useMemo(() => [...gongCallsRaw].sort((a, b) => new Date(b.call_date).getTime() - new Date(a.call_date).getTime()), [gongCallsRaw]);

  const upcomingMeetingsList = useMemo(() => {
    const now = new Date();
    return meetings.filter((m) => m.is_upcoming || (m.activity_date != null && new Date(m.activity_date + "T00:00:00") > now));
  }, [meetings]);

  const securitySummary = securityPosture ? deriveSecuritySummary(securityPosture) : null;

  const hasUnreadAlerts = (accountAlerts as AlertItem[]).some((a) => !a.is_read);
  const [openTileInitialized, setOpenTileInitialized] = useState(false);
  useEffect(() => {
    if (!openTileInitialized && !alertsLoading && tab === "adoption") {
      setOpenTileInitialized(true);
      if (hasUnreadAlerts) setOpenTile("alerts");
    }
  }, [openTileInitialized, alertsLoading, tab, hasUnreadAlerts]);

  const isMyUseCase = useCallback(
    (uc: UseCase) =>
      !!uc.lead_se &&
      (uc.lead_se === currentUser?.email || uc.lead_se === currentUser?.display_name),
    [currentUser]
  );

  const myUseCases = useMemo(
    () => (useCases as UseCase[]).filter(isMyUseCase),
    [useCases, isMyUseCase]
  );
  const otherUseCases = useMemo(
    () => (useCases as UseCase[]).filter((uc) => !isMyUseCase(uc)),
    [useCases, isMyUseCase]
  );

  useEffect(() => {
    if (!panesInitialized.current && useCases.length > 0) {
      panesInitialized.current = true;
      const hasOwned = (useCases as UseCase[]).some(isMyUseCase);
      if (!hasOwned) {
        setMyPaneOpen(false);
        setOtherPaneOpen(true);
      }
    }
  }, [useCases, currentUser]);

  if (accLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-lg text-slate-500">Account not found</p>
        <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700">
          <ArrowLeft size={16} /> Back to Accounts
        </Link>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "adoption", label: "Account Health" },
    { key: "timeline", label: "Timeline" },
    { key: "prep", label: "Meeting Prep" },
    { key: "assistant", label: "ACE" },
  ];

  return (
    <>
      <div className="min-h-full bg-slate-50/40">
      <div className="px-6 py-6 space-y-3 bg-white border-b border-slate-100">
        <Link href="/accounts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to Accounts
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{account.account_name}</h1>
          <div className="relative">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1">Status</span>
              <button
                type="button"
                onClick={() => setEditingField(editingField === "status" ? null : "status")}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium hover:ring-1 hover:ring-slate-300 transition-all ${STATUS_BADGE[account.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                {toTitleCase(account.status)}<ChevronDown size={10} />
              </button>
            </div>
            {editingField === "status" && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEditingField(null)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { updateAccount.mutate({ status: opt }); setEditingField(null); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 ${account.status === opt ? "font-semibold text-slate-900" : "text-slate-600"}`}
                    >
                      {toTitleCase(opt)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1">Engagement</span>
              <button
                type="button"
                onClick={() => setEditingField(editingField === "engagement" ? null : "engagement")}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium hover:ring-1 hover:ring-slate-300 transition-all ${ENGAGEMENT_BADGE[account.engagement_status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                {toTitleCase(account.engagement_status)}<ChevronDown size={10} />
              </button>
            </div>
            {editingField === "engagement" && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setEditingField(null)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[100px]">
                  {ENGAGEMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { updateAccount.mutate({ engagement_status: opt }); setEditingField(null); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-slate-50 ${account.engagement_status === opt ? "font-semibold text-slate-900" : "text-slate-600"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1">Recording</span>
            <button
              type="button"
              title={account.no_recording ? "Meetings not recorded — click to enable recording" : "Meetings recorded — click to mark as not recorded"}
              onClick={() => updateAccount.mutate({ no_recording: !account.no_recording })}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all ${account.no_recording ? "bg-amber-50 text-amber-700 border-amber-200 hover:ring-1 hover:ring-amber-300" : "bg-slate-50 text-slate-500 border-slate-200 hover:ring-1 hover:ring-slate-300"}`}
            >
              {account.no_recording ? <VideoOff size={11} /> : <Video size={11} />}
              {account.no_recording ? "No Recording" : "Recorded"}
            </button>
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1">Engagement Start</span>
            <input
              type="date"
              value={account.engagement_start_date ? account.engagement_start_date.slice(0, 10) : ""}
              onChange={(e) => {
                const val = e.target.value || null;
                const rolloff = val ? new Date(new Date(val).getTime() + 90 * 86400000).toISOString().slice(0, 10) : null;
                updateAccount.mutate({
                  engagement_start_date: val,
                  ...(!account.rolloff_date ? { rolloff_date: rolloff } : {}),
                });
              }}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:border-sky-300 focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-1">Est. Roll-off</span>
            <input
              type="date"
              value={account.rolloff_date ? account.rolloff_date.slice(0, 10) : ""}
              onChange={(e) => {
                updateAccount.mutate({ rolloff_date: e.target.value || null });
              }}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 hover:border-sky-300 focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={refreshAccount}
            disabled={isRefreshing}
            title="Refresh account data"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
          {trackingStatus ? (
            <div className="flex items-center gap-1 ml-auto">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${trackingStatus.tracking_status === "following" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {trackingStatus.tracking_status === "following" ? <BookmarkCheck size={11} /> : <Archive size={11} />}
                {trackingStatus.tracking_status === "following" ? "Following" : "Archived"}
              </span>
              <button
                onClick={() => deleteTracking.mutate()}
                className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors px-1"
                title="Remove tracking"
              >✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setTracking.mutate({ status: "following" })}
                disabled={setTracking.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <Bookmark size={11} /> Follow
              </button>
              <button
                onClick={() => setTracking.mutate({ status: "archived" })}
                disabled={setTracking.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Archive size={11} /> Archive
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText size={12} className="text-slate-400 shrink-0" />
          <span className="font-medium text-slate-500">Notes doc:</span>
          {editingNotesDocUrl ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="url"
                value={notesDocUrlInput}
                onChange={(e) => setNotesDocUrlInput(e.target.value)}
                placeholder="https://docs.google.com/…"
                autoFocus
                className="flex-1 max-w-sm rounded border border-sky-300 bg-white px-2 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
              <button
                type="button"
                onClick={() => {
                  const url = notesDocUrlInput.trim() || null;
                  const status = trackingStatus?.tracking_status ?? "following";
                  setTracking.mutate({ status, notes_doc_url: url });
                  setEditingNotesDocUrl(false);
                }}
                disabled={setTracking.isPending}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors disabled:opacity-50"
              >
                <Check size={11} /> Save
              </button>
              <button
                type="button"
                onClick={() => { setNotesDocUrlInput(trackingStatus?.notes_doc_url ?? ""); setEditingNotesDocUrl(false); }}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-slate-400 border border-slate-200 hover:text-slate-600 hover:border-slate-300 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ) : trackingStatus?.notes_doc_url ? (
            <div className="flex items-center gap-1.5">
              <a
                href={trackingStatus.notes_doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 hover:underline max-w-xs truncate"
              >
                <ExternalLink size={11} />
                {trackingStatus.notes_doc_url.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
              <button
                type="button"
                onClick={() => { setNotesDocUrlInput(trackingStatus.notes_doc_url ?? ""); setEditingNotesDocUrl(true); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Edit notes doc link"
              >
                <Pencil size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNotesDocUrl(true)}
              className="text-slate-400 hover:text-sky-600 transition-colors text-[11px] italic"
            >
              + Add link
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />{account.industry}{account.region ? ` · ${account.region}` : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />Started: {formatDate(account.activation_start_date)}
          </span>
          {account.total_credits_allocated ? (
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              {dollarShort(account.total_credits_allocated)} allocated
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Users size={13} className="text-slate-400" />
          <span className="text-slate-500 font-medium">ACE:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-sky-700 font-medium">
            {(aceDisplayNames as Record<string, string>)[account.ace_assigned] ?? account.ace_assigned}
            <span className="text-[9px] uppercase tracking-wider text-sky-500">Primary</span>
          </span>
          {account.collaborators?.map((id) => (
            <span key={id} className="inline-flex items-center rounded-full bg-white border border-slate-200 px-2.5 py-1 text-slate-600">
              {(aceDisplayNames as Record<string, string>)[id] ?? id}
            </span>
          ))}
          {account.lead_se_email && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400 font-medium">Lead SE:</span>
              <span className="inline-flex items-center rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-violet-700">
                {(aceDisplayNames as Record<string, string>)[account.lead_se_email] ?? account.lead_se_email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </>
          )}
          {account.ae_email && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400 font-medium">AE:</span>
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-amber-700">
                {account.ae_name ?? account.ae_email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="flex items-center gap-0.5 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
          {tabs.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${tab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {key === "assistant" && <Sparkles size={12} className={tab === key ? "text-sky-500" : "text-slate-400"} />}
              {label}
            </button>
          ))}
        </div>
      </div>



      <div className="px-6 pb-8">
        <div>

          {tab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Contract Spend</p>
                    <p className="text-sm font-bold text-slate-800">
                      {revenueSummary?.total_consumed_revenue != null ? dollarShort(revenueSummary.total_consumed_revenue) : "—"}
                    </p>
                    {revenueSummary?.net_acv != null && (
                      <p className="text-[11px] text-slate-500">ACV {dollarShort(revenueSummary.net_acv)}{revenueSummary.net_tcv != null ? ` · TCV ${dollarShort(revenueSummary.net_tcv)}` : ""}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Alerts</p>
                    <p className="text-sm font-bold text-slate-800">{accountAlerts.length}</p>
                    <p className="text-[11px] text-slate-500">active alerts</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Meetings</p>
                    <p className="text-sm font-bold text-slate-800">{account.meetings_last_30d}</p>
                    <p className="text-[11px] text-slate-500">last 30d · {account.upcoming_meetings_5d ?? 0} upcoming</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Emails</p>
                    <p className="text-sm font-bold text-slate-800">{emailActivity?.emails_last_30d ?? 0}</p>
                    {emailActivity?.email_trend && (
                      <p className={`text-[11px] font-medium ${emailActivity.email_trend === "increasing" ? "text-emerald-600" : emailActivity.email_trend === "declining" ? "text-rose-600" : "text-slate-500"}`}>
                        {emailActivity.email_trend}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {upcomingMeetings.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CalendarCheck2 size={12} className="text-emerald-500" /> Upcoming Meetings
                  </p>
                  <ul className="space-y-1.5">
                    {upcomingMeetings.map((m) => (
                      <li key={m.meeting_id} className="text-xs text-slate-700">
                        <span className="font-medium text-slate-500">
                          {m.meeting_start ? new Date(m.meeting_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          {m.meeting_start ? ` · ${new Date(m.meeting_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
                        </span>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="text-slate-800">{m.title ?? "(untitled)"}</span>
                        {m.duration_mins != null && (
                          <span className="text-slate-400"> · {m.duration_mins}m</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!briefingLoading && briefing && !briefing.error && briefing.situation_summary && (
                <div className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-sky-500 shrink-0" />
                      <p className="text-xs font-semibold text-sky-800">Account Briefing</p>
                      {briefing.generated_at && (
                        <span className="text-[10px] text-slate-400">{new Date(briefing.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBriefingRefreshKey(true)}
                      className="text-[10px] text-slate-400 hover:text-sky-600 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>

                  <p className="text-sm text-slate-700 mb-3 leading-relaxed">{briefing.situation_summary}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {briefing.top_risk && (
                      <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                        <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">⚠ Top Risk</p>
                        <p className="text-xs text-slate-700">{briefing.top_risk}</p>
                      </div>
                    )}
                    {briefing.top_opportunity && (
                      <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                        <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1">✨ Top Opportunity</p>
                        <p className="text-xs text-slate-700">{briefing.top_opportunity}</p>
                      </div>
                    )}
                  </div>

                  {briefing.recommended_actions && (() => {
                    try {
                      const actions = typeof briefing.recommended_actions === 'string'
                        ? JSON.parse(briefing.recommended_actions)
                        : briefing.recommended_actions;
                      if (Array.isArray(actions) && actions.length > 0) {
                        return (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recommended</p>
                            <div className="space-y-1">
                              {actions.slice(0, 3).map((a: {action: string; urgency: string}, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    a.urgency === 'now' ? 'bg-red-100 text-red-600' :
                                    a.urgency === 'this_week' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>{a.urgency === 'now' ? 'NOW' : a.urgency === 'this_week' ? 'THIS WEEK' : 'THIS MONTH'}</span>
                                  <p className="text-xs text-slate-700">{a.action}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}

                  <button
                    type="button"
                    onClick={() => setTab("prep")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    <Sparkles size={11} /> Prep for Meeting →
                  </button>
                </div>
              )}

              {useCases.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No use cases found.</p>
              ) : (
                <>
                  <UseCasePane
                    title="My Use Cases"
                    count={myUseCases.length}
                    useCases={myUseCases}
                    isOpen={myPaneOpen}
                    onToggle={() => setMyPaneOpen((v) => !v)}
                    accountStatus={account?.status}
                  />
                  <UseCasePane
                    title="Other Use Cases on Account"
                    count={otherUseCases.length}
                    useCases={otherUseCases}
                    isOpen={otherPaneOpen}
                    onToggle={() => setOtherPaneOpen((v) => !v)}
                    accountStatus={account?.status}
                  />
                  {breakdowns.length > 0 && (
                    <BreakdownSection breakdowns={breakdowns} />
                  )}
                </>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div className="flex gap-6">
              <div className="flex-1 min-w-0 space-y-4">
                {account.no_recording && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
                    <VideoOff size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800">Meetings not recorded for this account</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">Add context manually so it appears on the timeline.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Activity Timeline</p>
                  <button
                    type="button"
                    onClick={() => { setAddCtxClassification("meeting_notes"); setAddCtxTitle(""); setAddCtxDate(new Date().toISOString().slice(0, 10)); setAddCtxContent(""); setShowAddContext(true); }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 hover:bg-sky-50 transition-colors"
                  >
                    <Plus size={11} /> Add Context
                  </button>
                </div>
                <NotesTimeline accountId={accountId} gongCalls={gongCalls} onDelete={(entryId) => {
                  if (confirm("Delete this entry from the timeline?")) {
                    deleteTimelineContext.mutate(entryId);
                  }
                }} />
              </div>

              <div className="w-64 shrink-0">
                <div className="sticky top-6 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <CalendarCheck2 size={12} className="text-emerald-500" />Meetings
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Last 30d</span>
                        <span className="text-xs font-semibold text-slate-800">{account.meetings_last_30d}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Upcoming</span>
                        <span className="text-xs font-semibold text-emerald-600">{upcomingMeetingsList.length}</span>
                      </div>
                      {meetings.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Last meeting</span>
                          <span className="text-xs text-slate-600">{formatDate(meetings[0]?.activity_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Mail size={12} className="text-sky-400" />Emails
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Last 30d</span>
                        <span className="text-xs font-semibold text-slate-800">{emailActivity?.emails_last_30d ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Outbound</span>
                        <span className="text-xs text-slate-700">{emailActivity?.emails_outbound_30d ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Inbound</span>
                        <span className="text-xs text-slate-700">{emailActivity?.emails_inbound_30d ?? 0}</span>
                      </div>
                      {emailActivity?.email_trend && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Trend</span>
                          <span className={`text-xs font-medium flex items-center gap-1 ${
                            emailActivity.email_trend === "increasing" ? "text-emerald-600" :
                            emailActivity.email_trend === "declining" ? "text-rose-600" : "text-slate-500"
                          }`}>
                            {emailActivity.email_trend === "increasing" && <TrendingUp size={11} />}
                            {emailActivity.email_trend === "declining" && <TrendingDown size={11} />}
                            {emailActivity.email_trend}
                          </span>
                        </div>
                      )}
                      {emailActivity?.last_email_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Last email</span>
                          <span className="text-xs text-slate-600">{formatDate(emailActivity.last_email_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {useCases.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">PS Notes</p>
                      <div className="space-y-2">
                        {(useCases as UseCase[]).map((uc) => {
                          const lastDate = uc.last_note_date ?? uc.ps_notes?.[0]?.created_at ?? null;
                          const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
                          const dotColor = daysSince === null ? "bg-red-400" : daysSince > 60 ? "bg-red-400" : daysSince > 30 ? "bg-amber-400" : "bg-emerald-400";
                          return (
                            <div key={uc.use_case_id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                                <span className={`text-xs truncate ${isMyUseCase(uc) ? "font-semibold text-slate-800" : "text-slate-600"}`}>{uc.use_case_name}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {lastDate ? new Date(lastDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          {tab === "prep" && (
            <MeetingPrepView
              accountId={accountId}
              accountName={account.account_name}
              onAddPostMeetingNotes={() => {
                setAddCtxClassification("meeting_notes");
                setAddCtxTitle("");
                setAddCtxDate(new Date().toISOString().slice(0, 10));
                setAddCtxContent("");
                setShowAddContext(true);
              }}
            />
          )}

          {tab === "assistant" && (
            <div className="h-[calc(100vh-300px)] min-h-[400px]">
              <AIChatPanel
                account={account}
                useCases={useCases}
                gongCalls={gongCalls}
                initialPrompt={nbaContext ? `I'm looking at this account because of the following alert — ${nbaContext.summary || nbaContext.text}. What should I know and what actions do you recommend?` : undefined}
                signalTypes={Array.from(new Set((accountAlerts || []).map((a) => a.signal_type).filter(Boolean)))}
              />
            </div>
          )}

          {tab === "adoption" && (
            <div className="space-y-4">

              {/* Scorecard tile row */}
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
                <AlertsTile
                  alerts={accountAlerts as AlertItem[]}
                  isActive={openTile === "alerts"}
                  onOpen={() => setOpenTile(openTile === "alerts" ? null : "alerts")}
                />
                <EngagementTile
                  meetings={meetings}
                  emailActivity={emailActivity}
                  upcomingMeetings={upcomingMeetingsList}
                  meetingsLast30d={account?.meetings_last_30d ?? 0}
                  isActive={openTile === "engagement"}
                  onOpen={() => setOpenTile(openTile === "engagement" ? null : "engagement")}
                />
                <AdoptionTile
                  adoption={adoption}
                  isActive={openTile === "adoption"}
                  onOpen={() => setOpenTile(openTile === "adoption" ? null : "adoption")}
                />
                <SecurityTile
                  summary={securitySummary}
                  isActive={openTile === "security"}
                  onOpen={() => setOpenTile(openTile === "security" ? null : "security")}
                />
              </div>

              {/* Expanded detail panels */}

              {openTile === "alerts" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Alerts
                    {(accountAlerts as AlertItem[]).length > 0 && (
                      <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5">
                        {(accountAlerts as AlertItem[]).length}
                      </span>
                    )}
                  </p>
                  {alertsLoading ? (
                    <p className="text-sm text-slate-400">Loading…</p>
                  ) : (accountAlerts as AlertItem[]).length === 0 ? (
                    <p className="text-sm text-slate-400">No active alerts for this account.</p>
                  ) : (
                    <div className="space-y-2">
                      {(accountAlerts as AlertItem[]).map((alert) => (
                        <AlertRow
                          key={alert.alert_id}
                          alert={alert}
                          showAccountLink={false}
                          onMarkRead={(id) => markRead.mutate(id)}
                          onDismiss={(id) => dismissAlert.mutate(id)}
                          onMute={(id, scope) => muteAlert.mutate({ alertId: id, scope })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {openTile === "engagement" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <CalendarCheck2 size={12} className="text-emerald-500" />Meetings & Email Activity
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <CalendarCheck2 size={12} className="text-emerald-500" />Meetings
                      </p>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Last 30d</span>
                          <span className="text-xs font-semibold text-slate-800">{account?.meetings_last_30d}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Upcoming</span>
                          <span className="text-xs font-semibold text-emerald-600">{upcomingMeetingsList.length}</span>
                        </div>
                        {meetings.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Last meeting</span>
                            <span className="text-xs text-slate-600">{formatDate(meetings[0]?.activity_date)}</span>
                          </div>
                        )}
                      </div>
                      {upcomingMeetingsList.length > 0 && (
                        <div className="space-y-1 border-t border-slate-100 pt-3">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Upcoming</p>
                          {upcomingMeetingsList.slice(0, 4).map((m, i) => (
                            <div key={m.activity_id ?? i} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-700 truncate min-w-0">{m.subject ?? "Meeting"}</span>
                              <span className="text-[11px] text-emerald-600 shrink-0">{formatDate(m.activity_date)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Mail size={12} className="text-sky-400" />Email Activity
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Last 30d</span>
                          <span className="text-xs font-semibold text-slate-800">{emailActivity?.emails_last_30d ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Outbound</span>
                          <span className="text-xs text-slate-700">{emailActivity?.emails_outbound_30d ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Inbound</span>
                          <span className="text-xs text-slate-700">{emailActivity?.emails_inbound_30d ?? 0}</span>
                        </div>
                        {emailActivity?.email_trend && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Trend</span>
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              emailActivity.email_trend === "increasing" ? "text-emerald-600" :
                              emailActivity.email_trend === "declining" ? "text-rose-600" : "text-slate-500"
                            }`}>
                              {emailActivity.email_trend === "increasing" && <TrendingUp size={11} />}
                              {emailActivity.email_trend === "declining" && <TrendingDown size={11} />}
                              {emailActivity.email_trend}
                            </span>
                          </div>
                        )}
                        {emailActivity?.last_email_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Last email</span>
                            <span className="text-xs text-slate-600">{formatDate(emailActivity.last_email_date)}</span>
                          </div>
                        )}
                        {emailActivity?.emails_last_7d != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Last 7d</span>
                            <span className="text-xs text-slate-700">{emailActivity.emails_last_7d}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {openTile === "adoption" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Cpu size={13} className="text-slate-400" />
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Platform Adoption{adoption?.signals ? ` (${adoption.signals.signal_count}/8 categories)` : ""}
                    </p>
                  </div>
                  {!adoption?.signals ? (
                    <p className="text-xs text-slate-400 py-2">This client is not using features at this time.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {([
                          { key: "sig_pipeline", label: "Pipeline" },
                          { key: "sig_transforms", label: "Transforms" },
                          { key: "sig_bi", label: "BI" },
                          { key: "sig_cost", label: "Cost Gov" },
                          { key: "sig_collab", label: "Collab" },
                          { key: "sig_obs", label: "Observability" },
                          { key: "sig_aiml", label: "AI/ML" },
                          { key: "sig_spcs", label: "SPCS" },
                        ] as const).map(({ key, label }) => {
                          const active = (adoption.signals as unknown as Record<string, number>)[key] === 1;
                          return (
                            <div key={key} className={`rounded-lg border p-2 text-center ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50 opacity-50"}`}>
                              <p className={`text-[10px] font-medium leading-tight ${active ? "text-emerald-700" : "text-slate-400"}`}>{label}</p>
                              <span className={`inline-block mt-1 text-[8px] font-semibold uppercase ${active ? "text-emerald-500" : "text-slate-300"}`}>{active ? "active" : "none"}</span>
                            </div>
                          );
                        })}
                      </div>
                      {adoption.features.length > 0 ? (
                        <>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Feature History ({adoption.features.length})</p>
                          <div className="space-y-0.5">
                            {[...adoption.features].reverse().map((f, i) => (
                              <div key={`${f.feature_raw}-${i}`} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                  <span className="text-xs text-slate-700 truncate">{f.feature_name}</span>
                                  {f.is_new_30d && <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0 text-[9px] font-semibold text-sky-600 shrink-0">NEW</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">{f.category}</span>
                                  <span className="text-[10px] text-slate-400">{f.first_use_date ?? ""}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 py-1">This client is not using features at this time.</p>
                      )}
                      {adoption.signals.missing_categories && (
                        <p className="mt-3 text-[10px] text-slate-400">Not detected: {adoption.signals.missing_categories}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {openTile === "security" && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                  <SecurityPostureChecklist accountId={accountId} />
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
      {showAddContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add Context</h2>
              <button onClick={() => setShowAddContext(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={addCtxClassification}
                    onChange={(e) => setAddCtxClassification(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                  >
                    <option value="meeting_notes">Meeting Notes</option>
                    <option value="transcript">Transcript</option>
                    <option value="email">Email</option>
                    <option value="notes">Notes</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    value={addCtxDate}
                    onChange={(e) => setAddCtxDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={addCtxTitle}
                  onChange={(e) => setAddCtxTitle(e.target.value)}
                  placeholder={`e.g. ${addCtxClassification === "meeting_notes" ? "QBR Notes" : addCtxClassification === "email" ? "Follow-up Email" : addCtxClassification === "transcript" ? "Discovery Call Transcript" : addCtxClassification === "other" ? "Misc Context" : "Account Observations"}`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Content</label>
                <textarea
                  rows={10}
                  value={addCtxContent}
                  onChange={(e) => setAddCtxContent(e.target.value)}
                  placeholder="Paste meeting notes, transcript, email, or notes…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowAddContext(false)} className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button
                disabled={!addCtxContent.trim() || addTimelineContext.isPending}
                onClick={() => {
                  if (!addCtxContent.trim()) return;
                  addTimelineContext.mutate(
                    { classification: addCtxClassification, content: addCtxContent.trim(), title: addCtxTitle.trim() || undefined, context_date: addCtxDate || undefined },
                    { onSuccess: () => { setShowAddContext(false); } }
                  );
                }}
                className="px-4 py-1.5 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {addTimelineContext.isPending ? "Saving…" : "Add to Timeline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

