import { useState, useMemo, useCallback } from 'react'
import { BarChart3, Target, TrendingUp, Layers } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAccounts, useUseCases, useForecasts } from '../api/hooks'
import { ForecastTable } from '../components/forecasts/ForecastTable'
import { AdjustModal } from '../components/forecasts/AdjustModal'
import { PerformanceTiers } from '../components/forecasts/PerformanceTiers'
import { ForecastSummaryChart } from '../components/forecasts/ForecastSummaryChart'
import type { ForecastCategory, UseCase, UseCaseForecast } from '../types'
import { isAceOnAccount } from '../utils/aceScoping'

function effectiveCategory(f: UseCaseForecast): ForecastCategory {
  return f.override_category ?? f.auto_category
}

function getQuarters(): string[] {
  return ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026']
}

function currentQuarter(): string {
  return 'Q2-2026'
}

export function Forecasts() {
  const { currentUser } = useAuth()
  const isManager = currentUser.role === 'acem'

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: allUseCases = [], isLoading: useCasesLoading } = useUseCases()
  const { data: apiForecasts = [], isLoading: forecastsLoading } = useForecasts()

  const [quarter, setQuarter] = useState(currentQuarter)
  const [forecastOverrides, setForecastOverrides] = useState<Map<string, UseCaseForecast>>(new Map())

  const forecasts = useMemo(() => {
    return apiForecasts.map((f) => {
      const key = `${f.use_case_id}:${f.quarter}`
      return forecastOverrides.get(key) ?? f
    })
  }, [apiForecasts, forecastOverrides])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalForecast, setModalForecast] = useState<UseCaseForecast | null>(null)
  const [modalUseCase, setModalUseCase] = useState<UseCase | null>(null)

  const scopedAccounts = useMemo(() => {
    if (isManager) return accounts
    return accounts.filter((a) => isAceOnAccount(a, currentUser.user_id))
  }, [accounts, isManager, currentUser.user_id])

  const scopedAccountIds = useMemo(
    () => new Set(scopedAccounts.map((a) => a.account_id)),
    [scopedAccounts],
  )

  const scopedUseCases = useMemo(
    () => allUseCases.filter((uc) => scopedAccountIds.has(uc.account_id)),
    [allUseCases, scopedAccountIds],
  )

  const scopedForecasts = useMemo(
    () =>
      forecasts.filter(
        (f) => f.quarter === quarter && scopedAccountIds.has(f.account_id),
      ),
    [forecasts, quarter, scopedAccountIds],
  )

  const categories = useMemo(
    () => scopedForecasts.map((f) => effectiveCategory(f)),
    [scopedForecasts],
  )

  const commitCount = categories.filter((c) => c === 'Commit').length
  const mostLikelyCount = categories.filter((c) => c === 'Most Likely').length
  const stretchCount = categories.filter((c) => c === 'Stretch').length
  const totalCount = categories.length

  const handleAdjust = useCallback(
    (forecast: UseCaseForecast, useCase: UseCase) => {
      setModalForecast(forecast)
      setModalUseCase(useCase)
      setModalOpen(true)
    },
    [],
  )

  const handleSubmitAdjust = useCallback(
    (newCategory: ForecastCategory, note: string) => {
      if (!modalForecast) return
      const key = `${modalForecast.use_case_id}:${modalForecast.quarter}`
      const updated: UseCaseForecast = {
        ...modalForecast,
        override_category: newCategory,
        override_note: note,
        override_by: currentUser.user_id,
        override_at: new Date().toISOString(),
        pending_approval: currentUser.role === 'ace',
      }
      setForecastOverrides((prev) => new Map(prev).set(key, updated))
    },
    [modalForecast, currentUser],
  )

  const handleApprove = useCallback((forecast: UseCaseForecast) => {
    const key = `${forecast.use_case_id}:${forecast.quarter}`
    setForecastOverrides((prev) => new Map(prev).set(key, { ...forecast, pending_approval: false }))
  }, [])

  const handleReject = useCallback((forecast: UseCaseForecast) => {
    const key = `${forecast.use_case_id}:${forecast.quarter}`
    setForecastOverrides((prev) =>
      new Map(prev).set(key, {
        ...forecast,
        override_category: null,
        override_note: null,
        override_by: null,
        override_at: null,
        pending_approval: false,
      }),
    )
  }, [])

  const loading = accountsLoading || useCasesLoading || forecastsLoading

  const kpis = [
    {
      label: 'Commit',
      value: commitCount,
      Icon: Target,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Most Likely',
      value: mostLikelyCount,
      Icon: TrendingUp,
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Stretch',
      value: stretchCount,
      Icon: BarChart3,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Total Use Cases',
      value: totalCount,
      Icon: Layers,
      accent: 'text-slate-600',
      bg: 'bg-slate-50',
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-snow-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50/50 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Forecasts</h1>
        <select
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
        >
          {getQuarters().map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map(({ label, value, Icon, accent, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`rounded-lg p-1.5 ${bg}`}>
                <Icon size={16} className={accent} />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {label}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PerformanceTiers accounts={scopedAccounts} />
        </div>
        <div className="lg:col-span-5">
          <ForecastSummaryChart categories={categories} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Use Case Forecasts
        </h2>
        <ForecastTable
          useCases={scopedUseCases}
          forecasts={scopedForecasts}
          effectiveCategory={effectiveCategory}
          userRole={currentUser.role}
          onAdjust={handleAdjust}
          onApprove={handleApprove}
          onReject={handleReject}
          showAceColumn={isManager}
        />
      </div>

      {modalForecast && modalUseCase && (
        <AdjustModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          useCaseName={modalUseCase.use_case_name}
          accountName={modalUseCase.account_name}
          currentAutoCategory={modalForecast.auto_category}
          currentEffective={effectiveCategory(modalForecast)}
          userRole={currentUser.role}
          onSubmit={handleSubmitAdjust}
        />
      )}
    </div>
  )
}
