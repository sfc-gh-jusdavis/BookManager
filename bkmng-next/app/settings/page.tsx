"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Loader2, CheckCircle, ArrowLeft, Bell, Mail, ChevronRight, FlaskConical, Trash2, Plus, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { withFlagGate } from "@/components/ui/flag-gate";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  useUserPreferences,
  useUpdatePreferences,
  useAlertPreferences,
  useUpdateAlertPreference,
  AlertPreferenceItem,
  useAdminFlags,
  useUpsertFlag,
  useUpsertFlagOverride,
  useDeleteFlagOverride,
  FlagWithOverrides,
  useMyImpactMetrics,
  ImpactMetricRow,
} from "@/hooks/useApi";
import { useFeatureFlag } from "@/context/FeatureFlagContext";

type Tab = "ace" | "alerts" | "labs" | "impact";
type AlertSubTab = "use_cases" | "engagement" | "consumption" | "support" | "security" | "intelligence";

const PRIORITY_OPTIONS = ["high", "medium", "low"] as const;

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-600 ring-red-200",
  medium: "bg-amber-50 text-amber-600 ring-amber-200",
  low: "bg-slate-50 text-slate-500 ring-slate-200",
};

function PrioritySelector({
  value,
  defaultPriority,
  onChange,
  disabled,
}: {
  value: string;
  defaultPriority: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isOverridden = value !== defaultPriority;

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
        {PRIORITY_OPTIONS.map((p) => (
          <button
            key={p}
            disabled={disabled}
            onClick={() => onChange(p)}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              value === p
                ? p === "high"
                  ? "bg-red-500 text-white"
                  : p === "medium"
                  ? "bg-amber-400 text-white"
                  : "bg-slate-400 text-white"
                : "bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {isOverridden ? (
        <button
          onClick={() => onChange(defaultPriority)}
          className="text-[10px] text-sky-500 hover:text-sky-600 hover:underline"
        >
          Reset to default
        </button>
      ) : (
        <span className="text-[10px] text-slate-400">(default)</span>
      )}
    </div>
  );
}

function ACETab() {
  const { data: prefs, isLoading } = useUserPreferences();
  const updateMutation = useUpdatePreferences();

  const [preferredName, setPreferredName] = useState("");
  const [greetingStyle, setGreetingStyle] = useState("Hi [Name],");
  const [closingStyle, setClosingStyle] = useState("Best, ACE");
  const [writingExamples, setWritingExamples] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefs) {
      setPreferredName(prefs.preferred_name || "");
      setGreetingStyle(prefs.greeting_style || "Hi [Name],");
      setClosingStyle(prefs.closing_style || "Best, ACE");
      setWritingExamples(prefs.writing_examples?.join("\n---\n") || "");
    }
  }, [prefs]);

  const handleSave = () => {
    const examples = writingExamples
      .split("\n---\n")
      .map((s) => s.trim())
      .filter(Boolean);

    updateMutation.mutate(
      {
        preferred_name: preferredName || null,
        greeting_style: greetingStyle || null,
        closing_style: closingStyle || null,
        writing_examples: examples.length > 0 ? examples : null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Email Personalization</h2>
        <p className="text-xs text-slate-500 mb-5">
          Configure how ACE writes emails and messages on your behalf. These preferences are used
          when you ask ACE to draft communications.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Preferred Name
            </label>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g. Justin, JD, J. Davis"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
            <p className="mt-1 text-xs text-slate-400">How ACE should sign off emails for you</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Greeting Style
            </label>
            <input
              type="text"
              value={greetingStyle}
              onChange={(e) => setGreetingStyle(e.target.value)}
              placeholder="e.g. Hi [Name], / Hello [Name], / Hey [Name]!"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
            <p className="mt-1 text-xs text-slate-400">[Name] will be replaced with the recipient&apos;s name</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Closing Style
            </label>
            <input
              type="text"
              value={closingStyle}
              onChange={(e) => setClosingStyle(e.target.value)}
              placeholder="e.g. Best, ACE / Warm regards, / Thanks!"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Writing Style Examples
            </label>
            <textarea
              value={writingExamples}
              onChange={(e) => setWritingExamples(e.target.value)}
              rows={8}
              placeholder={"Paste 1-3 example emails or messages you've written.\nSeparate each example with a line containing only ---\n\nExample 1:\nHi Sarah, just wanted to follow up on...\n---\nExample 2:\nHey team, quick update on..."}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 font-mono"
            />
            <p className="mt-1 text-xs text-slate-400">
              ACE will match your tone and style. Separate examples with &quot;---&quot; on its own line.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle size={14} />
              Saved
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Preferences
        </button>
      </div>
    </div>
  );
}

function AlertToggleCard({ item }: { item: AlertPreferenceItem }) {
  const mutation = useUpdateAlertPreference();

  const handleToggle = (checked: boolean) => {
    mutation.mutate({
      signal_type: item.signal_type,
      enabled: checked,
      priority_override: item.priority !== item.default_priority ? item.priority : null,
    });
  };

  const handlePriorityChange = (newPriority: string) => {
    mutation.mutate({
      signal_type: item.signal_type,
      enabled: item.enabled,
      priority_override: newPriority !== item.default_priority ? newPriority : null,
    });
  };

  return (
    <div className={`rounded-xl border bg-white p-5 transition-opacity ${item.enabled ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{item.label}</h3>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset whitespace-nowrap ${PRIORITY_BADGE[item.priority] ?? PRIORITY_BADGE.low}`}>
            {item.priority}
            {item.priority !== item.default_priority && " \u2022 custom"}
          </span>
        </div>
        <Switch
          checked={item.enabled}
          onCheckedChange={handleToggle}
          disabled={mutation.isPending}
        />
      </div>

      <p className="text-xs text-slate-600 mt-3 leading-relaxed">{item.description}</p>

      {item.enabled && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-500">Priority</span>
          <PrioritySelector
            value={item.priority}
            defaultPriority={item.default_priority}
            onChange={handlePriorityChange}
            disabled={mutation.isPending}
          />
        </div>
      )}

      <details className="group mt-4">
        <summary className="flex items-center gap-1 text-[11px] font-medium text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
          How is this generated?
        </summary>
        <p className="mt-2 text-xs text-slate-500 pl-4 border-l-2 border-slate-100">
          {item.how_generated}
        </p>
      </details>
    </div>
  );
}

