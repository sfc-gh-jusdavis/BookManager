"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Sparkles, Send, Loader2, RotateCcw } from "lucide-react";

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

const SUGGESTED_PROMPTS = [
  "Which of my accounts have the highest consumption risk this quarter?",
  "Summarize the open use cases that are most at risk of missing go-live.",
  "What accounts haven't had a call in the past two weeks?",
  "Help me write a check-in email for a stalled implementation.",
  "Which accounts have pending TMRs that need attention?",
  "Show me accounts approaching their contract capacity.",
];

function getMockUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("bkmng-user-id") || "jusdavis";
}

async function* streamChat(
  messages: { role: string; content: string }[]
): AsyncGenerator<string> {
  const mockUserId = getMockUserId();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mockUserId) headers["X-Mock-User"] = mockUserId;

  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, account_id: null }),
  });

  if (!res.ok || !res.body) throw new Error(`Agent error: ${res.status}`);

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

export default function ACEPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length === 0;

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

    const history = [
      ...messages.filter((m) => m.role === "user" || m.role === "assistant"),
      userMsg,
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      let accumulated = "";
      for await (const chunk of streamChat(history)) {
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
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: errText, pending: false } : m))
      );
    } finally {
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m))
      );
    }
  }, [input, streaming, messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center">
            <Sparkles size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">ACE</h1>
            <p className="text-xs text-slate-500">AI-powered sales assistant</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
          >
            <RotateCcw size={13} />
            New conversation
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-5">
              <Sparkles size={26} className="text-sky-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Ask ACE anything</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-8">
              Your Snowflake sales intelligence assistant. Ask about your accounts, use cases, consumption, or get help drafting outreach.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="text-left text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition-colors leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center mr-2.5 mt-0.5 shrink-0">
                    <Sparkles size={13} className="text-sky-600" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-sky-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.pending && !msg.content ? (
                    <ThinkingDots />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask ACE about your accounts, use cases, consumption…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 max-h-36"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="shrink-0 w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2 max-w-3xl mx-auto">
          ACE can make mistakes. Verify important information before acting.
        </p>
      </div>
    </div>
  );
}
