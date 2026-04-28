"use client";

import { Fragment, useMemo } from "react";
import { Calendar, CircleDot, FileText, Mail, Mic, Trash2 } from "lucide-react";
import { useAccountTimeline, type TimelineNote, type GongCall } from "@/hooks/useApi";
import { sfUseCaseUrl } from "@/lib/utils";

type TimelineEvent =
  | { kind: "note"; data: TimelineNote }
  | { kind: "context"; data: TimelineNote; contextType: string }
  | { kind: "call"; data: GongCall };

const CONTEXT_PREFIXES = ["[Meeting Notes] ", "[Transcript] ", "[Email] ", "[Notes] ", "[Other] ", "[Meeting] "] as const;

function detectContextType(note: TimelineNote): string | null {
  for (const prefix of CONTEXT_PREFIXES) {
    if (note.use_case_name?.startsWith(prefix)) {
      return prefix.slice(1, -2);
    }
  }
  return null;
}

function contextTitle(note: TimelineNote): string {
  for (const prefix of CONTEXT_PREFIXES) {
    if (note.use_case_name?.startsWith(prefix)) {
      return note.use_case_name.slice(prefix.length);
    }
  }
  return note.use_case_name ?? "";
}

function hasPendingNotes(note: TimelineNote): boolean {
  return note.content.endsWith("Notes not yet added.");
}

function eventDate(e: TimelineEvent): string {
  return e.kind === "call" ? e.data.call_date : e.data.created_at;
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatGroupDate(iso: string): string {
  const key = getDateKey(iso);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function avatarColor(initials: string): string {
  const colors = [
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length]!;
}

function ContextIcon({ type }: { type: string }) {
  switch (type) {
    case "Meeting Notes":
    case "Meeting":
      return <Calendar className="h-3.5 w-3.5" />;
    case "Transcript":
      return <Mic className="h-3.5 w-3.5" />;
    case "Email":
      return <Mail className="h-3.5 w-3.5" />;
    case "Notes":
      return <FileText className="h-3.5 w-3.5" />;
    case "Other":
      return <CircleDot className="h-3.5 w-3.5" />;
    default:
      return <Calendar className="h-3.5 w-3.5" />;
  }
}

function contextStyle(type: string): { icon: string; card: string; title: string } {
  switch (type) {
    case "Transcript":
      return { icon: "bg-violet-100 text-violet-600", card: "border-violet-100 bg-violet-50/50", title: "text-slate-800" };
    case "Email":
      return { icon: "bg-amber-100 text-amber-600", card: "border-amber-100 bg-amber-50/50", title: "text-slate-800" };
    case "Notes":
      return { icon: "bg-slate-100 text-slate-600", card: "border-slate-200 bg-slate-50/50", title: "text-slate-800" };
    case "Other":
      return { icon: "bg-teal-100 text-teal-600", card: "border-teal-100 bg-teal-50/50", title: "text-slate-800" };
    default:
      return { icon: "bg-sky-100 text-sky-600", card: "border-sky-100 bg-sky-50/50", title: "text-slate-800" };
  }
}

export interface NotesTimelineProps {
  accountId: string;
  gongCalls?: GongCall[];
  onDelete?: (entryId: string) => void;
}

export function NotesTimeline({ accountId, gongCalls, onDelete }: NotesTimelineProps) {
  const { data: notes = [], isLoading } = useAccountTimeline(accountId);

  const events: TimelineEvent[] = useMemo(() => {
    const noteEvents = notes.map((n): TimelineEvent => {
      const ctxType = detectContextType(n);
      if (ctxType) return { kind: "context", data: n, contextType: ctxType };
      return { kind: "note", data: n };
    });
    const callEvents = (gongCalls ?? []).map((c): TimelineEvent => ({ kind: "call", data: c }));
    return [...noteEvents, ...callEvents].sort(
      (a, b) => new Date(eventDate(b)).getTime() - new Date(eventDate(a)).getTime()
    );
  }, [notes, gongCalls]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const key = getDateKey(eventDate(e));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [events]);

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">Loading timeline…</p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <section>
      {grouped.map(([dateKey, dayEvents]) => (
        <Fragment key={dateKey}>
          <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700 first:mt-0">
            {formatGroupDate(eventDate(dayEvents[0]!))}
          </h3>
          <div>
            {dayEvents.map((event) => {
              if (event.kind === "context") {
                const note = event.data;
                const pending = hasPendingNotes(note);
                const style = pending
                  ? { icon: "bg-amber-100 text-amber-600", card: "border-amber-100 bg-amber-50/60", title: "text-amber-800" }
                  : contextStyle(event.contextType);
                return (
                  <div key={`ctx-${note.note_id}`} className="relative pb-4 pl-8 last:pb-0 group">
                    <span
                      className="absolute bottom-0 left-3 top-0 border-l-2 border-slate-200"
                      aria-hidden
                    />
                    <span
                      className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ${style.icon}`}
                      aria-hidden
                    >
                      <ContextIcon type={event.contextType} />
                    </span>
                    <div className={`rounded-md border px-3 py-2 ${style.card}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium ${style.title}`}>
                              {contextTitle(note)}
                            </p>
                            <span className="inline-flex items-center rounded-full bg-white/80 border border-slate-200 px-1.5 py-0 text-[9px] font-medium text-slate-500">
                              {event.contextType}
                            </span>
                          </div>
                        </div>
                        {note.is_deletable && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(note.note_id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      {pending ? (
                        <p className="mt-0.5 text-xs text-amber-600 italic">Notes not yet added</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                          {note.content.split("\n\n").slice(1).join("\n\n").trim() || note.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              if (event.kind === "note") {
                const note = event.data;
                const initials = note.author_id.slice(0, 4).toUpperCase();
                const color = avatarColor(note.author_id);
                return (
                  <div key={`note-${note.note_id}`} className="relative pb-4 pl-8 last:pb-0">
                    <span
                      className="absolute bottom-0 left-3 top-0 border-l-2 border-slate-200"
                      aria-hidden
                    />
                    <span
                      className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${color}`}
                      aria-hidden
                    >
                      {initials}
                    </span>
                    <p className="text-sm text-slate-700">{note.content}</p>
                    {note.use_case_name && (
                      <a
                        href={sfUseCaseUrl(note.use_case_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs text-slate-400 hover:text-sky-600 hover:underline"
                      >
                        {note.use_case_name}
                      </a>
                    )}
                  </div>
                );
              }

              const call = event.data;
              const gongUrl = call.recording_url ?? null;
              return (
                <div key={`call-${call.call_id}`} className="relative pb-4 pl-8 last:pb-0">
                  <span
                    className="absolute bottom-0 left-3 top-0 border-l-2 border-slate-200"
                    aria-hidden
                  />
                  <span
                    className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-600"
                    aria-hidden
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <div className="rounded-md border border-violet-100 bg-violet-50/50 px-3 py-2">
                    {gongUrl ? (
                      <a
                        href={gongUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-800 hover:text-violet-700 hover:underline"
                      >
                        {call.title ?? "Gong Call"}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-slate-800">
                        {call.title ?? "Gong Call"}
                      </span>
                    )}
                    {call.summary && (
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {call.summary}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Fragment>
      ))}
    </section>
  );
}
