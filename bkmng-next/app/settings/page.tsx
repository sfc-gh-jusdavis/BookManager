"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle, ArrowLeft, Bell, Mail, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import {
  useUserPreferences,
  useUpdatePreferences,
  useAlertPreferences,
  useUpdateAlertPreference,
  AlertPreferenceItem,
} from "@/hooks/useApi";

type Tab = "ace" | "alerts";
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

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("ace");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
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
      </div>

      {tab === "ace" && <ACETab />}
      {tab === "alerts" && <AlertsTab />}
    </div>
  );
}
