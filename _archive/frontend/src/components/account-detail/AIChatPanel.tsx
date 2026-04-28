import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react'
import { Send, Sparkles, Loader2 } from 'lucide-react'
import type { Account, UseCase, GongCall } from '../../types'

interface AIChatPanelProps {
  account: Account
  useCases: UseCase[]
  gongCalls: GongCall[]
  initialPrompt?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

let messageIdCounter = 0

function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${messageIdCounter}`
}

function ucSummary(uc: UseCase): string {
  return uc.ps_notes_summary?.trim() || 'No summary yet.'
}

function deriveNextActions(
  _account: Account,
  useCases: UseCase[],
  gongCalls: GongCall[]
): string[] {
  const actions: string[] = []
  for (const uc of useCases) {
    if (uc.status.toLowerCase() === 'blocked') {
      actions.push(`Resolve blocker for ${uc.use_case_name}`)
    }
  }
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const in30 = new Date(now)
  in30.setDate(in30.getDate() + 30)
  for (const uc of useCases) {
    if (!uc.target_go_live_date) continue
    const d = new Date(uc.target_go_live_date)
    d.setHours(0, 0, 0, 0)
    if (d >= now && d <= in30) {
      actions.push(`Prepare for go-live: ${uc.use_case_name}`)
    }
  }
  for (const call of gongCalls) {
    for (const item of call.action_items) {
      if (!/\[DONE\]/i.test(item)) {
        actions.push(`Follow up: ${item}`)
      }
    }
  }
  return actions
}

export function generateMockResponse(
  query: string,
  account: Account,
  useCases: UseCase[],
  gongCalls: GongCall[]
): string {
  const q = query.toLowerCase()
  const name = account.account_name

  if (q.includes('risk') || q.includes('blocker')) {
    const blocked = useCases.filter((u) => u.status.toLowerCase() === 'blocked')
    const accountAtRisk = account.status.toLowerCase().includes('at risk')
    const items =
      blocked.length > 0 ? blocked : accountAtRisk ? useCases : []

    if (items.length === 0) {
      return `Good news — there are no blocked use cases or major risks for ${name} right now.`
    }

    let body = `Here are the key risks for ${name}:\n\n`
    if (accountAtRisk && blocked.length === 0) {
      body = `The account is flagged as At Risk. Here are the use cases to watch for ${name}:\n\n`
    }
    for (const uc of items) {
      body += `**${uc.use_case_name}** (${uc.stage}): ${ucSummary(uc)}\n\n`
    }
    return body.trimEnd()
  }

  if (q.includes('progress') || q.includes('summary')) {
    let body = `Here's a progress summary for ${name}:\n\n`
    for (const uc of useCases) {
      body += `**${uc.use_case_name}** — ${uc.stage} | ${uc.status}\n${ucSummary(uc)}\n\n`
    }
    return body.trimEnd()
  }

  if (q.includes('next') || q.includes('action') || q.includes('focus')) {
    const actions = deriveNextActions(account, useCases, gongCalls)
    if (actions.length === 0) {
      return `Based on the current state of ${name}, there are no urgent derived actions in the mock data. Review use cases and Gong follow-ups manually.`
    }
    const numbered = actions.map((a, i) => `${i + 1}. ${a}`).join('\n')
    return `Based on the current state of ${name}, here are recommended next actions:\n\n${numbered}`
  }

  if (q.includes('email') || q.includes('update') || q.includes('draft')) {
    const actions = deriveNextActions(account, useCases, gongCalls)
    const nextSteps =
      actions.length > 0
        ? actions.map((a, i) => `${i + 1}. ${a}`).join('\n')
        : '1. Continue regular check-ins with the customer team.'

    let body = `Here's a draft status update for ${name}:\n\n---\n\nSubject: ${name} — Activation Status Update\n\nHi team,\n\nHere's the latest on our activation engagement with ${name}:\n\n`
    for (const uc of useCases) {
      body += `**${uc.use_case_name}** (${uc.stage}): ${ucSummary(uc)}\n\n`
    }
    body += `Next steps:\n${nextSteps}\n\nBest regards`
    return body
  }

  const byStage = new Map<string, number>()
  for (const uc of useCases) {
    const s = uc.stage || 'Unknown'
    byStage.set(s, (byStage.get(s) ?? 0) + 1)
  }
  const breakdown = [...byStage.entries()]
    .map(([stage, n]) => `${stage}: ${n}`)
    .join(', ')

  const blocked = useCases.filter((u) => u.status.toLowerCase() === 'blocked')
  const atRisk = account.status.toLowerCase().includes('at risk')
  let extra = ''
  if (blocked.length > 0) {
    extra += `\n\nBlocked use cases: ${blocked.map((u) => u.use_case_name).join(', ')}.`
  }
  if (atRisk) {
    extra += `\n\nAccount status is At Risk — prioritize executive alignment.`
  }

  return `Based on the data for ${name}, here's what I see:\n\n${useCases.length} total use case(s). Stage breakdown: ${breakdown || 'none'}.${extra}\n\nLet me know if you'd like me to dive deeper into any specific use case or topic.`
}

const SUGGESTED_PROMPTS = [
  'What are the biggest risks for this account?',
  'Summarize recent progress across all use cases',
  'What should I focus on next?',
  'Draft a status update email for this account',
]

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function renderMessageContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    )
  })
}

function TypingIndicator() {
  return (
    <div className="mr-8 flex items-center gap-2 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-snow-500" aria-hidden />
      <span className="flex items-center gap-1" aria-label="Assistant is typing">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        </span>
      </span>
    </div>
  )
}

export function AIChatPanel({
  account,
  useCases,
  gongCalls,
  initialPrompt,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialPromptFired = useRef(false)

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking, scrollToBottom])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isThinking) return

      const userMsg: ChatMessage = {
        id: nextMessageId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsThinking(true)

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        const content = generateMockResponse(trimmed, account, useCases, gongCalls)
        const assistantMsg: ChatMessage = {
          id: nextMessageId(),
          role: 'assistant',
          content,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        setIsThinking(false)
        timeoutRef.current = null
      }, 800)
    },
    [account, useCases, gongCalls, isThinking]
  )

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && !initialPromptFired.current) {
      initialPromptFired.current = true
      sendMessage(initialPrompt)
    }
  }, [initialPrompt, sendMessage])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const onTextareaInput = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 22
    const maxH = lineHeight * 3 + 16
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Sparkles className="h-5 w-5 text-snow-500" aria-hidden />
        <h2 className="text-base font-semibold text-slate-800">Account Assistant</h2>
      </header>

      <div
        ref={messagesContainerRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 && !isThinking && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Ask me anything about <span className="font-medium text-slate-700">{account.account_name}</span> — risks, progress, next steps, or draft an update.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:border-snow-200 hover:bg-snow-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            {m.role === 'user' ? (
              <div className="ml-8 rounded-xl rounded-tr-sm bg-snow-50 p-3 text-sm text-slate-800">
                {m.content}
              </div>
            ) : (
              <div className="mr-8 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {renderMessageContent(m.content)}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">{formatTime(m.timestamp)}</p>
          </div>
        ))}

        {isThinking && <TypingIndicator />}
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
            placeholder="Ask about this account…"
            className="max-h-[82px] min-h-[38px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
            disabled={isThinking}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={isThinking || !input.trim()}
            className="rounded-lg bg-snow-500 p-2 text-white transition-colors hover:bg-snow-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
