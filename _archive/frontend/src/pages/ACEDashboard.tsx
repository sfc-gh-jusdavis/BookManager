import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Header } from '../components/layout/Header'
import { StatusBadge } from '../components/accounts/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useAccounts, useUseCases, useGongCalls } from '../api/hooks'
import type { Account, PSNote, UseCase } from '../types'
import { isAceOnAccount } from '../utils/aceScoping'
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  Zap,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

const PIPELINE_STAGES = [
  'Discovery', 'Scoping', 'Technical Win', 'Use Case Won',
  'Impl Pending', 'Impl In Progress', 'Go-Live', 'Deployed',
] as const

const PIPELINE_BAR_FILLS = [
  '#94a3b8', '#64748b', '#0ea5e9', '#29B5E8',
  '#38bdf8', '#60a5fa', '#818cf8', '#6366f1',
]

const LINE_COLORS = ['#29B5E8', '#8B5CF6', '#F59E0B', '#10B981'] as const
const MS_PER_DAY = 86_400_000

function WidgetCard({ title, icon, span = 6, children }: { title: string; icon: ReactNode; span?: number; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm" style={{ gridColumn: `span ${span}` }}>
      <div className="flex items-center gap-2 px-6 pt-5 pb-3">
        <span className="text-snow-500">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="px-6 pb-5">{children}</div>
    </div>
  )
}

