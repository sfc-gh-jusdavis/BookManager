import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts'
import { Header } from '../components/layout/Header'
import { useAccounts, useUseCases, useForecasts, useAceDisplayNames } from '../api/hooks'
import { isAceOnAccount } from '../utils/aceScoping'
import {
  Building2, CheckCircle2, AlertTriangle, CalendarCheck,
  BarChart3, Users, TrendingUp, ShieldAlert, GitPullRequestArrow,
} from 'lucide-react'

const PIPELINE_STAGES = [
  'Discovery', 'Scoping', 'Technical Win', 'Use Case Won',
  'Impl Pending', 'Impl In Progress', 'Go-Live', 'Deployed',
] as const

type PipelineStage = (typeof PIPELINE_STAGES)[number]
const TODAY_ISO = '2026-03-30'

function parseTargetGoLiveMonthYear(dateStr: string): { year: number; month: number } | null {
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null
  return { year: parts[0] ?? 0, month: parts[1] ?? 0 }
}

function accountStatusDotClass(status: string): string {
  if (status === 'Active' || status === 'Go Live') return 'bg-emerald-500'
  if (status === 'At Risk') return 'bg-amber-500'
  if (status === 'Onboarding') return 'bg-sky-500'
  return 'bg-slate-300'
}

function formatAxisDateK(value: number): string {
  const k = value / 1000
  if (Math.abs(k) >= 100) return `${Math.round(k)}K`
  return `${k.toFixed(1)}K`
}

function formatChartDateMd(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number); return `${m}/${d}`
}

type ManagerAlertKind = 'blocked' | 'overdue' | 'at-risk'
interface ManagerAlert { id: string; kind: ManagerAlertKind; message: string; accountName: string; accountId: string }

function effectiveCategory(f: { auto_category: string; override_category: string | null }): string {
  return f.override_category ?? f.auto_category
}

function KPICard({ label, value, icon, color }: { label: string; value: string | number; icon: ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm col-span-3 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg ${color}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  )
}

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

