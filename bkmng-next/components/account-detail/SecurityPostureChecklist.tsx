"use client";

import { useState } from "react";
import {
  useSecurityPosture,
  useSetSecurityOverride,
  useDeleteSecurityOverride,
} from "@/hooks/useApi";
import type {
  SecurityPostureData,
  SecurityTier,
  SecurityMilestone,
} from "@/hooks/useApi";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Minus,
  ChevronDown,
  MessageSquare,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  complete: { icon: ShieldCheck, color: "text-emerald-600", label: "Complete" },
  partial: { icon: ShieldAlert, color: "text-amber-500", label: "Partial" },
  not_started: { icon: ShieldX, color: "text-red-400", label: "Not Started" },
  not_applicable: { icon: Minus, color: "text-slate-300", label: "N/A" },
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-50 text-red-600 border-red-100",
  high: "bg-amber-50 text-amber-600 border-amber-100",
  medium: "bg-slate-50 text-slate-500 border-slate-200",
  informational: "bg-sky-50 text-sky-500 border-sky-100",
};

const OVERRIDE_OPTIONS = [
  { value: "in_progress", label: "In Progress" },
  { value: "planned", label: "Planned" },
  { value: "blocked", label: "Blocked" },
  { value: "not_applicable", label: "Not Applicable" },
  { value: "complete", label: "Complete (manual)" },
] as const;

function ScoreBar({ score, applicable }: { score: number; applicable: number }) {
  const pct = applicable > 0 ? Math.round((score / applicable) * 100) : 0;
  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
        {score}/{applicable}
      </span>
    </div>
  );
}

function TierSection({
  tier,
  accountId,
}: {
  tier: SecurityTier;
  accountId: string;
}) {
  const [open, setOpen] = useState(true);
  const met = tier.milestones.filter((m) => m.status === "complete").length;
  const applicable = tier.milestones.filter((m) => m.status !== "not_applicable").length;

  const noTelemetry = tier.milestones
    .filter((m) => m.status !== "not_applicable")
    .every((m) => m.raw_value?.no_source_data === 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={13} className="text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
            {tier.tier_name}
          </span>
          <span className="text-[11px] text-slate-400">
            ({met}/{applicable})
          </span>
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {noTelemetry && (
            <div className="flex items-start gap-2 mx-3 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-md text-[11px] text-amber-700">
              <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                No Snowflake telemetry available for this account — controls cannot be assessed
                from data alone. Verify directly with customer.
              </span>
            </div>
          )}
          <div className="divide-y divide-slate-50">
            {tier.milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} accountId={accountId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({
  milestone: m,
  accountId,
}: {
  milestone: SecurityMilestone;
  accountId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState(m.ace_override?.status || "in_progress");
  const [overrideNotes, setOverrideNotes] = useState(m.ace_override?.notes || "");

  const { mutate: saveOverride, isPending: saving } = useSetSecurityOverride(accountId);
  const { mutate: deleteOverride } = useDeleteSecurityOverride(accountId);

  const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.not_started;
  const Icon = cfg.icon;
  const disclaimer = m.raw_value?.disclaimer as string | undefined;
  const dataConfidence = m.raw_value?.data_confidence as string | undefined;
  const showDisclaimer = dataConfidence && dataConfidence !== "high";

  const handleSave = () => {
    saveOverride(
      { milestone_id: m.id, ace_status: overrideStatus, ace_notes: overrideNotes },
      { onSuccess: () => setOverrideOpen(false) },
    );
  };

  const handleRemoveOverride = () => {
    deleteOverride({ milestone_id: m.id });
    setOverrideOpen(false);
  };

  return (
    <div className="px-4 py-2.5">
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => setExpanded((e) => !e)}
      >
        <Icon size={15} className={cfg.color} />
        <span className="text-xs text-slate-700 flex-1">{m.name}</span>
        {showDisclaimer && (
          <AlertTriangle size={11} className="text-amber-400 shrink-0" aria-label={disclaimer} />
        )}
        {m.industry_required && (
          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">
            required
          </span>
        )}
        {m.priority !== "informational" && (
          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[m.priority] || ""}`}>
            {m.priority}
          </span>
        )}
        {m.ace_override && (
          <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 border border-sky-100">
            ACE: {m.ace_override.status.replace("_", " ")}
          </span>
        )}
        <ChevronDown
          size={11}
          className={`text-slate-300 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {expanded && (
        <div className="mt-2 ml-7 space-y-2">
          {m.llm_summary && (
            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 rounded-md p-2 border border-slate-100">
              {m.llm_summary}
            </p>
          )}
          {!m.llm_summary && m.raw_value && (
            <div className="text-[10px] text-slate-400 flex flex-wrap gap-2">
              {Object.entries(m.raw_value)
                .filter(([k]) => k !== "disclaimer" && k !== "data_confidence")
                .map(([k, v]) => (
                  <span key={k} className="bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                    {k}: {String(v)}
                  </span>
                ))}
            </div>
          )}
          {showDisclaimer && disclaimer && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-2">
              <AlertTriangle size={10} className="text-amber-500 shrink-0 mt-0.5" />
              <span>{disclaimer}</span>
            </div>
          )}
          {m.ace_override && (
            <div className="text-[11px] bg-sky-50 border border-sky-100 rounded-md p-2">
              <span className="font-semibold text-sky-700">ACE Override:</span>{" "}
              <span className="text-sky-600">{m.ace_override.status.replace("_", " ")}</span>
              {m.ace_override.notes && (
                <span className="text-sky-500"> — {m.ace_override.notes}</span>
              )}
              <span className="text-sky-400 block mt-0.5">
                by {m.ace_override.updated_by?.split("@")[0]} • {m.ace_override.updated_at?.split("T")[0]}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOverrideOpen((o) => !o);
              }}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-500 transition-colors"
            >
              <MessageSquare size={10} />
              {m.ace_override ? "Update Feedback" : "Add Feedback"}
            </button>
            {m.ace_override && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveOverride();
                }}
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={10} />
                Remove
              </button>
            )}
          </div>
          {overrideOpen && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase w-14">Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="flex-1 text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                >
                  {OVERRIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase w-14 pt-1.5">Notes</label>
                <textarea
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g., Customer rolling out Duo Q3 2026"
                  className="flex-1 text-xs rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 resize-none"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideOpen(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 rounded px-3 py-1 transition-colors"
                >
                  <Save size={10} />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SecurityPostureChecklist({ accountId }: { accountId: string }) {
  const { data: posture, isLoading } = useSecurityPosture(accountId) as {
    data: SecurityPostureData | undefined;
    isLoading: boolean;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!posture || posture.tiers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
        <Shield size={18} className="text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No security posture data available for this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield size={13} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Security Posture
          </p>
        </div>
        {posture.last_checked && (
          <span className="text-[10px] text-slate-400">
            Scanned {new Date(posture.last_checked).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      <ScoreBar score={posture.overall_score} applicable={posture.applicable_milestones} />

      {posture.industry && (
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>Industry: <span className="font-medium text-slate-600">{posture.industry}</span></span>
          {posture.service_level && (
            <>
              <span>•</span>
              <span>Edition: <span className="font-medium text-slate-600">{posture.service_level}</span></span>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {posture.tiers.map((tier) => (
          <TierSection key={tier.tier_id} tier={tier} accountId={posture.account_id} />
        ))}
      </div>
    </div>
  );
}
