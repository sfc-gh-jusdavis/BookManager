import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { TMR, UserRole, TMRReviewNote } from '../../types'
import { TMRStatusBadge, PriorityBadge } from './TMRStatusBadge'
import { ReviewPanel } from './ReviewPanel'
import { useAceDisplayNames } from '../../api/hooks'

type SortField = 'account' | 'requestType' | 'priority' | 'status' | 'requested' | 'hours'
type SortDir = 'asc' | 'desc'

interface TMRTableProps {
  tmrs: TMR[]
  userRole: UserRole
  currentUserId: string
  currentUserName: string
  onAssign: (tmr: TMR) => void
  onUpdateTmr: (updated: TMR) => void
}

const priorityOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3 }
const statusOrder: Record<string, number> = {
  Open: 1,
  'Pending Review': 2,
  'Manager Review': 3,
  Scheduled: 4,
  'In Progress': 5,
  Blocked: 6,
  Completed: 7,
}

export function TMRTable({
  tmrs,
  userRole,
  currentUserId,
  currentUserName,
  onAssign,
  onUpdateTmr,
}: TMRTableProps) {
  const [sortField, setSortField] = useState<SortField>('requested')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: aceDisplayNames = {} } = useAceDisplayNames()

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...tmrs]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (sortField) {
        case 'account':
          return dir * a.account_name.localeCompare(b.account_name)
        case 'requestType':
          return dir * a.request_type.localeCompare(b.request_type)
        case 'priority':
          return dir * ((priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
        case 'status':
          return dir * ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
        case 'requested':
          return dir * a.requested_date.localeCompare(b.requested_date)
        case 'hours':
          return dir * ((a.estimated_hours ?? 0) - (b.estimated_hours ?? 0))
        default:
          return 0
      }
    })
    return arr
  }, [tmrs, sortField, sortDir])

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField
    label: string
  }) => (
    <th
      scope="col"
      className="cursor-pointer select-none pb-3 pr-3 font-medium hover:text-slate-700"
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortField === field && (
        <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </th>
  )

  const addNote = (tmr: TMR, content: string) => {
    const newNote: TMRReviewNote = {
      note_id: `rn-${tmr.tmr_id}-${Date.now()}`,
      tmr_id: tmr.tmr_id,
      author_id: currentUserId,
      author_name: currentUserName,
      content,
      created_at: new Date().toISOString(),
    }
    onUpdateTmr({ ...tmr, review_notes: [...tmr.review_notes, newNote] })
  }

  const submitReview = (tmr: TMR) => {
    onUpdateTmr({ ...tmr, status: 'Manager Review' })
  }

  const approve = (tmr: TMR) => {
    onUpdateTmr({ ...tmr, status: 'Scheduled' })
  }

  const sendBack = (tmr: TMR) => {
    onUpdateTmr({ ...tmr, status: 'Pending Review' })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <th scope="col" className="w-8 pb-3" />
            <SortHeader field="account" label="Account" />
            <SortHeader field="requestType" label="Request Type" />
            <SortHeader field="priority" label="Priority" />
            <SortHeader field="status" label="Status" />
            {userRole === 'acem' && (
              <th scope="col" className="pb-3 pr-3 font-medium">
                Assigned To
              </th>
            )}
            <SortHeader field="requested" label="Requested" />
            <SortHeader field="hours" label="Est. Hours" />
            <th scope="col" className="pb-3 font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((tmr) => {
            const expanded = expandedId === tmr.tmr_id
            const assigneeName = tmr.assigned_to
              ? (aceDisplayNames[tmr.assigned_to] ?? tmr.assigned_to)
              : null

            return (
              <RowGroup key={tmr.tmr_id}>
                <tr
                  className={clsx(
                    'cursor-pointer transition-colors hover:bg-slate-50',
                    expanded && 'bg-slate-50',
                  )}
                  onClick={() => setExpandedId(expanded ? null : tmr.tmr_id)}
                >
                  <td className="py-3 pl-2 pr-1 align-middle">
                    {expanded ? (
                      <ChevronDown size={14} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={14} className="text-slate-400" />
                    )}
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <Link
                      to={`/accounts/${tmr.account_id}`}
                      className="font-medium text-slate-800 hover:text-snow-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tmr.account_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 align-middle text-slate-600">{tmr.request_type}</td>
                  <td className="py-3 pr-3 align-middle">
                    <PriorityBadge priority={tmr.priority} />
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <TMRStatusBadge status={tmr.status} />
                  </td>
                  {userRole === 'acem' && (
                    <td className="py-3 pr-3 align-middle text-sm text-slate-600">
                      {assigneeName ?? (
                        <span className="italic text-slate-400">Unassigned</span>
                      )}
                    </td>
                  )}
                  <td className="py-3 pr-3 align-middle text-slate-600">
                    {new Date(tmr.requested_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-3 pr-3 align-middle text-slate-600">
                    {tmr.estimated_hours != null ? `${tmr.estimated_hours}h` : '—'}
                  </td>
                  <td className="py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                    <ActionButtons
                      tmr={tmr}
                      userRole={userRole}
                      onAssign={() => onAssign(tmr)}
                    />
                  </td>
                </tr>

                {expanded && (
                  <tr>
                    <td colSpan={userRole === 'acem' ? 9 : 8} className="bg-slate-50/60 p-4">
                      <div className="ml-6 max-w-3xl space-y-4">
                        {tmr.use_case_id && (
                          <p className="text-xs text-slate-500">
                            Use Case:{' '}
                            <span className="font-medium text-slate-700">{tmr.use_case_id}</span>
                          </p>
                        )}
                        {tmr.actual_hours != null && (
                          <p className="text-xs text-slate-500">
                            Hours logged:{' '}
                            <span className="font-medium text-slate-700">{tmr.actual_hours}h</span>
                            {tmr.estimated_hours != null && (
                              <span className="text-slate-400">
                                {' '}
                                / {tmr.estimated_hours}h estimated
                              </span>
                            )}
                          </p>
                        )}
                        {tmr.outcome && (
                          <p className="text-xs text-slate-500">
                            Outcome:{' '}
                            <span className="text-slate-700">{tmr.outcome}</span>
                          </p>
                        )}
                        <ReviewPanel
                          notes={tmr.review_notes}
                          tmrStatus={tmr.status}
                          userRole={userRole}
                          currentUserId={currentUserId}
                          currentUserName={currentUserName}
                          onAddNote={(content) => addNote(tmr, content)}
                          onSubmitReview={() => submitReview(tmr)}
                          onApprove={() => approve(tmr)}
                          onSendBack={() => sendBack(tmr)}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </RowGroup>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={userRole === 'acem' ? 9 : 8}
                className="py-12 text-center text-sm text-slate-400"
              >
                No TMRs match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function ActionButtons({
  tmr,
  userRole,
  onAssign,
}: {
  tmr: TMR
  userRole: UserRole
  onAssign: () => void
}) {
  if (userRole === 'acem' && tmr.status === 'Open') {
    return (
      <button
        onClick={onAssign}
        className="rounded-md bg-snow-50 px-3 py-1 text-xs font-medium text-snow-600 transition-colors hover:bg-snow-100"
      >
        Assign
      </button>
    )
  }

  if (tmr.status === 'Completed' || tmr.status === 'Blocked') {
    return <span className="text-xs text-slate-400">—</span>
  }

  return <span className="text-xs text-slate-400">Expand row</span>
}
