import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'
import type {
  ForecastCategory,
  UseCase,
  UseCaseForecast,
  UserRole,
} from '../../types'
import { StatusBadge } from '../accounts/StatusBadge'

interface ForecastTableProps {
  useCases: UseCase[]
  forecasts: UseCaseForecast[]
  effectiveCategory: (f: UseCaseForecast) => ForecastCategory
  userRole: UserRole
  onAdjust: (forecast: UseCaseForecast, useCase: UseCase) => void
  onApprove?: (forecast: UseCaseForecast) => void
  onReject?: (forecast: UseCaseForecast) => void
  showAceColumn: boolean
}

type Row = { useCase: UseCase; forecast: UseCaseForecast }

type SortField = 'account' | 'useCase' | 'stage' | 'forecast'

const CATEGORY_ORDER: Record<ForecastCategory, number> = {
  Commit: 0,
  'Most Likely': 1,
  Stretch: 2,
}

function categoryBadgeClass(cat: ForecastCategory): string {
  switch (cat) {
    case 'Commit':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'Most Likely':
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'Stretch':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
}

export function ForecastTable({
  useCases,
  forecasts,
  effectiveCategory,
  userRole,
  onAdjust,
  onApprove,
  onReject,
  showAceColumn,
}: ForecastTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<
    'All' | ForecastCategory
  >('All')
  const [sortField, setSortField] = useState<SortField>('account')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const rows = useMemo(() => {
    const byId = new Map(useCases.map((uc) => [uc.use_case_id, uc]))
    const joined: Row[] = []
    for (const f of forecasts) {
      const uc = byId.get(f.use_case_id)
      if (uc) joined.push({ useCase: uc, forecast: f })
    }
    return joined
  }, [useCases, forecasts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ useCase, forecast }) => {
      if (q) {
        const matchAccount = useCase.account_name.toLowerCase().includes(q)
        const matchUc = useCase.use_case_name.toLowerCase().includes(q)
        if (!matchAccount && !matchUc) return false
      }
      if (categoryFilter !== 'All') {
        if (effectiveCategory(forecast) !== categoryFilter) return false
      }
      return true
    })
  }, [rows, search, categoryFilter, effectiveCategory])

  const sorted = useMemo(() => {
    const out = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    out.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'account':
          cmp = a.useCase.account_name.localeCompare(b.useCase.account_name)
          break
        case 'useCase':
          cmp = a.useCase.use_case_name.localeCompare(b.useCase.use_case_name)
          break
        case 'stage':
          cmp = a.useCase.stage.localeCompare(b.useCase.stage)
          break
        case 'forecast': {
          const ca = effectiveCategory(a.forecast)
          const cb = effectiveCategory(b.forecast)
          cmp = CATEGORY_ORDER[ca] - CATEGORY_ORDER[cb]
          break
        }
      }
      return cmp * dir
    })
    return out
  }, [filtered, sortField, sortDir, effectiveCategory])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortHeader({
    field,
    label,
    className,
  }: {
    field: SortField
    label: string
    className?: string
  }) {
    const active = sortField === field
    return (
      <th scope="col" className={clsx('pb-3 font-medium', className)}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className="inline-flex items-center gap-1 text-left uppercase tracking-wider hover:text-slate-700"
        >
          {label}
          <span className="inline-flex flex-col leading-none">
            <ChevronUp
              className={clsx(
                'h-3 w-3 -mb-0.5',
                active && sortDir === 'asc'
                  ? 'text-slate-800'
                  : 'text-slate-300',
              )}
              aria-hidden
            />
            <ChevronDown
              className={clsx(
                'h-3 w-3',
                active && sortDir === 'desc'
                  ? 'text-slate-800'
                  : 'text-slate-300',
              )}
              aria-hidden
            />
          </span>
        </button>
      </th>
    )
  }

  const categoryButtons: Array<'All' | ForecastCategory> = [
    'All',
    'Commit',
    'Most Likely',
    'Stretch',
  ]

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts or use cases…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
            aria-label="Filter by account or use case name"
          />
        </div>
        <SlidersHorizontal
          className="h-4 w-4 shrink-0 text-slate-400"
          aria-hidden
        />
        <div className="flex rounded-lg bg-slate-100 p-1">
          {categoryButtons.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                categoryFilter === cat
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No use cases match the current filters.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <SortHeader field="account" label="Account" />
              <SortHeader field="useCase" label="Use Case" />
              {showAceColumn && (
                <th scope="col" className="pb-3 font-medium">
                  ACE
                </th>
              )}
              <SortHeader field="stage" label="Stage" />
              <SortHeader field="forecast" label="Forecast" />
              <th scope="col" className="pb-3 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(({ useCase: uc, forecast: f }) => {
              const eff = effectiveCategory(f)
              const overridden = f.override_category !== null
              return (
                <tr key={f.use_case_id}>
                  <td className="py-3 pr-3 align-middle">
                    <Link
                      to={`/accounts/${uc.account_id}`}
                      className="text-sm font-medium text-slate-700 hover:text-snow-600"
                    >
                      {uc.account_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 align-middle text-sm text-slate-700">
                    {uc.use_case_name}
                  </td>
                  {showAceColumn && (
                    <td className="py-3 pr-3 align-middle text-xs text-slate-500">
                      {uc.ace_assigned}
                    </td>
                  )}
                  <td className="py-3 pr-3 align-middle">
                    <StatusBadge status={uc.stage} />
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <div className="flex flex-col items-start gap-0.5">
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          categoryBadgeClass(eff),
                          overridden && 'font-semibold',
                        )}
                      >
                        {eff}
                      </span>
                      {f.pending_approval && (
                        <span className="text-[10px] text-amber-600">
                          Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 align-middle">
                    {userRole === 'ace' && (
                      <button
                        type="button"
                        onClick={() => onAdjust(f, uc)}
                        className="text-xs text-snow-600 hover:underline"
                      >
                        Adjust
                      </button>
                    )}
                    {userRole === 'acem' &&
                      (f.pending_approval ? (
                        <span className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onApprove?.(f)}
                            className="text-xs text-emerald-600 hover:underline"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onReject?.(f)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Reject
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAdjust(f, uc)}
                          className="text-xs text-snow-600 hover:underline"
                        >
                          Adjust
                        </button>
                      ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