const INTELLIGENCE_CATALOG = [
  {
    signal_type: "customer_frustration",
    label: "Customer Frustration",
    description:
      "Detected when a context note you've added carries a frustrated or urgent sentiment. Always active.",
    how_generated:
      "Parsed in real-time from BKMNG_USER_CONTEXT_V2. Fires when SENTIMENT is 'frustration' or 'urgent'. Cannot be disabled.",
  },
  {
    signal_type: "user_reported_risk",
    label: "SE-Reported Risk",
    description:
      "Fires when a context note contains high-severity risks in the parsed risk array. Always active.",
    how_generated:
      "Parsed from RISKS_IDENTIFIED in BKMNG_USER_CONTEXT_V2. Only high-severity risk entries trigger this signal. Cannot be disabled.",
  },
  {
    signal_type: "user_reported_blocker",
    label: "SE-Reported Blocker",
    description:
      "Fires when a context note you've added identifies a blocker. Always active.",
    how_generated:
      "Parsed from BLOCKERS_MENTIONED in BKMNG_USER_CONTEXT_V2. Any non-empty blockers array triggers this signal. Cannot be disabled.",
  },
];

const SUB_TABS: { id: AlertSubTab; label: string; category: string | null }[] = [
  { id: "use_cases",    label: "Use Cases",    category: "use_case" },
  { id: "engagement",   label: "Engagement",   category: "engagement" },
  { id: "consumption",  label: "Consumption",  category: "consumption" },
  { id: "support",      label: "Support",      category: "support" },
  { id: "security",     label: "Security",     category: "security" },
  { id: "intelligence", label: "Intelligence", category: null },
];

