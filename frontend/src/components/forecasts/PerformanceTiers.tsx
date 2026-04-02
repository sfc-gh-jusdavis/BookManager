import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Account, PerformanceTier } from '../../types'
import { MOCK_CREDIT_SERIES } from '../../mocks/credits'

interface PerformanceTiersProps {
  accounts: Account[]
}

interface AccountConsumptionChange {
  wow: number | null
  mom: number | null
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function formatChange(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function changeColorClass(value: number | null): string {
  if (value === null) return 'text-slate-400'
  if (value > 0) return 'text-emerald-600'
  if (value < 0) return 'text-red-500'
  return 'text-slate-400'
}

function burnRate(acc: Account): number {
  return acc.acv > 0 ? acc.consumption_ytd / acc.acv : 0
}

function getTier(rate: number): PerformanceTier {
  if (rate > 0.75) return 'Overperforming'
  if (rate >= 0.25) return 'On Track'
  return 'At Risk'
}

function formatCurrency(n: number): string {
  const negative = n < 0
  const v = Math.abs(n)
  let body: string
  if (v >= 1_000_000) {
    const millions = v / 1_000_000
    const rounded =
      millions >= 10
        ? String(Math.round(millions))
        : String(Math.round(millions * 10) / 10).replace(/\.0$/, '')
    body = `${rounded}M`
  } else if (v >= 1_000) {
    body = `${Math.round(v / 1_000)}K`
  } else {
    body = `${Math.round(v)}`
  }
  return `${negative ? '-' : ''}$${body}`
}

function pctLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

const tierBarClass: Record<PerformanceTier, string> = {
  Overperforming: 'bg-emerald-400',
  'On Track': 'bg-blue-400',
  'At Risk': 'bg-amber-400',
}

const tierConfigs: {
  tier: PerformanceTier
  label: string
  headerBg: string
  headerText: string
  icon: LucideIcon
}[] = [
  {
    tier: 'Overperforming',
    label: 'Overperforming',
    headerBg: 'bg-emerald-50',
    headerText: 'text-emerald-800',
    icon: TrendingUp,
  },
  {
    tier: 'On Track',
    label: 'On Track',
    headerBg: 'bg-blue-50',
    headerText: 'text-blue-800',
    icon: Minus,
  },
  {
    tier: 'At Risk',
    label: 'At Risk',
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-800',
    icon: TrendingDown,
  },
]

export function PerformanceTiers({ accounts }: PerformanceTiersProps) {
  const consumptionByAccount = useMemo(() => {
    const map = new Map<string, AccountConsumptionChange>()
    const accountIds = new Set(accounts.map((a) => a.account_id))

    for (const accountId of accountIds) {
      const entries = MOCK_CREDIT_SERIES.filter((e) => e.account_id === accountId)
      const byDate = new Map<string, number>()
      for (const e of entries) {
        byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.credits_used)
      }

      const dates = [...byDate.keys()].sort()
      const daily = dates.map((d) => byDate.get(d) ?? 0)
      const len = daily.length

      const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0)
      const last7 = daily.slice(Math.max(0, len - 7))
      const prev7 = daily.slice(Math.max(0, len - 14), Math.max(0, len - 7))
      const last30 = daily.slice(Math.max(0, len - 30))
      const prev30 = daily.slice(Math.max(0, len - 60), Math.max(0, len - 30))

      map.set(accountId, {
        wow: changePct(sum(last7), sum(prev7)),
        mom: changePct(sum(last30), sum(prev30)),
      })
    }
    return map
  }, [accounts])

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 shadow-sm">
        No accounts to display.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Account Performance Tiers
      </h2>
      {tierConfigs.map(({ tier, label, headerBg, headerText, icon: Icon }) => {
        const tierAccounts = accounts.filter((acc) => getTier(burnRate(acc)) === tier)
        if (tierAccounts.length === 0) return null

        return (
          <div key={tier}>
            <div
              className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 ${headerBg} ${headerText}`}
            >
              <Icon size={14} aria-hidden />
              <span className="text-xs font-semibold">{label}</span>
              <span className="rounded-full bg-white/50 px-1.5 text-xs">{tierAccounts.length}</span>
            </div>
            <ul className="mb-4 space-y-2">
              {tierAccounts.map((acc) => {
                const rate = burnRate(acc)
                const pct = pctLabel(rate)
                const width = `${Math.min(100, Math.round(rate * 100))}%`
                const changes = consumptionByAccount.get(acc.account_id)
                const wow = changes?.wow ?? null
                const mom = changes?.mom ?? null

                return (
                  <li key={acc.account_id}>
                    <Link to={`/accounts/${acc.account_id}`} className="block">
                      <div className="text-sm font-medium text-slate-700 hover:text-snow-600">
                        {acc.account_name}
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${tierBarClass[tier]}`}
                          style={{ width }}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
                        <span>{pct} burn rate</span>
                        <span>·</span>
                        <span>ACV {formatCurrency(acc.acv)}</span>
                        <span>·</span>
                        <span className={changeColorClass(wow)}>
                          WoW {formatChange(wow)}
                        </span>
                        <span>·</span>
                        <span className={changeColorClass(mom)}>
                          MoM {formatChange(mom)}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