function formatCreditsShort(n: number): string {
  if (n >= 1_000_000) { const m = n / 1_000_000; return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M` }
  return `${Math.round(n / 1000)}K`
}

function truncateText(s: string, max: number): string {
  const t = s.trim(); return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

function parseLocalDate(isoDate: string): Date {
  const parts = isoDate.split('-').map((x) => Number(x))
  return new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
}

function startOfToday(): Date {
  const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

function formatGoLiveLabel(isoDate: string): string {
  return parseLocalDate(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

function latestPsNote(notes: PSNote[]): PSNote | null {
  if (notes.length === 0) return null
  return [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
}

function formatAxisDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`
}

type CreditChartRow = { date: string } & Record<string, number | string>
type AtRiskAlertRow = { useCase: UseCase; account: Account; dotClass: string }
type NextAction = { id: string; accountId: string; Icon: LucideIcon; iconClassName: string; text: string; priority: 'high' | 'medium' | 'low' }
const PRIORITY_RANK: Record<NextAction['priority'], number> = { high: 0, medium: 1, low: 2 }

function priorityChipClass(p: NextAction['priority']): string {
  switch (p) {
    case 'high': return 'bg-red-50 text-red-700 border border-red-200'
    case 'medium': return 'bg-amber-50 text-amber-700 border border-amber-200'
    default: return 'bg-slate-50 text-slate-600 border border-slate-200'
  }
}

export function ACEDashboard() {
  const { currentUser } = useAuth()
  const aceId = currentUser.user_id

  const { data: allAccounts = [] } = useAccounts()
  const { data: allUseCases = [] } = useUseCases()
  const { data: allGongCalls = [] } = useGongCalls()

  const myAccounts = useMemo(() => allAccounts.filter((a) => isAceOnAccount(a, aceId)), [allAccounts, aceId])
  const accountById = useMemo(() => { const m = new Map<string, Account>(); for (const a of allAccounts) m.set(a.account_id, a); return m }, [allAccounts])
  const myAccountIds = useMemo(() => new Set(myAccounts.map((a) => a.account_id)), [myAccounts])
  const myUseCases = useMemo(() => allUseCases.filter((uc) => myAccountIds.has(uc.account_id)), [allUseCases, myAccountIds])

  const atRiskAlerts = useMemo((): AtRiskAlertRow[] => {
    const rows: AtRiskAlertRow[] = []
    for (const uc of myUseCases) {
      const account = accountById.get(uc.account_id)
      if (!account) continue
      if (uc.status !== 'Blocked' && account.status !== 'At Risk') continue
      rows.push({ useCase: uc, account, dotClass: uc.status === 'Blocked' ? 'bg-red-500' : 'bg-amber-500' })
    }
    return rows
  }, [myUseCases, accountById])

  const pipelineData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of PIPELINE_STAGES) counts.set(s, 0)
    for (const uc of myUseCases) counts.set(uc.stage, (counts.get(uc.stage) ?? 0) + 1)
    return PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
  }, [myUseCases])

  const creditChartData = useMemo((): CreditChartRow[] => [], [])

  const accountNamesForLines = useMemo(() => myAccounts.map((a) => a.account_name), [myAccounts])

  const upcomingGoLives = useMemo(() => {
    const today = startOfToday()
    return [...myUseCases]
      .filter((uc) => { if (!uc.target_go_live_date) return false; return parseLocalDate(uc.target_go_live_date).getTime() > today.getTime() })
      .sort((a, b) => parseLocalDate(a.target_go_live_date!).getTime() - parseLocalDate(b.target_go_live_date!).getTime())
      .slice(0, 5)
  }, [myUseCases])

  const nextBestActions = useMemo((): NextAction[] => {
    const today = startOfToday()
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30)
    const cutoff = today.getTime() - 14 * MS_PER_DAY
    const actions: NextAction[] = []

    for (const uc of myUseCases) {
      if (uc.status === 'Blocked') {
        actions.push({ id: `blocked-${uc.use_case_id}`, accountId: uc.account_id, Icon: AlertTriangle, iconClassName: 'text-red-500', text: `Resolve blocker for ${uc.use_case_name} at ${uc.account_name}`, priority: 'high' })
      }
    }
    for (const acc of myAccounts) {
      if (acc.status === 'At Risk') {
        actions.push({ id: `risk-${acc.account_id}`, accountId: acc.account_id, Icon: AlertTriangle, iconClassName: 'text-amber-500', text: `Review health of ${acc.account_name}`, priority: 'medium' })
      }
    }
    for (const uc of myUseCases) {
      if (!uc.target_go_live_date) continue
      const target = parseLocalDate(uc.target_go_live_date)
      if (target.getTime() <= today.getTime() || target.getTime() > in30.getTime()) continue
      actions.push({ id: `golive-${uc.use_case_id}`, accountId: uc.account_id, Icon: CalendarClock, iconClassName: 'text-sky-600', text: `Prepare go-live checklist for ${uc.use_case_name}`, priority: 'medium' })
    }
    for (const call of allGongCalls) {
      if (!myAccountIds.has(call.account_id)) continue
      const callTime = new Date(call.call_date).getTime()
      if (callTime < cutoff || callTime > Date.now()) continue
      const accountName = accountById.get(call.account_id)?.account_name ?? call.account_id
      for (const item of call.action_items) {
        if (item.trimStart().startsWith('[DONE]')) continue
        actions.push({ id: `gong-${call.call_id}-${item.slice(0, 24)}`, accountId: call.account_id, Icon: Zap, iconClassName: 'text-violet-500', text: `Follow up: ${item} (${accountName})`, priority: 'low' })
      }
    }

    actions.sort((a, b) => { const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]; return pr !== 0 ? pr : a.text.localeCompare(b.text) })
    return actions.slice(0, 6)
  }, [myUseCases, myAccounts, myAccountIds, accountById, allGongCalls])

  const creditTooltipFormatter = (value: number | string): string => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(n) ? String(value) : `${(n / 1000).toFixed(0)}K`
  }

  return (
    <>
      <Header title={`Welcome back, ${currentUser.display_name.split(' ')[0]}`} subtitle="Here's how your accounts are looking today" />
      <div className="p-6">
        <div className="grid grid-cols-12 gap-4">
          <WidgetCard title="My Accounts" icon={<Building2 size={16} />} span={8}>
            {myAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No accounts assigned.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myAccounts.map((acc) => (
                  <Link key={acc.account_id} to={`/accounts/${acc.account_id}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center py-2 text-xs hover:bg-slate-50 -mx-2 px-2 rounded-md transition-colors">
                    <span className="font-semibold text-slate-800 truncate">{acc.account_name}</span>
                    <span><StatusBadge status={acc.engagement_status} variant="engagement" /></span>
                    <span><StatusBadge status={acc.status} /></span>
                    <span className="text-slate-600 text-right tabular-nums whitespace-nowrap">
                      {formatCreditsShort(acc.total_credits_allocated)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </WidgetCard>

          <WidgetCard title="At-Risk Alerts" icon={<AlertTriangle size={16} />} span={4}>
            {atRiskAlerts.length === 0 ? (
              <p className="text-xs text-emerald-600 font-medium text-center py-4">No alerts — all accounts on track</p>
            ) : (
              <ul className="space-y-2.5">
                {atRiskAlerts.map(({ useCase, account, dotClass }) => {
                  const note = latestPsNote(useCase.ps_notes)
                  return (
                    <li key={useCase.use_case_id} className="flex gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{useCase.use_case_name}</p>
                        <p className="text-xs text-slate-500 truncate">{account.account_name}</p>
                        <p className="text-xs text-slate-400 italic line-clamp-2">{note ? truncateText(note.content, 60) : 'No PS notes yet.'}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </WidgetCard>

          <WidgetCard title="Pipeline" icon={<BarChart3 size={16} />} span={4}>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={pipelineData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" width={88} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((entry, i) => <Cell key={entry.stage} fill={PIPELINE_BAR_FILLS[i % PIPELINE_BAR_FILLS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>

          <WidgetCard title="Credit Trends" icon={<TrendingUp size={16} />} span={8}>
            {creditChartData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Credit series loaded from account detail pages.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={creditChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatAxisDate} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                  <Tooltip formatter={creditTooltipFormatter} labelFormatter={(l) => String(l)} contentStyle={{ fontSize: 12 }} />
                  {accountNamesForLines.map((name, idx) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </WidgetCard>

          <WidgetCard title="Upcoming Go-Lives" icon={<CalendarClock size={16} />} span={6}>
            {upcomingGoLives.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No upcoming target dates.</p>
            ) : (
              <ul className="space-y-2.5">
                {upcomingGoLives.map((uc) => {
                  const target = parseLocalDate(uc.target_go_live_date!)
                  const days = daysBetween(startOfToday(), target)
                  const dayColor = days > 30 ? 'text-emerald-600' : days >= 15 ? 'text-amber-600' : 'text-red-600'
                  return (
                    <li key={uc.use_case_id} className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{uc.use_case_name}</p>
                        <p className="text-xs text-slate-500">{uc.account_name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-xs text-slate-600">{formatGoLiveLabel(uc.target_go_live_date!)}</span>
                        <span className={`text-xs font-medium tabular-nums ${dayColor}`}>{days} days</span>
                        <StatusBadge status={uc.stage} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </WidgetCard>

          <WidgetCard title="Next Best Actions" icon={<Zap size={16} />} span={6}>
            {nextBestActions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No actions right now.</p>
            ) : (
              <ul className="space-y-2">
                {nextBestActions.map(({ id, accountId: actAccountId, Icon: ActionIcon, iconClassName, text, priority }) => (
                  <li key={id} className="flex gap-2 items-start border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <ActionIcon size={16} className={`shrink-0 mt-0.5 ${iconClassName}`} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/accounts/${actAccountId}?tab=assistant&prompt=${encodeURIComponent(text)}`} className="text-sm text-slate-700 hover:text-snow-600 hover:underline">{text}</Link>
                      <span className={`inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityChipClass(priority)}`}>{priority}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </WidgetCard>
        </div>
      </div>
    </>
  )
}
