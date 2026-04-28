"use client";

import { useState } from "react";
import {
  useMeetingPrep,
  useRefreshMeetingPrep,
  useGeneratePrepEmail,
  useAccountContacts,
  useSaveMeetingPrepContext,
} from "@/hooks/useApi";
import type {
  MeetingPrep,
  MeetingRecap,
  SuggestedTopic,
  FeatureSignal,
  SuggestedAsset,
  DocLink,
  AccountContact,
} from "@/hooks/useApi";
import {
  Sparkles,
  ChevronDown,
  Copy,
  CheckSquare,
  Square,
  RefreshCw,
  ExternalLink,
  Monitor,
  FileText,
  Code2,
  Users,
  Mail,
  Calendar,
  Zap,
  UserPlus,
  MessageSquare,
  BookOpen,
  ArrowUpRight,
  Presentation,
} from "lucide-react";

type RichAction = { item: string; source?: string; owner?: string; reasoning?: string };

function parseJsonField<T>(field: string | null | undefined): T | null {
  if (!field) return null;
  try {
    return JSON.parse(field) as T;
  } catch {
    return null;
  }
}

function PrepSection({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-[11px] text-slate-400">({count})</span>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}

function DocLinkPills({ links }: { links: DocLink[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {links.map((link, i) => {
        const isSeismic = link.source === "seismic" || link.url?.includes("seismic.com");
        return (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 transition-colors border ${
              isSeismic
                ? "text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100"
                : "text-sky-600 bg-sky-50 hover:bg-sky-100 border-sky-100"
            }`}
            title={link.url}
          >
            {isSeismic ? <Presentation size={9} /> : <BookOpen size={9} />}
            {link.title}
            <ExternalLink size={8} />
          </a>
        );
      })}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const isHigh = priority === "high";
  return (
    <span
      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
        isHigh
          ? "bg-red-50 text-red-600 border border-red-100"
          : "bg-amber-50 text-amber-600 border border-amber-100"
      }`}
    >
      {priority}
    </span>
  );
}

function EvidenceTag({ source }: { source: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    signal: { bg: "bg-purple-50 border-purple-100", text: "text-purple-600", label: "Signal" },
    gong: { bg: "bg-green-50 border-green-100", text: "text-green-600", label: "Gong" },
    notes: { bg: "bg-blue-50 border-blue-100", text: "text-blue-600", label: "SE Notes" },
    adoption: { bg: "bg-orange-50 border-orange-100", text: "text-orange-600", label: "Adoption" },
  };
  const c = config[source] || config.signal;
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

const ASSET_ICONS: Record<string, React.ReactNode> = {
  demo: <Monitor size={14} className="text-sky-500" />,
  pdf_guide: <FileText size={14} className="text-emerald-500" />,
  notebook: <Code2 size={14} className="text-violet-500" />,
  workshop: <Users size={14} className="text-amber-500" />,
};

export function MeetingPrepView({
  accountId,
  accountName,
  onAddPostMeetingNotes,
}: {
  accountId: string;
  accountName: string;
  onAddPostMeetingNotes?: () => void;
}) {
  const { data: prep, isLoading } = useMeetingPrep(accountId) as {
    data: MeetingPrep | undefined;
    isLoading: boolean;
  };
  const { mutate: refresh, isPending: generating } = useRefreshMeetingPrep(accountId);
  const { mutate: saveContext, isPending: saving } = useSaveMeetingPrepContext(accountId);
  const { mutate: genEmail, isPending: emailGenerating, data: emailData } = useGeneratePrepEmail(accountId);
  const { data: contacts } = useAccountContacts(accountId);
  const [context, setContext] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [recipientName, setRecipientName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  const toggleCheck = (idx: number) =>
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const recaps = parseJsonField<MeetingRecap[]>(prep?.meeting_recaps) || [];
  const actionItems = parseJsonField<RichAction[]>(prep?.open_action_items) || [];
  const featureSignals = parseJsonField<FeatureSignal[]>(prep?.feature_signals) || [];
  const suggestedAssets = parseJsonField<SuggestedAsset[]>(prep?.suggested_assets) || [];

  let suggestedTopics: SuggestedTopic[] = [];
  if (prep?.suggested_agenda) {
    const raw = parseJsonField<SuggestedTopic[]>(prep.suggested_agenda);
    if (raw) suggestedTopics = raw;
  }

  const docLinks = parseJsonField<{ topic_links?: Record<string, DocLink[]>; feature_links?: Record<string, DocLink[]> }>(prep?.doc_links);

  const topicsWithLinks = suggestedTopics.map((t) => ({
    ...t,
    doc_links: t.doc_links || docLinks?.topic_links?.[t.topic] || [],
  }));

  const signalsWithLinks = featureSignals.map((f) => ({
    ...f,
    doc_links: f.doc_links || docLinks?.feature_links?.[f.feature] || [],
  }));

  const emailResult = emailData || (prep?.pre_meeting_email ? parseJsonField<{ subject: string; body: string }>(prep.pre_meeting_email) : null);

  const hasContent = !!(recaps.length || topicsWithLinks.length || signalsWithLinks.length || suggestedAssets.length || actionItems.length);

  const hasLegacyContent = !hasContent && !!(prep?.last_meeting_recap || prep?.changes_since_last || prep?.suggested_agenda || prep?.questions_to_ask);

  const handleCopy = () => {
    if (!prep) return;
    const sections: string[] = [`Meeting Prep: ${accountName}\n`];
    if (recaps.length) {
      sections.push("RECENT MEETINGS\n" + recaps.map((r) => `${r.date}: ${r.title}\n${r.summary}`).join("\n\n"));
    }
    if (topicsWithLinks.length) {
      sections.push("SUGGESTED TOPICS\n" + topicsWithLinks.map((t, i) => `${i + 1}. [${t.priority}] ${t.topic}\n   ${t.justification}${t.doc_links.length ? "\n   Docs: " + t.doc_links.map((d) => d.url).join(", ") : ""}`).join("\n"));
    }
    if (signalsWithLinks.length) {
      sections.push("NEW FEATURE SIGNALS\n" + signalsWithLinks.map((f) => `• ${f.feature} (${f.category}) — ${f.insight}${f.doc_links.length ? "\n  Docs: " + f.doc_links.map((d) => d.url).join(", ") : ""}`).join("\n"));
    }
    if (suggestedAssets.length) {
      sections.push("SUGGESTED ASSETS\n" + suggestedAssets.map((a) => `• [${a.asset_type}] ${a.title}: ${a.description}`).join("\n"));
    }
    if (actionItems.length) {
      sections.push("OPEN ACTION ITEMS\n" + actionItems.map((a) => `☐ ${a.item}${a.source ? ` (${a.source})` : ""}`).join("\n"));
    }
    if (emailResult) {
      sections.push(`PRE-MEETING EMAIL\nSubject: ${emailResult.subject}\n\n${emailResult.body}`);
    }
    navigator.clipboard.writeText(sections.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyEmail = () => {
    if (!emailResult) return;
    navigator.clipboard.writeText(`Subject: ${emailResult.subject}\n\n${emailResult.body}`);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const highPriorityTopics = topicsWithLinks.filter((t) => t.priority === "high");
  const mediumPriorityTopics = topicsWithLinks.filter((t) => t.priority !== "high");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">Meeting Prep</span>
        <div className="flex items-center gap-2">
          {prep?.generated_at && (
            <span className="text-[10px] text-slate-400">
              {new Date(prep.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {hasContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-1 transition-colors"
            >
              <Copy size={11} />
              {copied ? "Copied!" : "Copy All"}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Your Context
        </p>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Add context for this meeting… e.g. 'renewal call, want to discuss Cortex AI adoption, scope POC'"
          className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400 transition"
          rows={3}
        />
        <div className="flex items-center justify-between">
          {onAddPostMeetingNotes ? (
            <button
              type="button"
              onClick={onAddPostMeetingNotes}
              className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
            >
              + add post-meeting notes
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {savedHint && (
              <span className="text-[11px] text-emerald-600">Saved to timeline. Summarized.</span>
            )}
            <button
              type="button"
              onClick={() => {
                const trimmed = context.trim();
                if (!trimmed) return;
                saveContext(
                  { content: trimmed },
                  {
                    onSuccess: () => {
                      setContext("");
                      setSavedHint(true);
                      setTimeout(() => setSavedHint(false), 3000);
                    },
                  },
                );
              }}
              disabled={saving || generating || !context.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title={context.trim() ? "Save context to timeline and summarize" : "Type context above to enable"}
            >
              {saving ? "Saving…" : "Save to Timeline"}
            </button>
            <button
              type="button"
              onClick={() => refresh("")}
              disabled={generating || saving || !!context.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-40 transition-colors"
              title={context.trim() ? "Save context first before regenerating" : "Regenerate meeting prep from latest timeline data"}
            >
              <RefreshCw size={11} className={generating ? "animate-spin" : ""} />
              {generating ? "Generating…" : hasContent || hasLegacyContent ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Save context to the timeline first so it is summarized, then click Regenerate to rebuild the prep.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !hasContent && !hasLegacyContent && !prep?.error && (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
          <Sparkles size={18} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No meeting prep yet.</p>
          <p className="text-xs text-slate-400 mt-0.5">Add context above and generate.</p>
        </div>
      )}

      {prep?.error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3">
          <p className="text-xs text-red-600">{prep.error}</p>
        </div>
      )}

      {!isLoading && hasContent && (
        <div className="space-y-2">
          {actionItems.length > 0 && (
            <PrepSection
              title="Open Action Items"
              icon={<CheckSquare size={12} className="text-slate-400" />}
              count={actionItems.length}
              defaultOpen
            >
              <ul className="space-y-2">
                {actionItems.map((a, i) => (
                  <li key={i}>
                    <div
                      className="flex items-start gap-2 cursor-pointer group"
                      onClick={() => toggleCheck(i)}
                    >
                      {checkedItems.has(i) ? (
                        <CheckSquare size={14} className="text-sky-500 shrink-0 mt-0.5" />
                      ) : (
                        <Square size={14} className="text-slate-300 shrink-0 mt-0.5 group-hover:text-slate-400" />
                      )}
                      <div className="flex-1">
                        <span
                          className={`text-sm ${checkedItems.has(i) ? "line-through text-slate-400" : "text-slate-700"}`}
                        >
                          {a.item}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.source && (
                            <span className="text-[10px] text-slate-400">{a.source}</span>
                          )}
                          {a.owner && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                              a.owner === "SE" ? "bg-sky-50 text-sky-600" : a.owner === "customer" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                            }`}>
                              {a.owner}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </PrepSection>
          )}

          {topicsWithLinks.length > 0 && (
            <PrepSection
              title="Suggested Topics"
              icon={<Sparkles size={12} className="text-slate-400" />}
              count={topicsWithLinks.length}
              defaultOpen
            >
              <div className="space-y-3">
                {highPriorityTopics.length > 0 && (
                  <div className="space-y-2">
                    {highPriorityTopics.map((t, i) => (
                      <div key={i} className="rounded-md border border-red-50 bg-red-50/30 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityBadge priority={t.priority} />
                          <EvidenceTag source={t.evidence_source} />
                        </div>
                        <p className="text-sm font-medium text-slate-700 mb-1">{t.topic}</p>
                        <p className="text-xs text-slate-500">{t.justification}</p>
                        <DocLinkPills links={t.doc_links} />
                      </div>
                    ))}
                  </div>
                )}
                {mediumPriorityTopics.length > 0 && (
                  <div className="space-y-2">
                    {mediumPriorityTopics.map((t, i) => (
                      <div key={i} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityBadge priority={t.priority} />
                          <EvidenceTag source={t.evidence_source} />
                        </div>
                        <p className="text-sm font-medium text-slate-700 mb-1">{t.topic}</p>
                        <p className="text-xs text-slate-500">{t.justification}</p>
                        <DocLinkPills links={t.doc_links} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PrepSection>
          )}

          {recaps.length > 0 && (
            <PrepSection
              title="Recent Meetings"
              icon={<MessageSquare size={12} className="text-slate-400" />}
              count={recaps.length}
              defaultOpen
            >
              <div className="space-y-3">
                {recaps.map((r, i) => (
                  <div key={i} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{r.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{r.date}</span>
                        {r.gong_url && (
                          <a
                            href={r.gong_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-500 hover:text-sky-700 inline-flex items-center gap-0.5"
                          >
                            Gong <ArrowUpRight size={8} />
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{r.summary}</p>
                    {r.key_decisions?.length > 0 && (
                      <div className="mb-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Decisions</span>
                        <ul className="mt-0.5">
                          {r.key_decisions.map((d, j) => (
                            <li key={j} className="text-xs text-slate-600 flex items-start gap-1">
                              <span className="text-emerald-400 mt-0.5">•</span> {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.open_items?.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Open Items</span>
                        <ul className="mt-0.5">
                          {r.open_items.map((item, j) => (
                            <li key={j} className="text-xs text-slate-600 flex items-start gap-1">
                              <span className="text-amber-400 mt-0.5">•</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PrepSection>
          )}

          {signalsWithLinks.length > 0 && (
            <PrepSection
              title="Feature Usage Signals"
              icon={<Zap size={12} className="text-slate-400" />}
              count={signalsWithLinks.length}
            >
              <div className="grid gap-2">
                {signalsWithLinks.map((f, i) => (
                  <div key={i} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700">{f.feature}</span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">
                        {f.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-1">
                      First used: {f.first_use_date}
                    </p>
                    <p className="text-xs text-slate-600 mb-1">{f.insight}</p>
                    <p className="text-xs text-emerald-600 font-medium">{f.suggested_action}</p>
                    <DocLinkPills links={f.doc_links} />
                  </div>
                ))}
              </div>
            </PrepSection>
          )}

          {suggestedAssets.length > 0 && (
            <PrepSection
              title="Suggested Assets to Build"
              icon={<FileText size={12} className="text-slate-400" />}
              count={suggestedAssets.length}
              defaultOpen={false}
            >
              <div className="grid gap-2">
                {suggestedAssets.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/50 p-3">
                    <div className="shrink-0 mt-0.5">
                      {ASSET_ICONS[a.asset_type] || <FileText size={14} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-slate-700">{a.title}</span>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {a.asset_type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{a.description}</p>
                      {a.related_topic && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          Supports: {a.related_topic}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </PrepSection>
          )}

          <PrepSection
            title="Pre-Meeting Email"
            icon={<Mail size={12} className="text-slate-400" />}
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Sarah"
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400"
                  />
                </div>
              </div>
              {contacts && contacts.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1.5">
                    Suggested Recipients
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {contacts.slice(0, 8).map((c) => (
                      <button
                        key={c.email}
                        type="button"
                        onClick={() => setRecipientName(c.name || c.email.split("@")[0])}
                        className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-1 border transition-colors ${
                          recipientName === c.name || recipientName === c.email.split("@")[0]
                            ? "bg-sky-100 border-sky-300 text-sky-700"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                        title={`${c.email}${c.title ? ` — ${c.title}` : ""}`}
                      >
                        <UserPlus size={10} />
                        {c.name || c.email.split("@")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => genEmail({ recipient_name: recipientName, meeting_date: meetingDate })}
                disabled={emailGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <Mail size={11} className={emailGenerating ? "animate-pulse" : ""} />
                {emailGenerating ? "Generating…" : emailResult ? "Regenerate Email" : "Generate Email"}
              </button>

              {emailResult && (
                <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">
                      Subject: {emailResult.subject}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-0.5 transition-colors bg-white"
                    >
                      <Copy size={9} />
                      {emailCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-white rounded-md border border-slate-100 p-3">
                    {emailResult.body}
                  </div>
                </div>
              )}
            </div>
          </PrepSection>
        </div>
      )}

      {!isLoading && hasLegacyContent && !hasContent && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            This prep uses the legacy format. Click <b>Regenerate</b> to get the new structured meeting prep with doc links and feature signals.
          </p>
        </div>
      )}
    </div>
  );
}
