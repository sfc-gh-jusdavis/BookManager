"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Send, Sparkles, Loader2, ExternalLink, Check, Link as LinkIcon, ChevronDown, ChevronRight, Target } from "lucide-react";

type UseCase = {
  use_case_id: string;
  use_case_name: string;
  stage: string;
  status: string;
  ps_notes_summary?: string | null;
  ps_notes?: { content: string }[];
  target_go_live_date?: string | null;
};

type GongCall = {
  call_id: string;
  call_date: string;
  title: string | null;
  summary: string | null;
  action_items: string[];
};

type Account = {
  account_id: string;
  account_name: string;
  status: string;
};

interface AIChatPanelProps {
  account: Account;
  useCases: UseCase[];
  gongCalls: GongCall[];
  initialPrompt?: string;
  signalTypes?: string[];
}

interface Citation {
  url: string;
  title: string;
  excerpt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  sql?: string;
  timestamp: Date;
}

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

function getMockUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("bkmng-user-id") || "jusdavis";
}

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "link"; link: Citation }
  | { type: "sql"; sql: string }
  | { type: "error"; error: string }
  | { type: "done" };

async function* streamChat(
  messages: { role: string; content: string }[],
  accountId: string,
): AsyncGenerator<StreamEvent> {
  const mockUserId = getMockUserId();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mockUserId) headers["X-Mock-User"] = mockUserId;

  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, account_id: accountId }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Agent error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        yield { type: "done" };
        return;
      }
      try {
        const evt = JSON.parse(payload) as {
          text?: string;
          error?: string;
          link?: { url: string; title: string; excerpt: string };
          sql?: string;
        };
        if (evt.error) {
          yield { type: "error", error: evt.error };
          return;
        }
        if (evt.text) yield { type: "text", text: evt.text };
        if (evt.link) yield { type: "link", link: evt.link };
        if (evt.sql) yield { type: "sql", sql: evt.sql };
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

const DEFAULT_PROMPTS = [
  "What are the biggest risks for this account?",
  "Summarize recent progress across all use cases",
  "What should I focus on next?",
  "Draft a status update email for this account",
  "What Snowflake features could help this account?",
  "What competitive threats should I watch for?",
];

const SIGNAL_PROMPTS: Record<string, string> = {
  contract_ending: "Draft renewal talking points for this account",
  consumption_dip: "Why is consumption dropping?",
  consumption_spike: "What\u2019s driving the consumption spike?",
  capacity_warning: "Are we at risk of running out of contract capacity?",
  no_upcoming_meeting: "Why haven\u2019t we engaged recently?",
  upcoming_meeting: "Prep me for the next meeting",
  use_case_no_go_live: "Which use cases still need go-live dates?",
  use_case_no_impl_start: "Which use cases need implementation dates?",
  use_case_stale_notes: "Summarize stale use cases needing notes",
  competitor_mentioned: "What\u2019s the competitive situation?",
  customer_frustration: "What\u2019s causing customer frustration?",
  user_reported_risk: "Walk me through the risks I\u2019ve flagged",
  user_reported_blocker: "What blockers are in play?",
  user_reported_opportunity: "What expansion opportunities are available?",
  email_silence: "Why haven\u2019t we emailed them lately?",
  email_declining: "Email activity is declining \u2014 what should I do?",
  expansion_signal: "How do I action this expansion signal?",
  new_feature_adoption: "What new features have they adopted recently?",
  stage_stalled: "Why are use cases stalling in stage?",
  high_momentum: "What\u2019s driving momentum here?",
};

function buildSuggestedPrompts(signalTypes: string[] | undefined): string[] {
  const types = signalTypes ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of types) {
    const p = SIGNAL_PROMPTS[t];
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
      if (out.length >= 4) break;
    }
  }
  if (out.length < 4) {
    for (const p of DEFAULT_PROMPTS) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
        if (out.length >= 4) break;
      }
    }
  }
  return out;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function renderCodeBlock(code: string, lang: string, key: number) {
  return (
    <pre
      key={key}
      className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs font-mono"
    >
      {lang && (
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{lang}</div>
      )}
      <code className="text-emerald-300 whitespace-pre">{code}</code>
    </pre>
  );
}

