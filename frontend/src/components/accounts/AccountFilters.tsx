import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { LayoutGrid, LayoutList, Search } from 'lucide-react'
import type { Account } from '../../types'
import { useAuth } from '../../context/AuthContext'

export interface AccountFilterState {
  search: string
  engagement: string
  status: string
  industry: string
  ace: string
}

const selectClass =
  'bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-snow-300'

const inputClass =
  'w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-snow-300'

interface AccountFiltersProps {
  filters: AccountFilterState
  onFiltersChange: (f: AccountFilterState) => void
  accounts: Account[]
  viewMode: 'table' | 'cards'
  onViewModeChange: (m: 'table' | 'cards') => void
}

export function AccountFilters({
  filters,
  onFiltersChange,
  accounts,
  viewMode,
  onViewModeChange,
}: AccountFiltersProps) {
  const { currentUser } = useAuth()
  const [searchInput, setSearchInput] = useState(filters.search)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const onFiltersChangeRef = useRef(onFiltersChange)
  onFiltersChangeRef.current = onFiltersChange

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const f = filtersRef.current
      if (searchInput !== f.search) {
        onFiltersChangeRef.current({ ...f, search: searchInput })
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const industries = useMemo(() => {
    const set = new Set(accounts.map((a) => a.industry))
    return ['All', ...[...set].sort()]
  }, [accounts])

  const aceOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of accounts) {
      set.add(a.ace_assigned)
      for (const c of a.collaborators) set.add(c)
    }
    return ['All', ...[...set].sort()]
  }, [accounts])

  const showAceFilter = currentUser.role === 'acem'

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] max-w-md flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search accounts…"
          className={inputClass}
          aria-label="Search accounts"
        />
      </div>

      <select
        className={selectClass}
        value={filters.engagement}
        onChange={(e) =>
          onFiltersChange({ ...filters, engagement: e.target.value })
        }
        aria-label="Filter by engagement"
      >
        <option value="All">All engagements</option>
        <option value="Pre-Activation">Pre-Activation</option>
        <option value="Active">Active</option>
        <option value="Completed">Completed</option>
      </select>

      <select
        className={selectClass}
        value={filters.status}
        onChange={(e) =>
          onFiltersChange({ ...filters, status: e.target.value })
        }
        aria-label="Filter by status"
      >
        <option value="All">All statuses</option>
        <option value="Active">Active</option>
        <option value="Onboarding">Onboarding</option>
        <option value="At Risk">At Risk</option>
        <option value="Go Live">Go Live</option>
      </select>

      <select
        className={selectClass}
        value={filters.industry}
        onChange={(e) =>
          onFiltersChange({ ...filters, industry: e.target.value })
        }
        aria-label="Filter by industry"
      >
        {industries.map((ind) => (
          <option key={ind} value={ind}>
            {ind === 'All' ? 'All industries' : ind}
          </option>
        ))}
      </select>

      {showAceFilter && (
        <select
          className={selectClass}
          value={filters.ace}
          onChange={(e) =>
            onFiltersChange({ ...filters, ace: e.target.value })
          }
          aria-label="Filter by ACE"
        >
          {aceOptions.map((ace) => (
            <option key={ace} value={ace}>
              {ace === 'All' ? 'All ACEs' : ace}
            </option>
          ))}
        </select>
      )}

      <div
        className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
        role="group"
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          className={clsx(
            'rounded-md p-2 text-slate-500 transition-colors',
            viewMode === 'table'
              ? 'bg-snow-50 text-snow-700 ring-2 ring-snow-200'
              : 'hover:bg-slate-50 hover:text-slate-700',
          )}
          aria-pressed={viewMode === 'table'}
          title="Table view"
        >
          <LayoutList className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('cards')}
          className={clsx(
            'rounded-md p-2 text-slate-500 transition-colors',
            viewMode === 'cards'
              ? 'bg-snow-50 text-snow-700 ring-2 ring-snow-200'
              : 'hover:bg-slate-50 hover:text-slate-700',
          )}
          aria-pressed={viewMode === 'cards'}
          title="Card view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
