"use client";

import { useState, useRef, useEffect } from "react";
import { BellOff, Check, X } from "lucide-react";
import Link from "next/link";
import type { AlertItem } from "@/hooks/useApi";

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-slate-50 border-slate-200 text-slate-600",
};

export const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

export const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function MuteDropdown({
  onMute,
}: {
  onMute: (scope: "instance" | "type") => void;
}) {
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
        title="Mute"
      >
        <BellOff size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMute("instance");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="font-medium">Mute this alert</span>
            <span className="block text-slate-400 mt-0.5">Hide for 3 days</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMute("type");
              setOpen(false);
            }}
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

export function AlertRow({
  alert,
  onMarkRead,
  onDismiss,
  onMute,
  showAccountLink = true,
  density = "comfortable",
}: {
  alert: AlertItem;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onMute?: (id: string, scope: "instance" | "type") => void;
  showAccountLink?: boolean;
  density?: "comfortable" | "compact";
}) {
  const py = density === "compact" ? "py-2" : "py-3";
  const dotSize = density === "compact" ? "w-2 h-2 mt-1" : "w-2.5 h-2.5 mt-1.5";
  const textSize = density === "compact" ? "text-[11px]" : "text-xs";

  if (alert.is_read) {
    return (
      <div className={`flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 ${py} opacity-70`}>
        <span className={`rounded-full shrink-0 ${dotSize} bg-slate-300`} />
        <div className="flex-1 min-w-0">
          <p className={`${textSize} text-slate-600 leading-snug`}>{alert.text || alert.signal_type}</p>
          {showAccountLink && alert.account_name && alert.account_id ? (
            <Link href={`/accounts/${alert.account_id}`} className="text-xs text-sky-500 hover:underline mt-0.5 block">
              {alert.account_name}
            </Link>
          ) : showAccountLink && alert.account_name ? (
            <p className="text-xs text-slate-400 mt-0.5">{alert.account_name}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onMute && (
            <MuteDropdown onMute={(scope) => onMute(alert.alert_id, scope)} />
          )}
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(alert.alert_id);
              }}
              className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-red-400 transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 ${py} ${PRIORITY_COLORS[alert.priority] ?? PRIORITY_COLORS.low}`}
    >
      <span className={`rounded-full shrink-0 ${dotSize} ${PRIORITY_DOT[alert.priority] ?? PRIORITY_DOT.low}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`${textSize} font-medium text-slate-800 leading-snug`}>{alert.text || alert.signal_type}</p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
              alert.priority === "high"
                ? "bg-red-100 text-red-600"
                : alert.priority === "medium"
                ? "bg-amber-100 text-amber-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {PRIORITY_LABEL[alert.priority] ?? "Low"}
          </span>
        </div>
        {showAccountLink && alert.account_name && alert.account_id ? (
          <Link href={`/accounts/${alert.account_id}`} className="text-xs text-sky-600 hover:underline mt-0.5 block">
            {alert.account_name}
          </Link>
        ) : showAccountLink && alert.account_name ? (
          <p className="text-xs text-slate-500 mt-0.5">{alert.account_name}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onMarkRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(alert.alert_id);
            }}
            className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors"
            title="Mark as read"
          >
            <Check size={14} />
          </button>
        )}
        {onMute && (
          <MuteDropdown onMute={(scope) => onMute(alert.alert_id, scope)} />
        )}
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(alert.alert_id);
            }}
            className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-red-400 transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