function renderInlineLink(text: string, key: number) {
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = text.split(urlRegex);
  if (parts.length === 1) return <span key={key}>{text}</span>;
  return (
    <span key={key}>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 underline decoration-sky-300 hover:text-sky-800"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function renderMessageContent(text: string) {
  const parts = text.split(/(```[\w]*\n[\s\S]*?```|```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
      const lang = match?.[1] ?? "";
      const code = match?.[2] ?? part.slice(3, -3);
      return renderCodeBlock(code, lang, i);
    }
    const segments = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith("**") && seg.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold text-slate-800">
                {seg.slice(2, -2)}
              </strong>
            );
          }
          return (
            <span key={j} className="whitespace-pre-wrap">
              {renderInlineLink(seg, j)}
            </span>
          );
        })}
      </span>
    );
  });
}

function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  const unique = citations.filter(
    (c, i, arr) => arr.findIndex((x) => x.url === c.url) === i
  );
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <div className="flex items-center gap-1 mb-1">
        <LinkIcon size={10} className="text-slate-400" />
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Sources</span>
      </div>
      <div className="space-y-1">
        {unique.map((c, i) => (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 rounded-md px-2 py-1 text-xs text-sky-700 hover:bg-sky-50 transition-colors group"
          >
            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-[9px] font-bold">
              {i + 1}
            </span>
            <span className="line-clamp-2 group-hover:underline">
              {c.excerpt || c.url}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function SqlDisclosure({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(sql).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-600"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Show SQL
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg bg-slate-900 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-slate-500">Cortex Analyst SQL</span>
            <button
              type="button"
              onClick={onCopy}
              className="text-[10px] text-slate-400 hover:text-slate-200"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto text-[11px] font-mono leading-snug text-emerald-300 whitespace-pre">{sql}</pre>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="mr-8 flex items-center gap-2 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-500" aria-hidden />
      <span className="flex items-center gap-1" aria-label="Assistant is typing">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        </span>
      </span>
    </div>
  );
}

export function AIChatPanel({ account, useCases: _useCases, gongCalls: _gongCalls, initialPrompt, signalTypes }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const initialPromptRef = useRef(initialPrompt);
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const suggestedPrompts = React.useMemo(() => buildSuggestedPrompts(signalTypes), [signalTypes]);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streaming, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        content: trimmed,
        citations: [],
        timestamp: new Date(),
      };
      const assistantMsg: ChatMessage = {
        id: nextMessageId(),
        role: "assistant",
        content: "",
        citations: [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);
      abortRef.current = false;
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const history = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        let accumulated = "";
        const collectedCitations: Citation[] = [];
        let collectedSql: string | undefined;

        for await (const evt of streamChat(history, account.account_id)) {
          if (abortRef.current) break;
          if (evt.type === "text") {
            accumulated += evt.text;
            const final = accumulated;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: final } : m))
            );
          } else if (evt.type === "link") {
            collectedCitations.push(evt.link);
            const cits = [...collectedCitations];
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, citations: cits } : m))
            );
          } else if (evt.type === "sql") {
            collectedSql = evt.sql;
            const sqlVal = collectedSql;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, sql: sqlVal } : m))
            );
          } else if (evt.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: evt.error } : m
              )
            );
            break;
          } else if (evt.type === "done") {
            break;
          }
        }
        if (!accumulated) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "Sorry, I didn't get a response. Please try again." }
                : m
            )
          );
        }
      } catch (err) {
        const errText = err instanceof Error ? err.message : "An error occurred.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: errText } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [streaming, messages, account.account_id]
  );

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  useEffect(() => {
    const prompt = initialPromptRef.current?.trim();
    if (!prompt) return;
    const t = setTimeout(() => sendMessageRef.current(prompt), 50);
    return () => clearTimeout(t);
  }, []);

  const handleOpenInCortexCode = () => {
    const ctx = [
      `Account: ${account.account_name}`,
      `Status: ${account.status}`,
      `Account ID: ${account.account_id}`,
      `Snowflake Instance: snowhouse`,
    ].join("\n");
    navigator.clipboard.writeText(ctx).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    window.open("https://app.snowflake.com", "_blank");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const onTextareaInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 82)}px`;
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" aria-hidden />
            <h2 className="text-sm font-semibold text-slate-800">ACE</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-medium">AI</span>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium" title="ACE is scoped to this account">
              <Target size={10} /> Scoped: {account.account_name}
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenInCortexCode}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            title="Open Snowflake with account context copied to clipboard"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-500" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <ExternalLink size={11} />
                Open in Cortex Code
              </>
            )}
          </button>
        </div>
      </header>

      <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !streaming && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Ask me anything about <span className="font-medium text-slate-700">{account.account_name}</span> — account data, Snowflake docs, risks, progress, or draft an update.
            </p>
            <div className="flex flex-wrap gap-2">
              {(suggestedPrompts).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            {m.role === "user" ? (
              <div className="ml-8 rounded-xl rounded-tr-sm bg-sky-50 p-3 text-sm text-slate-800">
                {m.content}
              </div>
            ) : (
              <div className="mr-8 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {m.content ? renderMessageContent(m.content) : null}
                <CitationList citations={m.citations} />
                {m.sql ? <SqlDisclosure sql={m.sql} /> : null}
              </div>
            )}
            <p className="mt-0.5 text-[10px] text-slate-400">{formatTime(m.timestamp)}</p>
          </div>
        ))}

        {streaming && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-slate-200 px-5 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={onTextareaInput}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask ACE about this account…"
            className="max-h-[82px] min-h-[38px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            disabled={streaming}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-sky-500 p-2 text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
