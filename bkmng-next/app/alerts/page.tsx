"use client";

import { useState, useRef, useEffect } from "react";
import { useAlerts, useDismissAlert, useMarkAlertRead, useMuteAlert } from "@/hooks/useApi";
import { Bell, BellOff, Check, X, ChevronDown } from "lucide-react";
import Link from "next/link";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-slate-50 border-slate-200 text-slate-600",
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function MuteDropdown({ alertId, onMute }: { alertId: string; onMute: (scope: "instance" | "type") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
        title="Mute"
      >
        <BellOff size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <button
            onClick={() => { onMute("instance"); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="font-medium">Mute this alert</span>
            <span className="block text-slate-400 mt-0.5">Hide for 3 days</span>
          </button>
          <button
            onClick={() => { onMute("type"); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="font-medium">Mute all like this</span>
            <span className="block text-slate-400 mt-0.5">Hide this alert type for 3 days</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const markRead = useMarkAlertRead();
  const dismiss = useDismissAlert();
  const mute = useMuteAlert();

  const unread = alerts?.filter((a) => !a.is_read) ?? [];
  const read = alerts?.filter((a) => a.is_read) ?? [];
  const highCount = unread.filter((a) => a.priority === "high").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--snow-500)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Bell size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-800">Alerts</h1>
        {unread.length > 0 && (
          <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">
            {unread.length} new
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-6 ml-8">
        {unread.length === 0
          ? "You\u2019re all caught up."
          : `${unread.length} unread alert${unread.length > 1 ? "s" : ""}${highCount > 0 ? ` \u00b7 ${highCount} high priority` : ""}`}
      </p>

      {(!alerts || alerts.length === 0) && (
        <div className="text-center py-16 text-slate-400">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No alerts right now.</p>
        </div>
      )}

      {unread.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New</h2>
          <div className="space-y-2">
            {unread.map((alert) => (
              <div
                key={alert.alert_id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${PRIORITY_COLORS[alert.priority] ?? PRIORITY_COLORS.low}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[alert.priority] ?? PRIORITY_DOT.low}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{alert.text || alert.signal_type}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
                      alert.priority === "high" ? "bg-red-100 text-red-600" :
                      alert.priority === "medium" ? "bg-amber-100 text-amber-600" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {PRIORITY_LABEL[alert.priority] ?? "Low"}
                    </span>
                  </div>
                  {alert.account_name && alert.account_id ? (
                    <Link href={`/accounts/${alert.account_id}`} className="text-xs text-sky-600 hover:underline mt-0.5 block">
                      {alert.account_name}
                    </Link>
                  ) : alert.account_name ? (
                    <p className="text-xs text-slate-500 mt-0.5">{alert.account_name}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => markRead.mutate(alert.alert_id)}
                    className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                  <MuteDropdown
                    alertId={alert.alert_id}
                    onMute={(scope) => mute.mutate({ alertId: alert.alert_id, scope })}
                  />
                  <button
                    onClick={() => dismiss.mutate(alert.alert_id)}
                    className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {read.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Read</h2>
          <div className="space-y-2 opacity-60">
            {read.map((alert) => (
              <div
                key={alert.alert_id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-slate-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 leading-snug">{alert.text || alert.signal_type}</p>
                  {alert.account_name && alert.account_id ? (
                    <Link href={`/accounts/${alert.account_id}`} className="text-xs text-sky-500 hover:underline mt-0.5 block">
                      {alert.account_name}
                    </Link>
                  ) : alert.account_name ? (
                    <p className="text-xs text-slate-400 mt-0.5">{alert.account_name}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <MuteDropdown
                    alertId={alert.alert_id}
                    onMute={(scope) => mute.mutate({ alertId: alert.alert_id, scope })}
                  />
                  <button
                    onClick={() => dismiss.mutate(alert.alert_id)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
