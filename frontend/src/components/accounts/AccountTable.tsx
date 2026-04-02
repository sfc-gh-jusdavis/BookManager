import { Fragment, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Users } from 'lucide-react'
import type { Account, UseCase, AccountResource } from '../../types'
import { AccountExpandedRow } from './AccountExpandedRow'
import { CreditBar } from './CreditBar'
import { StatusBadge } from './StatusBadge'
import { estimatedCreditsUsed } from './accountCreditEstimate'
import { ACE_DISPLAY_NAMES } from '../../mocks/aceDisplayNames'

type SortField =
  | 'account_name'
  | 'engagement_status'
  | 'status'
  | 'industry'
  | 'use_case_count'
  | 'credits'

interface AccountTableProps {
  accounts: Account[]
  useCasesByAccount: Record<string, UseCase[]>
  resourcesByAccount: Record<string, AccountResource[]>
  currentUserName: string
  currentUserId: string
  onAddResource: (resource: AccountResource) => void
}

function compareSort(
  a: Account,
  b: Account,
  field: SortField,
  dir: 'asc' | 'desc',
): number {
  let cmp = 0
  switch (field) {
    case 'account_name':
      cmp = a.account_name.localeCompare(b.account_name)
      break
    case 'engagement_status':
      cmp = a.engagement_status.localeCompare(b.engagement_status)
      break
    case 'status':
      cmp = a.status.localeCompare(b.status)
      break
    case 'industry':
      cmp = a.industry.localeCompare(b.industry)
      break
    case 'use_case_count':
      cmp = a.use_case_count - b.use_case_count
      break
    case 'credits':
      cmp = a.total_credits_allocated - b.total_credits_allocated
      break
    default:
      cmp = 0
  }
  return dir === 'asc' ? cmp : -cmp
}

export function AccountTable({ accounts, useCasesByAccount, resourcesByAccount, currentUserName, currentUserId, onAddResource }: AccountTableProps) {
  const [sortField, setSortField] = useState<SortField>('account_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...accounts].sort((a, b) =>
      compareSort(a, b, sortField, sortDir),
    )
  }, [accounts, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortLabel({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) {
    const active = sortField === field
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 uppercase tracking-wider"
      >
        {children}
        {active &&
          (sortDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          ))}
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="account_name">Account Name</SortLabel>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="engagement_status">Engagement</SortLabel>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="status">Status</SortLabel>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="industry">Industry</SortLabel>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="use_case_count">Use Cases</SortLabel>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                <SortLabel field="credits">Credits</SortLabel>
              </th>
              <th
                scope="col"
                className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                <span className="sr-only">Expand</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((account) => {
              const used = estimatedCreditsUsed(
                account.status,
                account.total_credits_allocated,
              )
              const expanded = expandedId === account.account_id
              return (
                <Fragment key={account.account_id}>
                  <tr
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                    onClick={() =>
                      setExpandedId((id) =>
                        id === account.account_id ? null : account.account_id,
                      )
                    }
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        {account.account_name}
                        {account.collaborators.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                            title={`Team: ${ACE_DISPLAY_NAMES[account.ace_assigned] ?? account.ace_assigned}, ${account.collaborators.map((c) => ACE_DISPLAY_NAMES[c] ?? c).join(', ')}`}
                          >
                            <Users size={10} />
                            {account.collaborators.length + 1}
                          </span>
                        )}
                        {account.collaborators.includes(currentUserId) && (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 border border-violet-200">
                            Collab
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      <StatusBadge
                        status={account.engagement_status}
                        variant="engagement"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      <StatusBadge status={account.status} />
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      {account.industry}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">
                      {account.use_case_count}
                    </td>
                    <td
                      className="px-4 py-3.5 text-sm text-slate-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CreditBar
                        used={used}
                        allocated={account.total_credits_allocated}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={7} className="p-0">
                        <AccountExpandedRow
                          account={account}
                          useCases={
                            useCasesByAccount[account.account_id] ?? []
                          }
                          resources={
                            resourcesByAccount[account.account_id] ?? []
                          }
                          currentUserName={currentUserName}
                          onAddResource={onAddResource}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
