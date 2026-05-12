"use client";

// @flag-exempt: gated at call site via panel_use_case_updates flag in app/accounts/[id]/page.tsx (Bucket 4)

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Copy, Check, Pencil, X } from "lucide-react";
import {
  useUseCaseUpdates,
  useRefreshUseCaseUpdates,
  useRegenerateUseCaseUpdate,
  useSaveUseCaseUpdate,
  type UseCaseUpdate,
} from "@/hooks/useApi";

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function UseCaseUpdateCard({
  upd,
  accountId,
}: {
  upd: UseCaseUpdate;
  accountId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(upd.update_text);
  const [copied, setCopied] = useState(false);

  const regen = useRegenerateUseCaseUpdate(accountId);
  const save = useSaveUseCaseUpdate(accountId);

  useEffect(() => {
    if (!editing) setDraft(upd.update_text);
  }, [upd.update_text, editing]);

  const isNoUpdate = upd.status === "no_update";
  const isEdited = upd.is_edited || upd.status === "edited";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(upd.update_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isNoUpdate
          ? "border-slate-200 bg-slate-50/60"
          : "border-sky-100 bg-sky-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 truncate" title={upd.use_case_name}>
            {upd.use_case_name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[10px] text-slate-500">
              {upd.stage?.includes(" - ") ? upd.stage.split(" - ")[1] : upd.stage}
            </span>
            {upd.week_of && (
              <span className="text-[10px] text-slate-400">
                · wk of {upd.week_of.slice(5)}
              </span>
            )}
            {isEdited && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0 text-[9px] font-medium">
                edited
              </span>
            )}
            {isNoUpdate && (
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0 text-[9px] font-medium">
                no update
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!editing && !isNoUpdate && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy to clipboard"
              className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-white transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            </button>
          )}
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Edit"
              className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-white transition-colors"
            >
              <Pencil size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => regen.mutate(upd.use_case_id)}
            disabled={regen.isPending}
            title="Regenerate"
            className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={regen.isPending ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full text-xs rounded-md border border-sky-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-300 resize-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDraft(upd.update_text);
                setEditing(false);
              }}
              className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5"
            >
              <X size={11} /> Cancel
            </button>
            <button
              type="button"
              disabled={save.isPending || draft.trim() === upd.update_text.trim()}
              onClick={() =>
                save.mutate(
                  { useCaseId: upd.use_case_id, text: draft.trim() },
                  { onSuccess: () => setEditing(false) }
                )
              }
              className="inline-flex items-center gap-0.5 text-[11px] font-medium bg-sky-600 text-white rounded px-2 py-0.5 hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              <Check size={11} /> Save
            </button>
          </div>
        </div>
      ) : (
        <p className={`text-xs leading-relaxed whitespace-pre-line ${isNoUpdate ? "text-slate-500 italic" : "text-slate-700"}`}>
          {upd.update_text}
        </p>
      )}

      {!editing && upd.basis_summary && (
        <p className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-100">
          {upd.basis_summary}
        </p>
      )}
    </div>
  );
}

export function UseCaseUpdatesPanel({ accountId }: { accountId: string }) {
  const { data, isLoading } = useUseCaseUpdates(accountId);
  const refresh = useRefreshUseCaseUpdates(accountId);
  const updates = data?.updates ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={12} className="text-sky-500" />
          Use Case Updates
        </p>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          title="Regenerate all"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-sky-600 border border-slate-200 rounded-full px-2 py-0.5 hover:bg-sky-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={refresh.isPending ? "animate-spin" : ""} />
          {refresh.isPending ? "…" : "All"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-3 text-center">Generating…</p>
      ) : updates.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center">
          No active use cases assigned to you for this account.
        </p>
      ) : (
        <div className="space-y-2.5">
          {updates.map((upd) => (
            <UseCaseUpdateCard key={upd.use_case_id} upd={upd} accountId={accountId} />
          ))}
          <p className="text-[10px] text-slate-400 pt-1 text-right">
            Last gen {formatRelative(updates[0]?.generated_at ?? null)}
          </p>
        </div>
      )}
    </div>
  );
}
