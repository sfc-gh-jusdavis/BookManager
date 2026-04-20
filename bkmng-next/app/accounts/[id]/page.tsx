"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Users, Clock, Plus, FileText, PhoneCall, Sparkles, Bookmark, BookmarkCheck, Archive, ChevronDown, Cpu,
  CalendarCheck2, Mail, TrendingDown, TrendingUp, AlertTriangle, VideoOff, Video, RefreshCw, Layers,
} from "lucide-react";
import {
  useAccount, useAccountUseCases, useAccountGongCalls,
  useAccountResources, useAceDisplayNames, useAccountRevenueSummary, useTMRs,
  useAccountTracking, useSetAccountTracking, useDeleteAccountTracking,
  useAccountAdoption, useMeetingActivity, useEmailActivity,
  useUpdateAccountFields, useAccountContext, useAddAccountContext, useAccountBriefing,
  useRefreshAccount,
  useAddTimelineContext, useDeleteTimelineContext,
  useAccountBreakdowns,
} from "@/hooks/useApi";
import type { GongCall, TMR, AccountAdoptionData, MeetingActivity, EmailActivity, ContextNote, AccountBriefing, UseCaseBreakdownItem } from "@/hooks/useApi";
import { Skeleton } from "@/components/ui/skeleton";
import { NotesTimeline } from "@/components/account-detail/NotesTimeline";
import { AIChatPanel } from "@/components/account-detail/AIChatPanel";
import { MeetingPrepView } from "@/components/account-detail/MeetingPrepView";
import { SecurityPostureChecklist } from "@/components/account-detail/SecurityPostureChecklist";
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