function IntelligenceCard({
  label,
  description,
  howGenerated,
}: {
  label: string;
  description: string;
  howGenerated: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset whitespace-nowrap bg-red-50 text-red-600 ring-red-200">
            high
          </span>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-1 whitespace-nowrap">
          Always on
        </span>
      </div>
      <p className="text-xs text-slate-600 mt-3 leading-relaxed">{description}</p>
      <details className="group mt-4">
        <summary className="flex items-center gap-1 text-[11px] font-medium text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
          How is this generated?
        </summary>
        <p className="mt-2 text-xs text-slate-500 pl-4 border-l-2 border-slate-100">
          {howGenerated}
        </p>
      </details>
    </div>
  );
}

function AlertsTab() {
  const [subTab, setSubTab] = useState<AlertSubTab>("use_cases");
  const { data: alertPrefs, isLoading } = useAlertPreferences();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentTab = SUB_TABS.find((t) => t.id === subTab)!;
  const items =
    currentTab.category !== null
      ? (alertPrefs || []).filter((a) => a.category === currentTab.category)
      : [];
  const enabledCount = items.filter((a) => a.enabled).length;
  const customCount = items.filter((a) => a.priority !== a.default_priority).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
              subTab === tab.id
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {subTab === "intelligence" ? (
          <>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Intelligence Signals</h2>
              <p className="text-xs text-slate-500 mt-1">
                These signals are derived from your context notes and are always active. They cannot
                be disabled or have their priority changed.
              </p>
            </div>
            <div className="space-y-3">
              {INTELLIGENCE_CATALOG.map((item) => (
                <IntelligenceCard
                  key={item.signal_type}
                  label={item.label}
                  description={item.description}
                  howGenerated={item.how_generated}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {currentTab.label} Alerts
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {items.length === 0
                  ? "No alerts in this category."
                  : `${enabledCount} of ${items.length} enabled${
                      customCount > 0 ? ` \u00b7 ${customCount} with custom priority` : ""
                    }`}
              </p>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No alerts configured in this category.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <AlertToggleCard key={item.signal_type} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FlagCard({ flag }: { flag: FlagWithOverrides }) {
  const upsertFlag = useUpsertFlag();
  const upsertOverride = useUpsertFlagOverride();
  const deleteOverride = useDeleteFlagOverride();

  const [showAdd, setShowAdd] = useState(false);
  const [targetType, setTargetType] = useState<"user" | "role">("user");
  const [targetValue, setTargetValue] = useState("");
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-semibold text-slate-800">{flag.flag_key}</code>
            {flag.category && (
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-medium uppercase">
                {flag.category}
              </span>
            )}
          </div>
          {flag.description && (
            <p className="text-xs text-slate-500 mt-1">{flag.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500">Default</span>
          <Switch
            checked={flag.default_enabled}
            onCheckedChange={(v) =>
              upsertFlag.mutate({
                flag_key: flag.flag_key,
                description: flag.description,
                category: flag.category,
                default_enabled: v,
              })
            }
            disabled={upsertFlag.isPending}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Overrides ({flag.overrides.length})
          </p>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700"
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {flag.overrides.length === 0 && !showAdd && (
          <p className="text-[11px] text-slate-400 italic">No overrides. Falls back to default.</p>
        )}

        {flag.overrides.length > 0 && (
          <div className="space-y-1">
            {flag.overrides.map((o) => (
              <div
                key={`${o.target_type}-${o.target_value}`}
                className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded px-2 py-1"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center rounded bg-slate-200 text-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    {o.target_type}
                  </span>
                  <code className="text-slate-700 truncate">{o.target_value}</code>
                  <span className={`text-[10px] font-semibold ${o.enabled ? "text-emerald-600" : "text-rose-600"}`}>
                    {o.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                </span>
                <button
                  onClick={() =>
                    deleteOverride.mutate({
                      flag_key: flag.flag_key,
                      target_type: o.target_type,
                      target_value: o.target_value,
                    })
                  }
                  className="text-slate-400 hover:text-rose-500 shrink-0"
                  title="Remove override"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as "user" | "role")}
                className="text-xs rounded border border-slate-200 px-2 py-1 bg-white"
              >
                <option value="user">User</option>
                <option value="role">Role</option>
              </select>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === "user" ? "jusdavis" : "ace | acem"}
                className="flex-1 text-xs rounded border border-slate-200 px-2 py-1"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                {enabled ? "On" : "Off"}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Cancel
              </button>
              <button
                disabled={!targetValue.trim() || upsertOverride.isPending}
                onClick={() => {
                  upsertOverride.mutate(
                    {
                      flag_key: flag.flag_key,
                      target_type: targetType,
                      target_value: targetValue.trim(),
                      enabled,
                    },
                    {
                      onSuccess: () => {
                        setShowAdd(false);
                        setTargetValue("");
                        setEnabled(true);
                      },
                    }
                  );
                }}
                className="text-[11px] font-medium bg-sky-600 text-white rounded px-3 py-1 disabled:opacity-50"
              >
                Add Override
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LabsTab() {
  const { data: flags, isLoading } = useAdminFlags();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Feature Flags</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enable or disable experimental features globally, per user, or per role. User overrides take
          precedence over role overrides, which take precedence over the default.
        </p>
      </div>
      <div className="space-y-3">
        {(flags || []).map((flag) => (
          <FlagCard key={flag.flag_key} flag={flag} />
        ))}
      </div>
    </div>
  );
}

function dollarShort(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toFixed(0)}`;
}

function ImpactTab() {
  const { data: metrics = [], isLoading } = useMyImpactMetrics();

  const totals = useMemo(() => {
    const m = metrics as ImpactMetricRow[];
    return {
      accounts: m.length,
      totalIncrementalRevenue: m.reduce((s, r) => s + (r.INCREMENTAL_REVENUE ?? 0), 0),
      totalRunRateDelta: m.reduce((s, r) => s + (r.RUN_RATE_DELTA ?? 0), 0),
      totalUseCases: m.reduce((s, r) => s + (r.TOTAL_USE_CASES_ASSIGNED ?? 0), 0),
      totalWon: m.reduce((s, r) => s + (r.WON_USE_CASE_CNT ?? 0), 0),
      totalTechWins: m.reduce((s, r) => s + (r.TECH_WIN_USE_CASE_CNT ?? 0), 0),
      totalMeetings: m.reduce((s, r) => s + (r.TOTAL_MEETINGS_WITH_ACCOUNT_ENGINEER ?? 0), 0),
      totalWonEacv: m.reduce((s, r) => s + (r.WON_EACV ?? 0), 0),
      totalTechWinEacv: m.reduce((s, r) => s + (r.TECH_WIN_EACV ?? 0), 0),
    };
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">No impact metrics found for your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Account Impact Metrics</h2>
        <p className="text-xs text-slate-500 mt-1">
          Revenue impact and use case progress across your assigned accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Accounts</p>
          <p className="text-lg font-bold text-slate-800 mt-1">{totals.accounts}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Incremental Revenue</p>
          <p className="text-lg font-bold text-emerald-800 mt-1">{dollarShort(totals.totalIncrementalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">Run Rate Delta</p>
          <p className="text-lg font-bold text-sky-800 mt-1">{dollarShort(totals.totalRunRateDelta)}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Won eACV</p>
          <p className="text-lg font-bold text-violet-800 mt-1">{dollarShort(totals.totalWonEacv)}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-sm font-bold text-slate-800">{totals.totalUseCases}</p>
          <p className="text-[10px] text-slate-500">Use Cases</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-sm font-bold text-emerald-700">{totals.totalWon}</p>
          <p className="text-[10px] text-slate-500">Won</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-sm font-bold text-sky-700">{totals.totalTechWins}</p>
          <p className="text-[10px] text-slate-500">Tech Wins</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
          <p className="text-sm font-bold text-slate-700">{totals.totalMeetings}</p>
          <p className="text-[10px] text-slate-500">Meetings</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Account</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Days</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Pre-ACE Run Rate</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Current Run Rate</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Delta</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Growth %</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Incr. Rev</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">UCs</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Won</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Meetings</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-600">Last Meeting</th>
              </tr>
            </thead>
            <tbody>
              {(metrics as ImpactMetricRow[]).map((row) => {
                const growth = row.RUN_RATE_GROWTH_PCT;
                return (
                  <tr key={row.ACCOUNT_NAME} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate">{row.ACCOUNT_NAME ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.DAYS_SINCE_ASSIGNED ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{dollarShort(row.PRE_ACE_RUN_RATE)}</td>
                    <td className="px-3 py-2 text-right text-slate-800 font-medium">{dollarShort(row.CURRENT_RUN_RATE)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      (row.RUN_RATE_DELTA ?? 0) > 0 ? "text-emerald-600" : (row.RUN_RATE_DELTA ?? 0) < 0 ? "text-rose-600" : "text-slate-500"
                    }`}>
                      <span className="inline-flex items-center gap-0.5">
                        {(row.RUN_RATE_DELTA ?? 0) > 0 && <ArrowUpRight size={10} />}
                        {(row.RUN_RATE_DELTA ?? 0) < 0 && <ArrowDownRight size={10} />}
                        {dollarShort(row.RUN_RATE_DELTA)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      (growth ?? 0) > 0 ? "text-emerald-600" : (growth ?? 0) < 0 ? "text-rose-600" : "text-slate-500"
                    }`}>
                      {growth != null ? `${growth > 0 ? "+" : ""}${growth}%` : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      (row.INCREMENTAL_REVENUE ?? 0) > 0 ? "text-emerald-600" : "text-slate-500"
                    }`}>{dollarShort(row.INCREMENTAL_REVENUE)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.TOTAL_USE_CASES_ASSIGNED ?? 0}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{row.WON_USE_CASE_CNT ?? 0}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.TOTAL_MEETINGS_WITH_ACCOUNT_ENGINEER ?? 0}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {row.LAST_MEETING_WITH_ACCOUNT_DATE
                        ? new Date(row.LAST_MEETING_WITH_ACCOUNT_DATE + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.is_admin ?? false;
  const impactEnabled = useFeatureFlag("ace_impact_metrics");
  const [tab, setTab] = useState<Tab>("ace");

  return (
    <div className={`mx-auto px-6 py-8 ${tab === "impact" ? "max-w-5xl" : "max-w-2xl"}`}>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500">Manage your ACE preferences and alert configuration</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setTab("ace")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === "ace"
              ? "border-sky-500 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Mail size={14} />
          ACE
        </button>
        <button
          onClick={() => setTab("alerts")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            tab === "alerts"
              ? "border-sky-500 text-sky-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Bell size={14} />
          Alerts
        </button>
        {impactEnabled && (
          <button
            onClick={() => setTab("impact")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === "impact"
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <TrendingUp size={14} />
            Impact
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setTab("labs")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === "labs"
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FlaskConical size={14} />
            Labs
          </button>
        )}
      </div>

      {tab === "ace" && <ACETab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "impact" && impactEnabled && <ImpactTab />}
      {tab === "labs" && isAdmin && <LabsTab />}
    </div>
  );
}

export default withFlagGate(SettingsPage, "page_settings");
