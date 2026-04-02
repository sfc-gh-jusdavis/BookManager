import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Users,
} from 'lucide-react'
import type { GongCall } from '../../types'

function formatCallDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function actionItemDisplay(text: string): { done: boolean; label: string } {
  const prefix = /^\[DONE\]\s*/i
  if (prefix.test(text)) {
    return { done: true, label: text.replace(prefix, '') }
  }
  return { done: false, label: text }
}

interface GongCallCardProps {
  call: GongCall
}

export function GongCallCard({ call }: GongCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {formatCallDate(call.call_date)}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="shrink-0" size={14} aria-hidden />
          {call.duration_minutes} min
          {expanded ? (
            <ChevronUp className="shrink-0" size={16} aria-hidden />
          ) : (
            <ChevronDown className="shrink-0" size={16} aria-hidden />
          )}
        </span>
      </div>
      <p
        className={`mt-1 text-xs text-slate-500 ${expanded ? '' : 'line-clamp-2'}`}
      >
        {call.summary}
      </p>

      {expanded && (
        <>
          {call.topics.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Topics</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {call.topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-snow-50 px-2 py-0.5 text-xs text-snow-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {call.action_items.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Action Items</p>
              <ul className="mt-1.5 space-y-1.5">
                {call.action_items.map((item, i) => {
                  const { done, label } = actionItemDisplay(item)
                  return (
                    <li key={i} className="flex items-start gap-2">
                      {done ? (
                        <CheckCircle2
                          className="mt-0.5 shrink-0 text-green-600"
                          size={14}
                          aria-hidden
                        />
                      ) : (
                        <Circle
                          className="mt-0.5 shrink-0 text-slate-400"
                          size={14}
                          aria-hidden
                        />
                      )}
                      <span className="text-xs text-slate-600">{label}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {call.next_steps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Next Steps</p>
              <ul className="mt-1.5 space-y-1.5">
                {call.next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 w-3.5 shrink-0 text-center text-xs leading-[14px] text-slate-400"
                      aria-hidden
                    >
                      →
                    </span>
                    <span className="text-xs text-slate-600">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3">
            <p className="flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Users className="shrink-0" size={14} aria-hidden />
              Participants
            </p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-600">Internal: </span>
              {call.participants_internal.length > 0
                ? call.participants_internal.join(', ')
                : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-600">External: </span>
              {call.participants_external.length > 0
                ? call.participants_external.join(', ')
                : '—'}
            </p>
          </div>
        </>
      )}
    </button>
  )
}