function BreakdownSection({ breakdowns }: { breakdowns: UseCaseBreakdownItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
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
              <div className="grid grid-cols-1 gap-2">
                {items.sort((a, b) => (a.sub_use_case_index ?? 0) - (b.sub_use_case_index ?? 0)).map((sub) => {
                  const cleanName = (sub.sub_use_case_name ?? "").replace(/^\d+\.\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").replace(/^\*{2}SUB-UC\d+:\*{2}\s*/, "").trim();
                  const effortNorm = (sub.sub_estimated_effort ?? "").replace(/^Effort:\s*/i, "").toLowerCase().trim();
                  const effortCls = EFFORT_COLORS[effortNorm] ?? "bg-slate-50 text-slate-600 border-slate-200";
                  const workloadCls = WORKLOAD_COLORS[sub.sub_workload ?? ""] ?? "bg-slate-50 text-slate-600 border-slate-200";
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
                      </div>
                      {sub.sub_rationale && <p className="text-[11px] text-slate-500 leading-relaxed">{sub.sub_rationale}</p>}
                      {sub.sub_key_activities && (
                        <p className="text-[10px] text-slate-400 mt-1">Activities: {sub.sub_key_activities}</p>
                      )}
                    </div>
                  );
                })}
              </div>
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

function PctChip({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  const pos = value >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pos ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
        {pos ? "↑" : "↓"}{Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

function CreditUsageSidebar({ rev }: { rev: RevenueSummary | null }) {
  const hasRevenue = rev && (rev.contract_capacity || rev.total_consumed_revenue);
  const spent = rev?.total_consumed_revenue ?? 0;
  const capacity = rev?.contract_capacity ?? 0;
  const barPct = capacity > 0 ? Math.min((spent / capacity) * 100, 100) : 0;
  const pct = capacity > 0 ? (spent / capacity) * 100 : null;
  const barColor = barPct >= 90 ? "bg-red-400" : barPct >= 70 ? "bg-amber-400" : "bg-sky-400";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Contract Spend</p>
      {!hasRevenue ? (
        <p className="text-xs text-slate-400">No contract data available</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-800">
                {rev!.total_consumed_revenue !== null ? dollarShort(rev!.total_consumed_revenue) : "—"}
                <span className="text-xs font-normal text-slate-400 ml-1">spent (90d)</span>
              </span>
              {pct !== null && (
                <span className={`text-xs font-semibold ${pct >= 90 ? "text-red-500" : pct >= 70 ? "text-amber-600" : "text-slate-600"}`}>
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
            </div>
            {rev!.contract_capacity && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-slate-400">
                  ${(rev!.total_consumed_revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${rev!.contract_capacity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[11px] text-slate-400">capacity</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <PctChip value={rev!.wow_credits_pct_change} label="WoW" />
            <PctChip value={rev!.mom_credits_pct_change} label="MoM" />
            {rev!.wow_credits_pct_change === null && rev!.mom_credits_pct_change === null && (
              <p className="text-[11px] text-slate-400">No trend data yet</p>
            )}
          </div>

          {(rev!.predicted_overage_date || rev!.contract_end_date) && (
            <div className="pt-1 border-t border-slate-100 space-y-0.5">
              {rev!.predicted_overage_date && (
                <p className="text-[11px] text-slate-400">
                  Overage forecast: <span className="text-amber-600 font-medium">{formatDate(rev!.predicted_overage_date)}</span>
                </p>
              )}
              {rev!.contract_end_date && (
                <p className="text-[11px] text-slate-400">
                  Contract ends: <span className="text-slate-600 font-medium">{formatDate(rev!.contract_end_date)}</span>
                </p>
              )}
            </div>
          )}

          {rev!.last_actual_date && (
            <p className="text-[11px] text-slate-400">Updated {formatDate(rev!.last_actual_date)}</p>
          )}
        </div>
      )}
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

  const [localResources, setLocalResources] = useState<Resource[]>([]);
  const [showAddResource, setShowAddResource] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<"note" | "link">("note");
  const [addContent, setAddContent] = useState("");
  const [expandedGongCallId, setExpandedGongCallId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"status" | "engagement" | null>(null);
  const [showAllTMRs, setShowAllTMRs] = useState(false);
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
  const { data: allTMRsRaw = [] } = useTMRs() as { data: TMR[] };
  const { data: meetings = [] } = useMeetingActivity(accountId, false) as { data: MeetingActivity[] };
  const { data: emailActivity } = useEmailActivity(accountId) as { data: EmailActivity | undefined };
  const accountTMRs = useMemo(() => (allTMRsRaw as TMR[]).filter((t) => t.account_id === accountId), [allTMRsRaw, accountId]);
  const { data: resources = [] } = useAccountResources(accountId) as { data: Resource[] };
  const { data: revenueSummary } = useAccountRevenueSummary(accountId) as { data: RevenueSummary | undefined };
  const { data: aceDisplayNames = {} } = useAceDisplayNames() as { data: Record<string, string> };
  const { data: trackingStatus } = useAccountTracking(accountId);
  const { data: adoption } = useAccountAdoption(accountId) as { data: AccountAdoptionData | undefined };
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
  const allResources = useMemo(() => [...localResources, ...resources], [localResources, resources]);

  const upcomingMeetingsList = useMemo(() => {
    const now = new Date();
    return meetings.filter((m) => m.is_upcoming || (m.activity_date != null && new Date(m.activity_date + "T00:00:00") > now));
  }, [meetings]);

  const activityItems = useMemo(() => {
    const now = new Date();
    const past = meetings.filter((m) => !m.is_upcoming && (m.activity_date == null || new Date(m.activity_date + "T00:00:00") <= now));
    const matchedGongIds = new Set<string>();
    const items: Array<{ key: string; date: string; meeting?: MeetingActivity; gong?: GongCall }> = [];
    for (const m of past) {
      const dateKey = m.activity_date?.slice(0, 10) ?? "";
      const matched = gongCalls.find((g) => g.call_date.slice(0, 10) === dateKey) ?? undefined;
      items.push({ key: m.activity_id, date: m.activity_date ?? "", meeting: m, gong: matched });
      if (matched) matchedGongIds.add(matched.call_id);
    }
    for (const g of gongCalls) {
      if (!matchedGongIds.has(g.call_id)) {
        items.push({ key: `gong-${g.call_id}`, date: g.call_date, gong: g });
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  }, [meetings, gongCalls]);

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

  function handleAddResource() {
    if (!addTitle.trim() || !addContent.trim()) return;
    setLocalResources((prev) => [{
      resource_id: `local-${Date.now()}`,
      account_id: accountId,
      title: addTitle.trim(),
      resource_type: addType,
      link_type: addType === "link" ? "external" : null,
      content: addContent.trim(),
      created_by: "you",
      created_at: new Date().toISOString(),
    }, ...prev]);
    setAddTitle(""); setAddContent(""); setShowAddResource(false);
  }

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
                {account.ae_email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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



      <div className="px-6 pb-8 flex gap-6">
        <div className="flex-1 min-w-0">

          {tab === "overview" && (
            <div className="space-y-4">
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
            <div className="space-y-4">
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
              />
            </div>
          )}

          {tab === "adoption" && (
            <>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
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

            <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <SecurityPostureChecklist accountId={accountId} />
            </div>
            </>
          )}
        </div>

        <div className="w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <CreditUsageSidebar rev={revenueSummary ?? null} />

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CalendarCheck2 size={12} className="text-emerald-500" />Meeting Activity
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Meetings (30d)</span>
                  <span className="text-xs font-semibold text-slate-800">{account.meetings_last_30d}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Upcoming (14d)</span>
                  <span className="text-xs font-semibold text-emerald-600">{upcomingMeetingsList.length}</span>
                </div>
              </div>
              {upcomingMeetingsList.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Upcoming</p>
                  {upcomingMeetingsList.slice(0, 3).map((m) => (
                    <div key={m.activity_id} className="text-[11px]">
                      <p className="text-slate-700 font-medium line-clamp-1">{m.subject ?? "Meeting"}</p>
                      <p className="text-slate-400">{m.activity_date ? new Date(m.activity_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</p>
                    </div>
                  ))}
                </div>
              )}
              {activityItems.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-0 divide-y divide-slate-50">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Recent Activity</p>
                  {activityItems.map((item) => {
                    const isExpanded = expandedGongCallId === item.key;
                    const tw = parseTakeaways(item.meeting?.takeaways);
                    const gong = item.gong;
                    return (
                      <div key={item.key} className="py-2 first:pt-0">
                        <button
                          type="button"
                          onClick={() => setExpandedGongCallId(isExpanded ? null : item.key)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <p className="text-[11px] font-medium text-slate-700 line-clamp-1 flex-1">
                              {item.meeting?.subject ?? gong?.title ?? "Meeting"}
                            </p>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatDate(item.date)}
                            </span>
                          </div>
                          {!isExpanded && (tw.recap || (gong && !item.meeting && gong.summary)) && (
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {tw.recap ?? gong?.summary}
                            </p>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-1.5 space-y-1.5">
                            {(tw.recap || (gong && !item.meeting && gong.summary)) && (
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                {tw.recap ?? gong?.summary}
                              </p>
                            )}
                            {tw.next_steps && tw.next_steps.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Next Steps</p>
                                <ul className="space-y-0.5">
                                  {tw.next_steps.slice(0, 3).map((s, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 flex gap-1 items-start">
                                      <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                      <span className="line-clamp-2">{s.replace(/^- /, "")}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!item.meeting && gong && gong.next_steps.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">Next Steps</p>
                                <ul className="space-y-0.5">
                                  {gong.next_steps.slice(0, 3).map((s, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 flex gap-1 items-start">
                                      <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                      <span className="line-clamp-2">{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                        {gong && extractUrl(gong.recording_url) && (
                          <a
                            href={extractUrl(gong.recording_url)!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-[11px] text-sky-600 hover:underline"
                          >
                            <PhoneCall size={10} />View recording
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {emailActivity && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Mail size={12} className="text-sky-400" />Email Activity
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Emails (30d)</span>
                    <span className="text-xs font-semibold text-slate-800">{emailActivity.emails_last_30d}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Outbound</span>
                    <span className="text-xs font-medium text-slate-700">{emailActivity.emails_outbound_30d}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Inbound</span>
                    <span className="text-xs font-medium text-slate-700">{emailActivity.emails_inbound_30d}</span>
                  </div>
                  {emailActivity.email_trend && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-500">Trend</span>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${
                        emailActivity.email_trend === "increasing" ? "text-emerald-600" :
                        emailActivity.email_trend === "declining" ? "text-rose-600" : "text-slate-500"
                      }`}>
                        {emailActivity.email_trend === "increasing" && <TrendingUp size={11} />}
                        {emailActivity.email_trend === "declining" && <TrendingDown size={11} />}
                        {emailActivity.email_trend}
                      </span>
                    </div>
                  )}
                  {emailActivity.last_email_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Last email</span>
                      <span className="text-xs text-slate-600">{formatDate(emailActivity.last_email_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Add Context</p>
                <button type="button" onClick={() => setShowContextInput((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 transition-colors">
                  <Plus size={11} /> {showContextInput ? "Close" : "Add"}
                </button>
              </div>

              {showContextInput && (
                <div className="space-y-2">
                  <select value={contextType} onChange={(e) => setContextType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400">
                    <option value="note">Observation</option>
                    <option value="email">Email</option>
                    <option value="meeting_note">Meeting Note</option>
                    <option value="slack">Slack</option>
                  </select>
                  <textarea
                    placeholder="Paste an email, meeting notes, or quick observation here… The AI will extract people, topics, risks, and action items automatically."
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  {contextResult && (
                    <div className="rounded-lg bg-sky-50 border border-sky-100 p-2.5 space-y-1">
                      {contextResult.sentiment && (
                        <p className="text-[11px] text-slate-600">
                          <span className="font-medium">Sentiment:</span>{" "}
                          <span className={contextResult.sentiment === "frustration" || contextResult.sentiment === "urgent" ? "text-red-600 font-medium" : contextResult.sentiment === "positive" ? "text-green-600" : "text-slate-600"}>
                            {contextResult.sentiment}
                          </span>
                        </p>
                      )}
                      {contextResult.summary && (
                        <p className="text-[11px] text-slate-600"><span className="font-medium">Summary:</span> {contextResult.summary}</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setShowContextInput(false); setContextText(""); setContextResult(null); }}
                      className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button type="button"
                      disabled={!contextText.trim() || contextSubmitting}
                      onClick={async () => {
                        if (!contextText.trim()) return;
                        setContextSubmitting(true);
                        setContextResult(null);
                        try {
                          const res = await addContext.mutateAsync({ content: contextText, context_type: contextType, source: "manual" });
                          setContextResult({ summary: res.summary ?? null, sentiment: res.sentiment ?? null });
                          setContextText("");
                        } finally {
                          setContextSubmitting(false);
                        }
                      }}
                      className="rounded bg-sky-500 px-2.5 py-1 text-xs text-white hover:bg-sky-600 disabled:opacity-40">
                      {contextSubmitting ? "Analyzing…" : "Submit"}
                    </button>
                  </div>
                </div>
              )}

              {contextNotes.length > 0 && (
                <div className="mt-3 space-y-2 divide-y divide-slate-50">
                  {(contextNotes as ContextNote[]).slice(0, 5).map((note, i) => (
                    <div key={note.context_id ?? i} className="pt-2 first:pt-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          note.sentiment === "frustration" || note.sentiment === "urgent" ? "bg-red-50 text-red-600" :
                          note.sentiment === "positive" ? "bg-green-50 text-green-600" :
                          "bg-slate-100 text-slate-500"
                        }`}>{note.sentiment ?? note.context_type ?? "note"}</span>
                        <span className="text-[10px] text-slate-400">{note.created_at ? new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{note.parsed_summary ?? note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {contextNotes.length === 0 && !showContextInput && (
                <p className="text-xs text-slate-400">No context added yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Resources & Notes</p>
                <button type="button" onClick={() => setShowAddResource((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 transition-colors">
                  <Plus size={11} /> Add info
                </button>
              </div>

              {showAddResource && (
                <div className="mb-3 space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    {(["note", "link"] as const).map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input type="radio" value={t} checked={addType === t} onChange={() => setAddType(t)} />
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </label>
                    ))}
                  </div>
                  <input type="text" placeholder="Title" value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  {addType === "note" ? (
                    <textarea placeholder="Note content…" value={addContent} onChange={(e) => setAddContent(e.target.value)} rows={3}
                      className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  ) : (
                    <input type="url" placeholder="https://…" value={addContent} onChange={(e) => setAddContent(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setShowAddResource(false); setAddTitle(""); setAddContent(""); }}
                      className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button type="button" onClick={handleAddResource}
                      disabled={!addTitle.trim() || !addContent.trim()}
                      className="rounded bg-sky-500 px-2.5 py-1 text-xs text-white hover:bg-sky-600 disabled:opacity-40">Save</button>
                  </div>
                </div>
              )}

              {allResources.length === 0 ? (
                <p className="text-xs text-slate-400">No resources added yet.</p>
              ) : (
                <div className="space-y-0 divide-y divide-slate-50">
                  {(allResources as Resource[]).map((r) => (
                    <div key={r.resource_id} className="flex gap-2.5 py-2.5 first:pt-0">
                      <FileText size={13} className="shrink-0 mt-0.5 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{r.title}</p>
                        {r.resource_type === "note" ? (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{r.content}</p>
                        ) : (
                          <a href={r.content} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-sky-600 hover:underline truncate block mt-0.5">{r.content}</a>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">{r.created_by} · {formatDate(r.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>



            {accountTMRs.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TMRs ({accountTMRs.length})</p>
                  {accountTMRs.length > 2 && (
                    <button onClick={() => setShowAllTMRs((v) => !v)} className="text-[11px] text-sky-600 hover:underline">{showAllTMRs ? "Show less" : "Show all"}</button>
                  )}
                </div>
                <div className="space-y-2 divide-y divide-slate-50">
                  {(showAllTMRs ? accountTMRs : accountTMRs.slice(0, 2)).map((tmr) => (
                    <div key={tmr.tmr_id} className="py-2 first:pt-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-xs font-medium text-slate-800 line-clamp-1 flex-1">{tmr.activity_requested ?? tmr.engagement_type ?? "TMR"}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${tmr.status === "Closed" ? "bg-slate-100 text-slate-400" : "bg-amber-50 text-amber-700"}`}>{tmr.status}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{tmr.requestor} {tmr.requested_date ? `· ${formatDate(tmr.requested_date)}` : ""}</p>
                      {tmr.specialist_comments && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{tmr.specialist_comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

