import { useState, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  MapPin,
  CreditCard,
  Users,
  UserPlus,
  X,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/accounts/StatusBadge'
import { UseCaseCard } from '../components/account-detail/UseCaseCard'
import { NotesTimeline } from '../components/account-detail/NotesTimeline'
import { CreditOverview } from '../components/account-detail/CreditOverview'
import { GongCallCard } from '../components/account-detail/GongCallCard'
import { AIChatPanel } from '../components/account-detail/AIChatPanel'
import {
  AddInfoDropdown,
  linkTypeIcon,
} from '../components/accounts/AddInfoDropdown'

import {
  useAccount,
  useAccountUseCases,
  useAccountGongCalls,
  useAccountResources,
  useAceDisplayNames,
} from '../api/hooks'
import { formatCredits } from '../components/accounts/CreditBar'

import type { Account, AccountResource } from '../types'

type ViewMode = 'by-use-case' | 'timeline' | 'assistant'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function resolveInitialTab(tab: string | null): ViewMode {
  if (tab === 'assistant') return 'assistant'
  if (tab === 'timeline') return 'timeline'
  return 'by-use-case'
}

export function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAuth()

  const tabParam = searchParams.get('tab')
  const promptParam = searchParams.get('prompt')

  const { data: baseAccount, isLoading: accountLoading } = useAccount(accountId ?? '')
  const { data: useCases = [] } = useAccountUseCases(accountId ?? '')
  const { data: gongCallsRaw = [] } = useAccountGongCalls(accountId ?? '')
  const { data: apiResources = [] } = useAccountResources(accountId ?? '')
  const { data: aceDisplayNames = {} } = useAceDisplayNames()

  const [accountOverrides, setAccountOverrides] = useState<Map<string, Account>>(new Map())

  const account = accountOverrides.get(accountId ?? '') ?? baseAccount

  const [showAddCollab, setShowAddCollab] = useState(false)

  const allAceIds = useMemo(() => Object.keys(aceDisplayNames), [aceDisplayNames])
  const availableCollaborators = useMemo(() => {
    if (!account) return []
    const current = new Set([account.ace_assigned, ...account.collaborators])
    return allAceIds.filter((id) => !current.has(id))
  }, [account, allAceIds])

  const handleAddCollaborator = (aceId: string) => {
    if (!account) return
    const updated = { ...account, collaborators: [...account.collaborators, aceId] }
    setAccountOverrides((prev) => new Map(prev).set(account.account_id, updated))
    setShowAddCollab(false)
  }

  const handleRemoveCollaborator = (aceId: string) => {
    if (!account) return
    const updated = { ...account, collaborators: account.collaborators.filter((c) => c !== aceId) }
    setAccountOverrides((prev) => new Map(prev).set(account.account_id, updated))
  }

  const gongCalls = useMemo(
    () =>
      [...gongCallsRaw].sort(
        (a, b) =>
          new Date(b.call_date).getTime() - new Date(a.call_date).getTime(),
      ),
    [gongCallsRaw],
  )

  const [localResources, setLocalResources] = useState<AccountResource[]>([])
  const accountResources = useMemo(
    () => [...apiResources, ...localResources].filter((r) => r.account_id === accountId),
    [apiResources, localResources, accountId],
  )

  const [viewMode, setViewMode] = useState<ViewMode>(() => resolveInitialTab(tabParam))

  if (accountLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="animate-spin h-8 w-8 border-4 border-snow-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-lg text-slate-500">Account not found</p>
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-snow-600 hover:text-snow-700"
        >
          <ArrowLeft size={16} />
          Back to Accounts
        </Link>
      </div>
    )
  }

  function handleAddResource(resource: AccountResource) {
    setLocalResources((prev) => [resource, ...prev])
  }

  const TAB_OPTIONS: { key: ViewMode; label: string; icon?: typeof Sparkles }[] = [
    { key: 'by-use-case', label: 'By Use Case' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'assistant', label: 'AI Assistant', icon: Sparkles },
  ]

  return (
    <div className="min-h-full bg-slate-50/50 px-6 py-6">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft size={16} />
          Back to Accounts
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {account.account_name}
          </h1>
          <StatusBadge status={account.status} />
          <StatusBadge
            status={account.engagement_status}
            variant="engagement"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={13} className="shrink-0" />
            {account.industry}
            {account.region ? ` · ${account.region}` : ''}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} className="shrink-0" />
            Started: {formatDate(account.activation_start_date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CreditCard size={13} className="shrink-0" />
            {formatCredits(account.total_credits_allocated)} credits
          </span>
        </div>

        {/* Account Team */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Team:</span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-snow-200 bg-snow-50 px-2.5 py-1 text-xs font-medium text-snow-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-snow-500 text-[10px] font-bold text-white">
              {(aceDisplayNames[account.ace_assigned] ?? account.ace_assigned).split(' ').map((n) => n[0]).join('')}
            </span>
            {aceDisplayNames[account.ace_assigned] ?? account.ace_assigned}
            <span className="rounded bg-snow-100 px-1 py-0.5 text-[9px] uppercase tracking-wider text-snow-600">Primary</span>
          </span>

          {account.collaborators.map((collabId) => (
            <span
              key={collabId}
              className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold text-white">
                {(aceDisplayNames[collabId] ?? collabId).split(' ').map((n) => n[0]).join('')}
              </span>
              {aceDisplayNames[collabId] ?? collabId}
              {(currentUser.role === 'acem' || currentUser.user_id === account.ace_assigned) && (
                <button
                  onClick={() => handleRemoveCollaborator(collabId)}
                  className="rounded-full p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
                  title="Remove collaborator"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}

          {availableCollaborators.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAddCollab(!showAddCollab)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-snow-400 hover:text-snow-600"
              >
                <UserPlus size={12} />
                Add
              </button>
              {showAddCollab && (
                <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {availableCollaborators.map((aceId) => (
                    <button
                      key={aceId}
                      onClick={() => handleAddCollaborator(aceId)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold text-white">
                        {(aceDisplayNames[aceId] ?? aceId).split(' ').map((n) => n[0]).join('')}
                      </span>
                      {aceDisplayNames[aceId] ?? aceId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-8">
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
            {TAB_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {Icon && <Icon size={13} />}
                {label}
              </button>
            ))}
          </div>

          {viewMode === 'by-use-case' && (
            useCases.length > 0 ? (
              useCases.map((uc) => (
                <UseCaseCard key={uc.use_case_id} useCase={uc} />
              ))
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                No use cases found for this account.
              </p>
            )
          )}

          {viewMode === 'timeline' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <NotesTimeline useCases={useCases} />
            </div>
          )}

          {viewMode === 'assistant' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm min-h-[600px] flex flex-col">
              <AIChatPanel
                account={account}
                useCases={useCases}
                gongCalls={gongCalls}
                initialPrompt={promptParam ?? undefined}
              />
            </div>
          )}
        </div>

        {/* Right column — Credit, Resources, Gong */}
        <div className="space-y-5 lg:col-span-4">
          {/* Credit Overview */}
          <CreditOverview
            accountId={account.account_id}
            allocated={account.total_credits_allocated}
          />

          {/* Resources */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Resources & Notes
            </h3>

            {accountResources.length > 0 ? (
              <ul className="space-y-3">
                {accountResources.map((r) => (
                  <li
                    key={r.resource_id}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">
                        {r.resource_type === 'link'
                          ? linkTypeIcon(r.link_type)
                          : linkTypeIcon(null)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700">
                          {r.title}
                        </p>
                        {r.resource_type === 'note' ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {r.content}
                          </p>
                        ) : (
                          <a
                            href={r.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block truncate text-xs text-snow-600 hover:underline"
                          >
                            {r.content}
                          </a>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {r.created_by} · {formatDate(r.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                No resources added yet.
              </p>
            )}

            <div className="mt-3">
              <AddInfoDropdown
                accountId={account.account_id}
                createdBy={currentUser.display_name}
                onAdd={handleAddResource}
              />
            </div>
          </div>

          {/* Gong Calls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent Gong Calls
            </h3>

            {gongCalls.length > 0 ? (
              <div className="space-y-2">
                {gongCalls.map((call) => (
                  <GongCallCard key={call.call_id} call={call} />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                No Gong calls recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
