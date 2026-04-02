import { Fragment } from 'react'

import { StatusBadge } from '../accounts/StatusBadge'
import type { PSNote, UseCase } from '../../types'

export function getDateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function formatGroupDate(iso: string): string {
  const key = getDateKey(iso)
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  const first = parts[0]!
  const last = parts[parts.length - 1]!
  const a = first[0]
  const b = last[0]
  if (a === undefined || b === undefined) return '?'
  return (a + b).toUpperCase()
}

type NoteWithContext = PSNote & { use_case_name: string; stage: string }

export interface NotesTimelineProps {
  useCases: UseCase[]
}

export function NotesTimeline({ useCases }: NotesTimelineProps) {
  const notes: NoteWithContext[] = useCases.flatMap((uc) =>
    (uc.ps_notes ?? []).map((n) => ({
      ...n,
      use_case_name: uc.use_case_name,
      stage: uc.stage,
    })),
  )

  notes.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const grouped = new Map<string, NoteWithContext[]>()
  for (const note of notes) {
    const key = getDateKey(note.created_at)
    const list = grouped.get(key) ?? []
    list.push(note)
    grouped.set(key, list)
  }
  const dateGroups = Array.from(grouped.entries())

  if (notes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No notes recorded yet.
      </p>
    )
  }

  return (
    <section>
      {dateGroups.map(([dateKey, dayNotes]) => (
        <Fragment key={dateKey}>
          <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700 first:mt-0">
            {formatGroupDate(dayNotes[0]!.created_at)}
          </h3>
          <div>
            {dayNotes.map((note) => (
              <div
                key={note.note_id}
                className="relative pb-4 pl-6 last:pb-0"
              >
                <span
                  className="absolute bottom-0 left-0 top-0 ml-3 border-l-2 border-slate-200"
                  aria-hidden
                />
                <span
                  className="absolute left-[12px] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-snow-400"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-snow-50 px-2 py-0.5 text-xs font-medium text-snow-700">
                    {note.use_case_name}
                  </span>
                  <StatusBadge status={note.stage} />
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-slate-700">
                    {note.author}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTime(note.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{note.content}</p>
              </div>
            ))}
          </div>
        </Fragment>
      ))}
    </section>
  )
}
