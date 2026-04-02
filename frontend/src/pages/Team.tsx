import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { MOCK_ACCOUNTS } from '../mocks/accounts'
import { MOCK_USE_CASES } from '../mocks/useCases'
import { ACE_DISPLAY_NAMES, ACE_EMAILS } from '../mocks/aceDisplayNames'
import { ArrowRight } from 'lucide-react'
import { isAceOnAccount } from '../utils/aceScoping'

export function Team() {
  const members = useMemo(() => {
    const aceIds = [...new Set(MOCK_ACCOUNTS.map((a) => a.ace_assigned))].sort()
    return aceIds.map((aceId) => {
      const name = ACE_DISPLAY_NAMES[aceId] ?? aceId
      const email = ACE_EMAILS[aceId] ?? ''
      const accounts = MOCK_ACCOUNTS.filter((a) => isAceOnAccount(a, aceId))
      const accountIds = new Set(accounts.map((a) => a.account_id))
      const useCases = MOCK_USE_CASES.filter((uc) => accountIds.has(uc.account_id))
      const blockedCount = useCases.filter((uc) => uc.status === 'Blocked').length
      const atRiskCount = accounts.filter((a) => a.status === 'At Risk').length
      const deployedCount = useCases.filter((uc) => uc.stage === 'Deployed').length
      const totalAcv = accounts.reduce((sum, a) => sum + a.acv, 0)

      return {
        aceId,
        name,
        email,
        accountCount: accounts.length,
        useCaseCount: useCases.length,
        blockedCount,
        atRiskCount,
        deployedCount,
        totalAcv,
      }
    })
  }, [])

  function formatCurrency(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
    return `$${n}`
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Team" subtitle={`${members.length} team members`} />
      <div className="p-6">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <Link
              key={m.aceId}
              to={`/team/${m.aceId}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-snow-100 text-sm font-bold text-snow-700">
                  {m.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-snow-600">
                    {m.name}
                  </p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Accounts</p>
                  <p className="text-lg font-bold text-slate-800">{m.accountCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Use Cases</p>
                  <p className="text-lg font-bold text-slate-800">{m.useCaseCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Deployed</p>
                  <p className="text-lg font-bold text-emerald-600">{m.deployedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total ACV</p>
                  <p className="text-lg font-bold text-slate-800">
                    {formatCurrency(m.totalAcv)}
                  </p>
                </div>
              </div>

              {(m.atRiskCount > 0 || m.blockedCount > 0) && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {m.atRiskCount > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                      {m.atRiskCount} at risk
                    </span>
                  )}
                  {m.blockedCount > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      {m.blockedCount} blocked
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 text-xs font-medium text-snow-600 group-hover:text-snow-700">
                View Profile <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
