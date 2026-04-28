"use client";

import { useState, useMemo } from "react";
import {
  useAlerts,
  useAlertCount,
  useAlertPreferences,
  useDismissAlert,
  useMarkAlertRead,
  useMarkAllAlertsRead,
  useMuteAlert,
  AlertPreferenceItem,
} from "@/hooks/useApi";
import { Bell, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AlertRow } from "@/components/alerts/AlertRow";

type CategoryKey = "use_case" | "engagement" | "consumption" | "support" | "security" | "intelligence" | "other";

const CATEGORY_ORDER: CategoryKey[] = [
  "use_case",
  "engagement",
  "consumption",
  "support",
  "security",
  "intelligence",
  "other",
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  use_case: "Use Cases",
  engagement: "Engagement",
  consumption: "Consumption",
  support: "Support",
  security: "Security",
  intelligence: "Intelligence",
  other: "Other",
};

const CATEGORY_ACCENT: Record<CategoryKey, string> = {
  use_case: "bg-indigo-50 text-indigo-600 border-indigo-200",
  engagement: "bg-sky-50 text-sky-600 border-sky-200",
  consumption: "bg-emerald-50 text-emerald-600 border-emerald-200",
  support: "bg-amber-50 text-amber-600 border-amber-200",
  security: "bg-rose-50 text-rose-600 border-rose-200",
  intelligence: "bg-purple-50 text-purple-600 border-purple-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

const INTELLIGENCE_TYPES = new Set<string>([
  "customer_frustration",
  "user_reported_risk",
  "user_reported_blocker",
  "user_reported_opportunity",
  "competitor_mentioned",
]);

function signalCategory(signalType: string, prefsMap: Map<string, AlertPreferenceItem>): CategoryKey {
  if (INTELLIGENCE_TYPES.has(signalType)) return "intelligence";
  if (signalType.startsWith("security_")) return "security";
  const pref = prefsMap.get(signalType);
  if (
    pref?.category === "use_case" ||
    pref?.category === "engagement" ||
    pref?.category === "consumption" ||
    pref?.category === "support" ||
    pref?.category === "security"
  ) {
    return pref.category as CategoryKey;
  }
  return "other";
}

export default function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const { data: alertCountData } = useAlertCount();
  const { data: prefs } = useAlertPreferences();
  const serverUnreadCount = alertCountData?.count ?? 0;
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const dismiss = useDismissAlert();
  const mute = useMuteAlert();

  const [expanded, setExpanded] = useState<Set<CategoryKey>>(new Set());

  const prefsMap = useMemo(() => {
    const m = new Map<string, AlertPreferenceItem>();
    (prefs ?? []).forEach((p) => m.set(p.signal_type, p));
    return m;
  }, [prefs]);

  type AlertRow2 = NonNullable<typeof alerts>[number];

  const grouped = useMemo(() => {
    const g: Record<CategoryKey, AlertRow2[]> = {
      use_case: [],
      engagement: [],
      consumption: [],
      support: [],
      security: [],
      intelligence: [],
      other: [],
    };
    (alerts ?? []).forEach((a) => {
      const cat = signalCategory(a.signal_type, prefsMap);
      g[cat].push(a);
    });
    return g;
  }, [alerts, prefsMap]);

  const totalUnread = (alerts ?? []).filter((a) => !a.is_read).length;

  const toggle = (cat: CategoryKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--snow-500)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const visibleCategories = CATEGORY_ORDER.filter(
    (c) => c !== "other" || grouped[c].length > 0
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Bell size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-800">Alerts</h1>
        {totalUnread > 0 && (
          <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">
            {totalUnread} new
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-6 ml-8">
        <p className="text-xs text-slate-400">
          {totalUnread === 0
            ? "You\u2019re all caught up."
            : `${totalUnread} unread alert${totalUnread > 1 ? "s" : ""}`}
        </p>
        {serverUnreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {(!alerts || alerts.length === 0) && (
        <div className="text-center py-16 text-slate-400">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No alerts right now.</p>
        </div>
      )}

      {visibleCategories.length > 0 && (
        <>
          {/* Category tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {visibleCategories.map((cat) => {
              const items = grouped[cat];
              const unreadCount = items.filter((a) => !a.is_read).length;
              const totalCount = items.length;
              const isOpen = expanded.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggle(cat)}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                    isOpen ? "ring-2 ring-sky-300 " : ""
                  }${CATEGORY_ACCENT[cat]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{CATEGORY_LABELS[cat]}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-bold text-slate-800">{unreadCount}</span>
                    <span className="text-[10px] text-slate-500">unread</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{totalCount} total</div>
                </button>
              );
            })}
          </div>

          {/* Expanded category sections */}
          <div className="space-y-6">
            {visibleCategories
              .filter((c) => expanded.has(c))
              .map((cat) => {
                const items = grouped[cat];
                const unread = items.filter((a) => !a.is_read);
                const read = items.filter((a) => a.is_read);
                return (
                  <section key={cat} className="rounded-xl border border-slate-200 bg-slate-50/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-slate-700">{CATEGORY_LABELS[cat]}</h2>
                      <button
                        onClick={() => toggle(cat)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Collapse
                      </button>
                    </div>
                    {unread.length === 0 && read.length === 0 && (
                      <p className="text-xs text-slate-400 italic py-2">No alerts in this category right now.</p>
                    )}
                    {unread.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          New ({unread.length})
                        </h3>
                        <div className="space-y-2">
                          {unread.map((alert) => (
                            <AlertRow
                              key={alert.alert_id}
                              alert={alert}
                              onMarkRead={(id) => markRead.mutate(id)}
                              onDismiss={(id) => dismiss.mutate(id)}
                              onMute={(id, scope) => mute.mutate({ alertId: id, scope })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {read.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Read ({read.length})
                        </h3>
                        <div className="space-y-2">
                          {read.map((alert) => (
                            <AlertRow
                              key={alert.alert_id}
                              alert={alert}
                              onMarkRead={(id) => markRead.mutate(id)}
                              onDismiss={(id) => dismiss.mutate(id)}
                              onMute={(id, scope) => mute.mutate({ alertId: id, scope })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            {expanded.size === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">
                Click a tile above to view alerts in that category.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
