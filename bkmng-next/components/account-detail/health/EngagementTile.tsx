"use client";

import { CalendarCheck2, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { HealthTile } from "./HealthTile";
import type { MeetingActivity, EmailActivity } from "@/hooks/useApi";

function MiniSparkline({ meetings, emails }: { meetings: MeetingActivity[]; emails: EmailActivity | undefined }) {
  const now = new Date();
  const buckets: { meetings: number; emails: number }[] = Array.from({ length: 14 }, () => ({ meetings: 0, emails: 0 }));

  meetings.forEach((m) => {
    if (!m.activity_date) return;
    const d = new Date(m.activity_date + "T00:00:00");
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < 14) {
      buckets[13 - daysAgo].meetings++;
    }
  });

  const emailsPerDay = emails ? (emails.emails_last_14d / 14) : 0;
  for (let i = 0; i < 14; i++) {
    buckets[i].emails = Math.round(emailsPerDay);
  }

  const maxVal = Math.max(...buckets.map((b) => b.meetings + b.emails), 1);

  return (
    <div className="flex items-end gap-0.5 h-10 w-full">
      {buckets.map((b, i) => {
        const total = b.meetings + b.emails;
        const pct = (total / maxVal) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm bg-emerald-400 opacity-70 transition-all"
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`${b.meetings} meeting${b.meetings !== 1 ? "s" : ""}`}
          />
        );
      })}
    </div>
  );
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EngagementTile({
  meetings,
  emailActivity,
  upcomingMeetings,
  meetingsLast30d,
  isActive,
  onOpen,
}: {
  meetings: MeetingActivity[];
  emailActivity: EmailActivity | undefined;
  upcomingMeetings: MeetingActivity[];
  meetingsLast30d: number;
  isActive: boolean;
  onOpen: () => void;
}) {
  const trend = emailActivity?.email_trend;
  const accentClass =
    trend === "declining" || (meetingsLast30d === 0 && upcomingMeetings.length === 0)
      ? "border-amber-200"
      : upcomingMeetings.length > 0
      ? "border-emerald-200"
      : "border-slate-200";

  const nextMeeting = upcomingMeetings[0] ?? null;

  return (
    <HealthTile isActive={isActive} onClick={onOpen} accentClass={accentClass}>
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck2
          size={15}
          className={upcomingMeetings.length > 0 ? "text-emerald-500" : "text-slate-400"}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Engagement</span>
      </div>

      <div className="mt-2 mb-3">
        <span className="text-4xl font-bold text-slate-800 tabular-nums leading-none">
          {meetingsLast30d}
        </span>
        <span className="ml-1.5 text-sm text-slate-500">meetings (30d)</span>
      </div>

      <div className="mb-3">
        <MiniSparkline meetings={meetings} emails={emailActivity} />
        <p className="text-[9px] text-slate-400 mt-0.5">Last 14 days</p>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Upcoming</span>
          <span className={`text-[11px] font-semibold ${upcomingMeetings.length > 0 ? "text-emerald-600" : "text-slate-400"}`}>
            {upcomingMeetings.length}
          </span>
        </div>
        {nextMeeting && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
            <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">Next</p>
            <p className="text-[11px] text-slate-700 line-clamp-1">{nextMeeting.subject ?? "Meeting"}</p>
            <p className="text-[10px] text-slate-500">{formatDateShort(nextMeeting.activity_date)}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Email (30d)</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
            {emailActivity?.emails_last_30d ?? 0}
            {trend === "increasing" && <TrendingUp size={11} className="text-emerald-500" />}
            {trend === "declining" && <TrendingDown size={11} className="text-rose-500" />}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-3 flex items-center border-t border-slate-100">
        <span className="text-[11px] text-sky-600 font-medium flex items-center gap-1">
          {isActive ? "Hide details" : "View details"}
          <ChevronRight size={12} className={`transition-transform ${isActive ? "rotate-90" : ""}`} />
        </span>
      </div>
    </HealthTile>
  );
}
