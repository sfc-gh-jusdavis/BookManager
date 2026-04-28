import { Link } from 'react-router-dom'
import type { Account, UseCase, PSNote, AccountResource } from '../../types'
import { CreditBar } from './CreditBar'
import { StatusBadge } from './StatusBadge'
import { AddInfoDropdown, linkTypeIcon } from './AddInfoDropdown'

function formatTargetGoLive(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

function getLatestNote(notes: PSNote[]): PSNote | null {
  if (notes.length === 0) return null
  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return sorted[0] ?? null
}

interface AccountExpandedRowProps {
  account: Account
  useCases: UseCase[]
  resources: AccountResource[]
  currentUserName: string
  onAddResource: (resource: AccountResource) => void
}

export function AccountExpandedRow({
  account,
  useCases,
  resources,
  currentUserName,
  onAddResource,
}: AccountExpandedRowProps) {
  const allocated = account.total_credits_allocated
  const used = Math.round(allocated * 0.68)

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
      <div className="grid gap-6 md:grid-cols-[1fr_minmax(12rem,20rem)]">
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Use Cases
          </h4>
          <ul className="space-y-4">
            {useCases.map((uc) => {
              const latestNote = getLatestNote(uc.ps_notes)
              return (
                <li
                  key={uc.use_case_id}
                  className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {uc.use_case_name}
                    </span>
                    <StatusBadge status={uc.stage} />
                    <span className="text-xs text-slate-500">
                      Target: {formatTargetGoLive(uc.target_go_live_date)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {uc.description}
                  </p>
                  {latestNote && (
                    <p className="mt-1 line-clamp-1 text-xs italic text-slate-600">
                      &ldquo;{latestNote.content}&rdquo;{' '}
                      <span className="not-italic text-slate-400">
                        — {latestNote.author} {formatNoteDate(latestNote.created_at)}
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Credit Usage
            </h4>
            <CreditBar used={used} allocated={allocated} />
          </div>

          {resources.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resources
              </h4>
              <ul className="space-y-1.5">
                {resources.map((res) => (
                  <li key={res.resource_id} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {res.resource_type === 'link'
                        ? linkTypeIcon(res.link_type)
                        : linkTypeIcon(null)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {res.resource_type === 'link' ? (
                        <a
                          href={res.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-snow-600 hover:text-snow-700 hover:underline truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {res.title}
                        </a>
                      ) : (
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {res.title}
                        </p>
                      )}
                      {res.resource_type === 'note' && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {res.content}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Link
          to={`/accounts/${account.account_id}`}
          className="text-sm font-medium text-snow-600 hover:text-snow-700"
        >
          View Full Account →
        </Link>
        <div onClick={(e) => e.stopPropagation()}>
          <AddInfoDropdown
            accountId={account.account_id}
            createdBy={currentUserName}
            onAdd={onAddResource}
          />
        </div>
      </div>
    </div>
  )
}
