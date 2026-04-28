import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  ArrowLeft, Building2, Layers, CheckCircle2, DollarSign,
  TrendingUp, ChevronDown, ChevronRight, Rocket, CalendarCheck, Clock,
} from 'lucide-react'
import { useAccounts, useUseCases, useForecasts, useAceDisplayNames } from '../api/hooks'
import { StatusBadge } from '../components/accounts/StatusBadge'
import { ForecastSummaryChart } from '../components/forecasts/ForecastSummaryChart'
import type { UseCase, ForecastCategory } from '../types'
import { isAceOnAccount } from '../utils/aceScoping'

const PIPELINE_STAGES = [
  'Discovery', 'Scoping', 'Technical Win', 'Use Case Won',
  'Impl Pending', 'Impl In Progress', 'Go-Live', 'Deployed',
] as const

function formatCurrency(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return m >= 10 ? `$${Math.round(m)}M` : `$${m.toFixed(1).replace(/\.0$/, '')}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function formatCreditsK(v: number): string {
  const k = v / 1000
  return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(0)}K`
}

function formatDateMd(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}/${d}`
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function categoryBadgeClass(cat: string): string {
  switch (cat) {
    case 'Commit': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'Most Likely': return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'Stretch': return 'bg-amber-50 text-amber-700 border border-amber-200'
    default: return 'bg-slate-50 text-slate-600 border border-slate-200'
  }
}

function effectiveCategory(f: { auto_category: string; override_category: string | null }): string {
  return f.override_category ?? f.auto_category
}

export function TeamMemberProfile() {
  const { aceId } = useParams<{ aceId: string }>()

  const { data: allAccounts = [] } = useAccounts()
  const { data: allUseCases = [] } = useUseCases()
  const { data: apiForecasts = [] } = useForecasts()
  const { data: aceDisplayNames = {} } = useAceDisplayNames()

  const name = aceDisplayNames[aceId ?? ''] ?? aceId ?? 'Unknown'
  const initials = name.split(' ').map((n: string) => n[0]).join('')

  const accounts = useMemo(
    () => allAccounts.filter((a) => isAceOnAccount(a, aceId ?? '')).sort((a, b) => a.account_name.localeCompare(b.account_name)),
    [allAccounts, aceId],
  )

  const accountIds = useMemo(() => new Set(accounts.map((a) => a.account_id)), [accounts])

  const useCases = useMemo(
    () => allUseCases.filter((uc) => accountIds.has(uc.account_id)),
    [allUseCases, accountIds],
  )

  const useCasesByAccount = useMemo(() => {
    const map: Record<string, UseCase[]> = {}
    for (const uc of useCases) {
      if (!map[uc.account_id]) map[uc.account_id] = []
      map[uc.account_id]!.push(uc)
    }
    return map
  }, [useCases])

  const forecasts = useMemo(
    () => apiForecasts.filter((f) => accountIds.has(f.account_id)),
    [apiForecasts, accountIds],
  )

  const forecastCategories = useMemo(
    () => forecasts.map((f) => effectiveCategory(f) as ForecastCategory),
    [forecasts],
  )

  const totalAcv = accounts.reduce((s, a) => s + (a.acv ?? 0), 0)
  const totalConsumptionYtd = accounts.reduce((s, a) => s + (a.consumption_ytd ?? 0), 0)
  const avgBurnRate = totalAcv > 0 ? totalConsumptionYtd / totalAcv : 0
  const deployedCount = useCases.filter((uc) => uc.stage === 'Deployed').length

  const ytdCompleted = useCases.filter((uc) => uc.go_live_date && uc.go_live_date.startsWith('2026')).length
  const ytdStarted = useCases.filter((uc) => uc.created_date.startsWith('2026')).length

  const t12mCompleted = useCases.filter((uc) => {
    if (!uc.go_live_date) return false
    return uc.go_live_date >= '2025-04-01' && uc.go_live_date <= '2026-03-31'
  }).length
  const t12mStarted = useCases.filter(
    (uc) => uc.created_date >= '2025-04-01' && uc.created_date <= '2026-03-31',
  ).length

  const pipelineData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of PIPELINE_STAGES) counts.set(s, 0)
    for (const uc of useCases) {
      if (counts.has(uc.stage)) counts.set(uc.stage, (counts.get(uc.stage) ?? 0) + 1)
    }
    return PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
  }, [useCases])

  const creditTrendData = useMemo(() => {
    const end = new Date('2026-03-30T00:00:00.000Z')
    const dateStrings: string[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86_400_000)
      dateStrings.push(d.toISOString().slice(0, 10))
    }
    return dateStrings.map((dateStr) => ({ date: dateStr, credits: 0 }))
  }, [])

  const goLiveCallouts = useMemo(() => {
    const upcoming = useCases
      .filter((uc) => !uc.go_live_date && uc.target_go_live_date)
      .sort((a, b) => (a.target_go_live_date ?? '').localeCompare(b.target_go_live_date ?? ''))
    const recent = useCases
      .filter((uc) => uc.go_live_date)
      .sort((a, b) => (b.go_live_date ?? '').localeCompare(a.go_live_date ?? ''))
    return { upcoming, recent }
  }, [useCases])

  const quarterlyDistribution = useMemo(() => {
    const quarters = ['Q3-2025', 'Q4-2025', 'Q1-2026', 'Q2-2026']
    function dateToQuarter(d: string): string | null {
      const month = parseInt(d.split('-')[1] ?? '0', 10)
      const year = d.split('-')[0] ?? ''
      if (month <= 3) return `Q1-${year}`
      if (month <= 6) return `Q2-${year}`
      if (month <= 9) return `Q3-${year}`
      return `Q4-${year}`
    }
    return quarters.map((q) => {
      const completed = useCases.filter((uc) => { if (!uc.go_live_date) return false; return dateToQuarter(uc.go_live_date) === q }).length
      const planned = useCases.filter((uc) => { if (uc.go_live_date) return false; if (!uc.target_go_live_date) return false; return dateToQuarter(uc.target_go_live_date) === q }).length
      return { quarter: q, Completed: completed, Planned: planned }
    })
  }, [useCases])

  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(() => new Set(accounts.map((a) => a.account_id)))

  function toggleAccount(accId: string) {
    setExpandedAccounts((prev) => { const next = new Set(prev); if (next.has(accId)) next.delete(accId); else next.add(accId); return next })
  }

  if (!aceId || (Object.keys(aceDisplayNames).length > 0 && !aceDisplayNames[aceId])) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Team member not found</p>
          <Link to="/team" className="mt-2 inline-block text-sm text-snow-600 hover:underline">Back to Team</Link>
        </div>
      </div>
    )
  }

  const forecastByUseCase = new Map(forecasts.map((f) => [f.use_case_id, f]))

  return (
    <div className="min-h-full bg-slate-50/50 px-6 py-6">
      <div className="mb-6">
        <Link to="/team" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-snow-600">
          <ArrowLeft size={14} /> Back to Team
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-snow-100 text-lg font-bold text-snow-700">{initials}</div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
            <p className="text-sm text-slate-500">{aceId}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: 'Accounts', value: accounts.length, Icon: Building2, accent: 'text-snow-600', bg: 'bg-snow-50' },
          { label: 'Use Cases', value: useCases.length, Icon: Layers, accent: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Deployed', value: deployedCount, Icon: CheckCircle2, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total ACV', value: formatCurrency(totalAcv), Icon: DollarSign, accent: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Avg Burn Rate', value: pctLabel(avgBurnRate), Icon: TrendingUp, accent: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, Icon, accent, bg }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <div className={`rounded-lg p-1.5 ${bg}`}><Icon size={16} className={accent} /></div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">YTD Performance (2026)</h2>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-slate-500">Completed</p><p className="text-xl font-bold text-emerald-600">{ytdCompleted}</p></div>
              <div><p className="text-xs text-slate-500">Started</p><p className="text-xl font-bold text-slate-800">{ytdStarted}</p></div>
              <div><p className="text-xs text-slate-500">Consumption YTD</p><p className="text-xl font-bold text-slate-800">{formatCurrency(totalConsumptionYtd)}</p></div>
              <div><p className="text-xs text-slate-500">Burn Rate</p><p className="text-xl font-bold text-slate-800">{pctLabel(avgBurnRate)}</p></div>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={pipelineData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 10 }} stroke="#64748b" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#29B5E8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Trailing 12-Month Performance</h2>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-slate-500">Completed (T12M)</p><p className="text-xl font-bold text-emerald-600">{t12mCompleted}</p></div>
              <div><p className="text-xs text-slate-500">Started (T12M)</p><p className="text-xl font-bold text-slate-800">{t12mStarted}</p></div>
              <div><p className="text-xs text-slate-500">Total ACV</p><p className="text-xl font-bold text-slate-800">{formatCurrency(totalAcv)}</p></div>
              <div><p className="text-xs text-slate-500">Active Accounts</p><p className="text-xl font-bold text-slate-800">{accounts.filter((a) => a.engagement_status === 'Active').length}</p></div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={creditTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={formatDateMd} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={formatCreditsK} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(value: number | string) => [formatCreditsK(Number(value)), 'Credits']}
                    labelFormatter={(l) => formatDateMd(String(l))} />
                  <Area type="monotone" dataKey="credits" stroke="#29B5E8" fill="#29B5E8" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Accounts & Use Cases</h2>
            <div className="space-y-3">
              {accounts.map((acc) => {
                const expanded = expandedAccounts.has(acc.account_id)
                const accUseCases = useCasesByAccount[acc.account_id] ?? []
                const burnRate = acc.acv > 0 ? acc.consumption_ytd / acc.acv : 0
                return (
                  <div key={acc.account_id} className="rounded-lg border border-slate-200">
                    <button type="button" onClick={() => toggleAccount(acc.account_id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      {expanded ? <ChevronDown size={14} className="shrink-0 text-slate-400" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/accounts/${acc.account_id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-slate-700 hover:text-snow-600">{acc.account_name}</Link>
                          <StatusBadge status={acc.status} />
                          <StatusBadge status={acc.engagement_status} variant="engagement" />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">ACV {formatCurrency(acc.acv)} · {pctLabel(burnRate)} burn rate · {accUseCases.length} use case{accUseCases.length === 1 ? '' : 's'}</p>
                      </div>
                    </button>
                    {expanded && accUseCases.length > 0 && (
                      <div className="border-t border-slate-100 px-4 pb-3 pt-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wider text-slate-400">
                              <th className="pb-2 text-left font-medium">Use Case</th>
                              <th className="pb-2 text-left font-medium">Stage</th>
                              <th className="pb-2 text-left font-medium">Forecast</th>
                              <th className="pb-2 text-left font-medium">Target Go-Live</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {accUseCases.map((uc) => {
                              const fc = forecastByUseCase.get(uc.use_case_id)
                              const cat = fc ? effectiveCategory(fc) : null
                              return (
                                <tr key={uc.use_case_id}>
                                  <td className="py-2 pr-3 text-slate-700">{uc.use_case_name}</td>
                                  <td className="py-2 pr-3"><StatusBadge status={uc.stage} /></td>
                                  <td className="py-2 pr-3">
                                    {cat ? (
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(cat)}`}>{cat}</span>
                                    ) : (
                                      <span className="text-xs text-slate-400">--</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-xs text-slate-500">{uc.target_go_live_date ?? '--'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Rocket size={14} className="text-violet-500" /> Use Case Go-Lives
            </h3>
            {goLiveCallouts.upcoming.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600"><Clock size={12} className="text-amber-500" /> Upcoming</p>
                <ul className="space-y-2">
                  {goLiveCallouts.upcoming.slice(0, 5).map((uc) => (
                    <li key={uc.use_case_id} className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                      <Link to={`/accounts/${uc.account_id}`} className="text-sm font-medium text-slate-700 hover:text-snow-600">{uc.use_case_name}</Link>
                      <p className="mt-0.5 text-xs text-slate-500">{uc.account_name} · Target {uc.target_go_live_date}</p>
                    </li>
                  ))}
                </ul>
                {goLiveCallouts.upcoming.length > 5 && <p className="mt-2 text-xs text-slate-400">+{goLiveCallouts.upcoming.length - 5} more</p>}
              </div>
            )}
            {goLiveCallouts.recent.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600"><CalendarCheck size={12} className="text-emerald-500" /> Recently Completed</p>
                <ul className="space-y-2">
                  {goLiveCallouts.recent.map((uc) => (
                    <li key={uc.use_case_id} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                      <Link to={`/accounts/${uc.account_id}`} className="text-sm font-medium text-slate-700 hover:text-snow-600">{uc.use_case_name}</Link>
                      <p className="mt-0.5 text-xs text-slate-500">{uc.account_name} · Live {uc.go_live_date}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {goLiveCallouts.upcoming.length === 0 && goLiveCallouts.recent.length === 0 && (
              <p className="text-sm text-slate-400">No go-live activity.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quarterly Use Case Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={quarterlyDistribution} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="Completed" stackId="uc" fill="#10b981" />
                <Bar dataKey="Planned" stackId="uc" fill="#29B5E8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Completed</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#29B5E8]" /> Planned</span>
            </div>
          </div>

          <ForecastSummaryChart categories={forecastCategories} />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">90-Day Credit Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={creditTrendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" tickFormatter={formatDateMd} />
                <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" tickFormatter={formatCreditsK} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(value: number | string) => [formatCreditsK(Number(value)), 'Credits']}
                  labelFormatter={(l) => formatDateMd(String(l))} />
                <Area type="monotone" dataKey="credits" stroke="#29B5E8" fill="#29B5E8" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
