"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      <span className="text-xs text-slate-500 mr-1">Thinking</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  quickReplies?: string[];
};

export type NBAContext = {
  id: string;
  type: string;
  text: string;
  summary: string;
};

const QUICK_REPLIES = [
  "Why is this recommended?",
  "Tell me more",
  "Help me create an email or slides",
];

function getMockUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("bkmng-user-id") || "jusdavis";
}

async function* streamChat(
  messages: { role: string; content: string }[],
  accountId?: string | null,
): AsyncGenerator<string> {
  const mockUserId = getMockUserId();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mockUserId) headers["X-Mock-User"] = mockUserId;

  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, account_id: accountId ?? null }),
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
      if (payload === "[DONE]") return;
      try {
        const evt = JSON.parse(payload) as { text?: string; error?: string };
        if (evt.error) throw new Error(evt.error);
        if (evt.text) yield evt.text;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

interface ACEChatProps {
  nbaContext?: NBAContext | null;
  accountId?: string | null;
}

export function ACEChat({ nbaContext, accountId }: ACEChatProps = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<boolean>(false);
  const contextSentRef = useRef(false);

  useEffect(() => {
    if (nbaContext && !open) {
      setOpen(true);
    }
  }, [nbaContext]);

  useEffect(() => {
    if (open && messages.length === 0) {
      if (nbaContext) {
        setMessages([{
          id: "intro",
          role: "assistant",
          content: `Hi! I'm ACE. I've loaded context for this next best action:\n\n**${nbaContext.text}**\n\n${nbaContext.summary}\n\nHow would you like to proceed?`,
          quickReplies: QUICK_REPLIES,
        }]);
      } else if (accountId) {
        setMessages([{
          id: "intro",
          role: "assistant",
          content: "Hi! I'm ACE. I have full context for this account — ask me about use cases, MEDDPICC scores, go-live dates, consumption, or anything else. I can also tap into Snowflake sales resources.",
        }]);
      } else {
        setMessages([{
          id: "intro",
          role: "assistant",
          content: "Hi! I'm ACE, your Snowflake sales assistant. Ask me about your accounts, use cases, consumption, or any Snowflake product question.",
        }]);
      }
    }
  }, [open, messages.length, nbaContext, accountId]);

  useEffect(() => {
    if (nbaContext && open && !contextSentRef.current && messages.length > 0 && !streaming) {
      contextSentRef.current = true;
    }
  }, [nbaContext, open, messages, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: "", pending: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    abortRef.current = false;

    const systemContext = nbaContext
      ? [{ role: "system", content: `NBA context: ${nbaContext.text}. Summary: ${nbaContext.summary}` }]
      : [];

    const history = [
      ...systemContext,
      ...messages.filter((m) => m.role === "user" || (m.role === "assistant" && m.id !== "intro")),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      let accumulated = "";
      for await (const chunk of streamChat(history, accountId)) {
        if (abortRef.current) break;
        accumulated += chunk;
        const final = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: final, pending: false } : m))
        );
      }
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "Sorry, I didn't get a response. Please try again.", pending: false } : m
          )
        );
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : "An error occurred.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: errText, pending: false } : m
        )
      );
    } finally {
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m))
      );
    }
  }, [input, streaming, messages, nbaContext]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleClose = () => {
    setOpen(false);
    if (nbaContext) {
      setMessages([]);
      contextSentRef.current = false;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 transition-colors text-sm font-medium"
      >
        <Sparkles size={16} />
        Ask ACE
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px] max-h-[580px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-sky-50">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-sky-600" />
              <span className="text-sm font-semibold text-sky-900">ACE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 font-medium">AI</span>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 max-h-[420px]">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-sky-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {msg.pending && !msg.content ? (
                    <ThinkingDots />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[88%]">
                    {msg.quickReplies.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        onClick={() => send(qr)}
                        disabled={streaming}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-50"
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-3 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask ACE anything…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="shrink-0 w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
