import { useMemo, useState, useEffect, useCallback } from 'react'
import { Header } from '../components/layout/Header'
import {
  AccountFilters,
  type AccountFilterState,
} from '../components/accounts/AccountFilters'
import { AccountTable } from '../components/accounts/AccountTable'
import { AccountCard } from '../components/accounts/AccountCard'
import { useAuth } from '../context/AuthContext'
import { MOCK_ACCOUNTS } from '../mocks/accounts'
import { MOCK_USE_CASES } from '../mocks/useCases'
import { MOCK_ACCOUNT_RESOURCES } from '../mocks/accountResources'
import type { UseCase, AccountResource } from '../types'
import { isAceOnAccount } from '../utils/aceScoping'

const VIEW_STORAGE_KEY = 'accounts-view-mode'

const initialFilters: AccountFilterState = {
  search: '',
  engagement: 'All',
  status: 'All',
  industry: 'All',
  ace: 'All',
}

function earliestTargetGoLive(useCases: UseCase[]): string | null {
  const dates = useCases
    .map((uc) => uc.target_go_live_date)
    .filter((d): d is string => Boolean(d))
  if (dates.length === 0) return null
  return dates.sort()[0] ?? null
}

export function Accounts() {
  const { currentUser } = useAuth()
  const [filters, setFilters] = useState<AccountFilterState>(initialFilters)
  const [resources, setResources] = useState<AccountResource[]>(MOCK_ACCOUNT_RESOURCES)

  const resourcesByAccount = useMemo(() => {
    const map: Record<string, AccountResource[]> = {}
    for (const res of resources) {
      if (!map[res.account_id]) map[res.account_id] = []
      map[res.account_id]!.push(res)
    }
    return map
  }, [resources])

  const handleAddResource = useCallback((resource: AccountResource) => {
    setResources((prev) => [...prev, resource])
  }, [])

  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window === 'undefined') return 'table'
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY)
    return v === 'cards' ? 'cards' : 'table'
  })

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  const useCasesByAccount = useMemo(() => {
    const map: Record<string, UseCase[]> = {}
    for (const uc of MOCK_USE_CASES) {
      if (!map[uc.account_id]) map[uc.account_id] = []
      map[uc.account_id]!.push(uc)
    }
    return map
  }, [])

  const roleScoped = useMemo(() => {
    if (currentUser.role === 'ace') {
      return MOCK_ACCOUNTS.filter(
        (a) => isAceOnAccount(a, currentUser.user_id),
      )
    }
    return MOCK_ACCOUNTS
  }, [currentUser.role, currentUser.user_id])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return roleScoped.filter((a) => {
      if (q && !a.account_name.toLowerCase().includes(q)) return false
      if (filters.engagement !== 'All' && a.engagement_status !== filters.engagement)
        return false
      if (filters.status !== 'All' && a.status !== filters.status) return false
      if (filters.industry !== 'All' && a.industry !== filters.industry)
        return false
      if (filters.ace !== 'All' && !isAceOnAccount(a, filters.ace)) return false
      return true
    })
  }, [roleScoped, filters])

  return (
    <div className="flex min-h-full flex-col">
      <Header
        title={currentUser.role === 'acem' ? 'All Accounts' : 'My Accounts'}
        subtitle={`${filtered.length} accounts`}
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <AccountFilters
          filters={filters}
          onFiltersChange={setFilters}
          accounts={roleScoped}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {roleScoped.length} accounts
        </p>
        {viewMode === 'table' ? (
          <AccountTable
            accounts={filtered}
            useCasesByAccount={useCasesByAccount}
            resourcesByAccount={resourcesByAccount}
            currentUserName={currentUser.display_name}
            currentUserId={currentUser.user_id}
            onAddResource={handleAddResource}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((account) => (
              <AccountCard
                key={account.account_id}
                account={account}
                nextGoLiveDate={earliestTargetGoLive(
                  useCasesByAccount[account.account_id] ?? [],
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
