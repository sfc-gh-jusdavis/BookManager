import type { UseCase, ForecastCategory, UseCaseForecast } from '../types'
import { MOCK_USE_CASES } from './useCases'

export function autoClassify(uc: UseCase): ForecastCategory {
  if (uc.status.toLowerCase() === 'blocked') return 'Stretch'
  const s = uc.stage
  if (s === 'Go-Live' || s === 'Deployed') return 'Commit'
  if (s === 'Technical Win' || s === 'Use Case Won') return 'Stretch'
  return 'Most Likely'
}

function deriveQuarter(uc: UseCase): string {
  const dateStr = uc.go_live_date ?? uc.target_go_live_date
  if (!dateStr) return 'Q2-2026'
  const month = parseInt(dateStr.split('-')[1] ?? '4', 10)
  const year = dateStr.split('-')[0] ?? '2026'
  if (month <= 3) return `Q1-${year}`
  if (month <= 6) return `Q2-${year}`
  if (month <= 9) return `Q3-${year}`
  return `Q4-${year}`
}

function buildForecasts(): UseCaseForecast[] {
  const forecasts: UseCaseForecast[] = MOCK_USE_CASES.map((uc) => ({
    use_case_id: uc.use_case_id,
    account_id: uc.account_id,
    auto_category: autoClassify(uc),
    override_category: null,
    override_note: null,
    override_by: null,
    override_at: null,
    pending_approval: false,
    quarter: deriveQuarter(uc),
  }))

  const retUc = forecasts.find((f) => f.use_case_id === 'uc-jane-ret-002')
  if (retUc) {
    retUc.override_category = 'Stretch'
    retUc.override_note =
      'Stakeholder churn in merchandising team has paused technical work. Unlikely to close this quarter.'
    retUc.override_by = 'ace-jane'
    retUc.override_at = '2026-03-25T10:00:00'
    retUc.pending_approval = true
  }

  const insUc = forecasts.find((f) => f.use_case_id === 'uc-carlos-ins-001')
  if (insUc) {
    insUc.override_category = 'Most Likely'
    insUc.override_note =
      'Governance board meeting scheduled for 4/8. Expect approval — vendor latency workaround in place.'
    insUc.override_by = 'ace-carlos'
    insUc.override_at = '2026-03-22T14:00:00'
    insUc.pending_approval = true
  }

  const techUc = forecasts.find((f) => f.use_case_id === 'uc-jane-tech-002')
  if (techUc) {
    techUc.override_category = 'Commit'
    techUc.override_note = 'Canary on 5% traffic with excellent latency. Full rollout mid-April.'
    techUc.override_by = 'acem-mark'
    techUc.override_at = '2026-03-30T11:00:00'
    techUc.pending_approval = false
  }

  return forecasts
}

export const MOCK_FORECASTS: UseCaseForecast[] = buildForecasts()

export function effectiveCategory(f: UseCaseForecast): ForecastCategory {
  return f.override_category ?? f.auto_category
}

export function getQuarters(): string[] {
  return ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026']
}

export function currentQuarter(): string {
  return 'Q2-2026'
}