export function ACEMDashboard() {
  const { data: allAccounts = [] } = useAccounts()
  const { data: allUseCases = [] } = useUseCases()
  const { data: apiForecasts = [] } = useForecasts()
  const { data: aceDisplayNames = {} } = useAceDisplayNames()

  const kpis = useMemo(() => {
    const totalAccounts = allAccounts.length
    const onTrackCount = allAccounts.filter((a) => a.status === 'Active' || a.status === 'Go Live').length
    const onTrackPct = totalAccounts > 0 ? Math.round((onTrackCount / totalAccounts) * 100) : 0
    const atRiskAccounts = allAccounts.filter((a) => a.status === 'At Risk').length
    const goLivesMarch2026 = allUseCases.filter((uc) => {
      if (!uc.target_go_live_date) return false
      const parsed = parseTargetGoLiveMonthYear(uc.target_go_live_date)
      return parsed !== null && parsed.year === 2026 && parsed.month === 3
    }).length
    return { totalAccounts, onTrackPct, atRiskAccounts, goLivesMarch2026 }
  }, [allAccounts, allUseCases])

  const pipelineChartData = useMemo(() => {
    const counts = new Map<PipelineStage, number>()
    for (const s of PIPELINE_STAGES) counts.set(s, 0)
    for (const uc of allUseCases) {
      const stage = uc.stage as PipelineStage
      if (counts.has(stage)) counts.set(stage, (counts.get(stage) ?? 0) + 1)
    }
    return PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
  }, [allUseCases])

  const aceIds = useMemo(() => [...new Set(allAccounts.map((a) => a.ace_assigned))].sort(), [allAccounts])

  const teamMemberCards = useMemo(() => {
    return aceIds.map((aceId) => {
      const name = aceDisplayNames[aceId] ?? aceId
      const accounts = allAccounts.filter((a) => isAceOnAccount(a, aceId))
      const accountIds = new Set(accounts.map((a) => a.account_id))
      const useCases = allUseCases.filter((uc) => accountIds.has(uc.account_id))
      const blockedCount = useCases.filter((uc) => uc.status === 'Blocked').length
      const atRiskAccountCount = accounts.filter((a) => a.status === 'At Risk').length
      const deployedCount = useCases.filter((uc) => uc.stage === 'Deployed').length
      const inProgressCount = useCases.filter((uc) => uc.stage === 'Impl In Progress' || uc.stage === 'Impl Pending').length
      const goLiveThisQ = useCases.filter((uc) => { const d = uc.target_go_live_date; return d !== null && d >= '2026-04-01' && d <= '2026-06-30' }).length
      return { aceId, name, accountCount: accounts.length, useCaseCount: useCases.length, atRiskCount: blockedCount + atRiskAccountCount, deployedCount, inProgressCount, goLiveThisQ, blockedCount, accounts }
    })
  }, [aceIds, allAccounts, allUseCases, aceDisplayNames])

  const creditTrendData = useMemo(() => {
    const end = new Date(`${TODAY_ISO}T00:00:00.000Z`)
    const dateStrings: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86_400_000)
      dateStrings.push(d.toISOString().slice(0, 10))
    }
    const aceNames = aceIds.map((id) => aceDisplayNames[id] ?? id)
    return dateStrings.map((dateStr) => {
      const row: Record<string, string | number> = { date: dateStr }
      for (const name of aceNames) row[name] = 0
      return row
    })
  }, [aceIds, aceDisplayNames])

  const pendingAdjustments = useMemo(() => {
    return apiForecasts
      .filter((f) => f.pending_approval)
      .map((f) => {
        const uc = allUseCases.find((u) => u.use_case_id === f.use_case_id)
        const submitterName = aceDisplayNames[f.override_by ?? ''] ?? f.override_by ?? 'Unknown'
        return { ...f, useCaseName: uc?.use_case_name ?? f.use_case_id, accountName: uc?.account_name ?? f.account_id, submitterName, fromCategory: f.auto_category, toCategory: effectiveCategory(f) }
      })
  }, [apiForecasts, allUseCases, aceDisplayNames])

  const managerAlerts = useMemo((): ManagerAlert[] => {
    const blockedMap = new Map<string, { accountName: string; count: number }>()
    for (const uc of allUseCases) {
      if (uc.status !== 'Blocked') continue
      const cur = blockedMap.get(uc.account_id) ?? { accountName: uc.account_name, count: 0 }
      cur.count += 1; blockedMap.set(uc.account_id, cur)
    }
    const blockedAlerts: ManagerAlert[] = [...blockedMap.entries()].map(([accId, v]) => ({
      id: `blocked-${accId}`, kind: 'blocked' as const,
      message: `${v.accountName} has ${v.count} blocked use case${v.count === 1 ? '' : 's'}`,
      accountName: v.accountName, accountId: accId,
    }))
    const overdueAlerts: ManagerAlert[] = allUseCases
      .filter((uc) => uc.target_go_live_date !== null && uc.target_go_live_date < TODAY_ISO)
      .map((uc) => ({ id: `overdue-${uc.use_case_id}`, kind: 'overdue' as const, message: `${uc.use_case_name} at ${uc.account_name} is past target go-live`, accountName: uc.account_name, accountId: uc.account_id }))
    const atRiskAlerts: ManagerAlert[] = allAccounts
      .filter((a) => a.status === 'At Risk')
      .map((a) => ({ id: `atrisk-${a.account_id}`, kind: 'at-risk' as const, message: `${a.account_name} marked as At Risk`, accountName: a.account_name, accountId: a.account_id }))
    return [...blockedAlerts, ...overdueAlerts, ...atRiskAlerts]
  }, [allUseCases, allAccounts])

  return (
    <>
      <Header title="Team Overview" subtitle="Account health across your team" />
      <div className="p-6">
        <div className="grid grid-cols-12 gap-4">
          <KPICard label="Total Accounts" value={kpis.totalAccounts} icon={<Building2 size={18} />} color="bg-snow-50 text-snow-600" />
          <KPICard label="On Track" value={`${kpis.onTrackPct}%`} icon={<CheckCircle2 size={18} />} color="bg-emerald-50 text-emerald-600" />
          <KPICard label="At Risk" value={kpis.atRiskAccounts} icon={<AlertTriangle size={18} />} color="bg-amber-50 text-amber-600" />
          <KPICard label="Go-Lives This Month" value={kpis.goLivesMarch2026} icon={<CalendarCheck size={18} />} color="bg-violet-50 text-violet-600" />

          <WidgetCard title="Team Pipeline" icon={<BarChart3 size={16} />} span={5}>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={pipelineChartData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#29B5E8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>

          <WidgetCard title="Team Members" icon={<Users size={16} />} span={7}>
            <div className="flex flex-col gap-3">
              {teamMemberCards.map((member) => (
                <Link key={member.aceId} to={`/team/${member.aceId}`}
                  className="group rounded-lg border border-slate-200 p-4 flex flex-col gap-3 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-snow-600">{member.name}</p>
                    <span className="text-xs text-snow-600 opacity-0 group-hover:opacity-100 transition-opacity">View Profile →</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-xs text-slate-500">Accounts</span><p className="font-semibold text-slate-800">{member.accountCount}</p></div>
                    <div><span className="text-xs text-slate-500">Use Cases</span><p className="font-semibold text-slate-800">{member.useCaseCount}</p></div>
                    <div><span className="text-xs text-slate-500">Deployed</span><p className="font-semibold text-emerald-600">{member.deployedCount}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-500">{member.inProgressCount} in progress</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">{member.goLiveThisQ} go-live this Q</span>
                    {member.blockedCount > 0 && <><span className="text-slate-300">·</span><span className="text-red-600">{member.blockedCount} blocked</span></>}
                    {member.atRiskCount > 0 && <><span className="text-slate-300">·</span><span className="text-amber-600">{member.atRiskCount} at risk</span></>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {member.accounts.map((acc) => (
                      <span key={acc.account_id} title={`${acc.account_name}: ${acc.status}`} className={`h-2.5 w-2.5 rounded-full shrink-0 ${accountStatusDotClass(acc.status)}`} />
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </WidgetCard>

          <WidgetCard title="Credit Trends" icon={<TrendingUp size={16} />} span={8}>
            {creditTrendData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No credit data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={creditTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={formatChartDateMd} />
                  <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={formatAxisDateK} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(value: number | string, name: string) => [formatAxisDateK(Number(value)), name]} />
                  {aceIds.map((aceId, i) => {
                    const name = aceDisplayNames[aceId] ?? aceId
                    const colors = ['#29B5E8', '#8B5CF6', '#F59E0B', '#10B981']
                    return <Area key={aceId} type="monotone" dataKey={name} stackId="credits" stroke={colors[i % colors.length]} fill={colors[i % colors.length]} />
                  })}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </WidgetCard>

          <WidgetCard title="Manager Alerts" icon={<ShieldAlert size={16} />} span={4}>
            <ul className="flex flex-col gap-3">
              {managerAlerts.length === 0 ? (
                <li className="text-sm text-slate-400">No active alerts.</li>
              ) : (
                managerAlerts.map((alert) => (
                  <li key={alert.id} className="flex gap-2 items-start">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${alert.kind === 'blocked' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/accounts/${alert.accountId}?tab=assistant&prompt=${encodeURIComponent(alert.message)}`} className="text-sm text-slate-800 hover:text-snow-600 hover:underline">{alert.message}</Link>
                      <p className="text-xs text-slate-500 mt-0.5">{alert.accountName}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </WidgetCard>

          <WidgetCard title="Forecast Adjustments" icon={<GitPullRequestArrow size={16} />} span={6}>
            {pendingAdjustments.length === 0 ? (
              <p className="text-sm text-slate-400">No pending adjustments.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-amber-600">{pendingAdjustments.length}</span>
                  {' '}pending adjustment{pendingAdjustments.length === 1 ? '' : 's'}
                </p>
                <ul className="space-y-3">
                  {pendingAdjustments.map((adj) => (
                    <li key={adj.use_case_id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700">{adj.useCaseName}</p>
                          <p className="text-xs text-slate-500">{adj.accountName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            <span className="text-slate-400">by</span> {adj.submitterName}
                            {' · '}
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">{adj.fromCategory}</span>
                            {' → '}
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${adj.toCategory === 'Commit' ? 'bg-emerald-50 text-emerald-700' : adj.toCategory === 'Most Likely' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{adj.toCategory}</span>
                          </p>
                          {adj.override_note && <p className="mt-1 text-xs text-slate-500 line-clamp-2 italic">&ldquo;{adj.override_note}&rdquo;</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Link to="/forecasts" className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Review</Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </WidgetCard>
        </div>
      </div>
    </>
  )
}
