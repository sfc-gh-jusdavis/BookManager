import { Calendar, Clock, Sparkles, User } from 'lucide-react'

import { StatusBadge } from '../accounts/StatusBadge'
import type { UseCase } from '../../types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(iso: string): number {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return NaN
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]
  if (!first) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]
  if (!last) return first.charAt(0).toUpperCase()
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

interface UseCaseCardProps {
  useCase: UseCase
}

export function UseCaseCard({ useCase }: UseCaseCardProps) {
  const sortedNotes = [...useCase.ps_notes].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const targetIso = useCase.target_go_live_date
  const daysLeft =
    targetIso != null && targetIso !== '' ? daysUntil(targetIso) : NaN
  const showCountdown =
    targetIso != null &&
    targetIso !== '' &&
    !Number.isNaN(daysLeft) &&
    daysLeft > 0

  const countdownColorClass =
    daysLeft > 30
      ? 'text-emerald-600'
      : daysLeft >= 15
        ? 'text-amber-600'
        : 'text-red-600'

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-800">
          {useCase.use_case_name}
        </h3>
        <StatusBadge status={useCase.stage} />
        <StatusBadge status={useCase.status} />
        {useCase.complexity ? (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {useCase.complexity}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-slate-600">{useCase.description}</p>

      <div className="rounded-lg bg-sky-50 p-4">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="shrink-0 text-sky-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            AI Summary
          </span>
        </div>
        {useCase.ps_notes_summary ? (
          <p className="mt-1 text-sm text-slate-700">
            {useCase.ps_notes_summary}
          </p>
        ) : (
          <p className="mt-1 text-sm italic text-slate-600">
            No AI summary available
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-6 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="shrink-0" />
          Created: {formatDate(useCase.created_date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="shrink-0" />
          Target Go-Live:{' '}
          {useCase.target_go_live_date
            ? formatDate(useCase.target_go_live_date)
            : '—'}
        </span>
        {showCountdown ? (
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${countdownColorClass}`}
          >
            <Clock size={14} className="shrink-0" />
            {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <User size={14} className="shrink-0" />
          Lead SE: {useCase.lead_se}
        </span>
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Notes
        </h4>
        {sortedNotes.map((note) => (
          <div key={note.note_id} className="flex gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-snow-100 text-xs font-bold text-snow-700"
              aria-hidden
            >
              {getInitials(note.author)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  {note.author}
                </span>
                <span className="text-xs text-slate-400">
                  {formatDate(note.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-600">{note.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
