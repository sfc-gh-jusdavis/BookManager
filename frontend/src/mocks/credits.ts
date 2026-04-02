export interface CreditDailyEntry {
  account_id: string
  date: string
  credits_used: number
  credits_allocated: number
}

export type AccountCreditStatus =
  | 'active'
  | 'onboarding'
  | 'at_risk'
  | 'go_live'

export interface AccountCreditConfig {
  id: string
  allocated: number
  /** Target usage % range over the series (min, max) */
  pctMin: number
  pctMax: number
  /** How strongly usage trends upward over the window (0 = flat trend) */
  growthRate: number
  /** Amplitude of day-to-day variation (0–1 scale) */
  volatility: number
  status: AccountCreditStatus
}

const DAY_COUNT = 89
const START_UTC = Date.UTC(2026, 0, 1)

/** Deterministic [0, 1) from account + day + salt — not Math.random(). */
function seededUnit(accountId: string, dayIndex: number, salt: number): number {
  const s = `${accountId}\0${dayIndex}\0${salt}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function seededSigned(accountId: string, dayIndex: number, salt: number): number {
  return seededUnit(accountId, dayIndex, salt) * 2 - 1
}

function isoDateForDayIndex(dayIndex: number): string {
  const d = new Date(START_UTC + dayIndex * 86_400_000)
  return d.toISOString().slice(0, 10)
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function usageFraction(
  cfg: AccountCreditConfig,
  dayIndex: number,
  t: number
): number {
  const { id, pctMin, pctMax, growthRate, volatility, status } = cfg
  const n1 = seededSigned(id, dayIndex, 1)
  const n2 = seededSigned(id, dayIndex, 2)
  const n3 = seededSigned(id, dayIndex, 3)

  switch (status) {
    case 'active': {
      // Steady growth along band + mild sine
      const base = pctMin + (pctMax - pctMin) * t * growthRate
      const wave = Math.sin(dayIndex * 0.22 + seededUnit(id, 0, 99) * 6) * 0.025
      const noise = n1 * volatility * 0.04
      return clamp01(base + wave + noise)
    }
    case 'onboarding': {
      // Low start, slow ramp (concave-up feel)
      const ramp = Math.pow(t, 0.65)
      const base = pctMin + (pctMax - pctMin) * ramp
      const noise = (n1 * 0.5 + n2 * 0.5) * volatility * 0.03
      return clamp01(base + noise)
    }
    case 'at_risk': {
      // Erratic: multiple frequencies + larger noise
      const mid = (pctMin + pctMax) / 2
      const span = (pctMax - pctMin) / 2
      const w1 = Math.sin(dayIndex * 0.31 + 1.7) * span * 0.55
      const w2 = Math.sin(dayIndex * 0.09 + 0.4) * span * 0.35
      const w3 = Math.sin(dayIndex * 0.47 + 3.1) * span * 0.2
      const drift = (t - 0.5) * growthRate * span * 0.3
      const noise = (n1 + n2 * 0.7 + n3 * 0.4) * volatility * 0.06
      return clamp01(mid + w1 + w2 + w3 + drift + noise)
    }
    case 'go_live': {
      // High plateau quickly, small oscillation
      const plateau = pctMin + (pctMax - pctMin) * (0.85 + 0.15 * (1 - Math.exp(-t * 4)))
      const micro = Math.sin(dayIndex * 0.18) * 0.018
      const noise = n1 * volatility * 0.025
      return clamp01(plateau + micro + noise)
    }
    default:
      return pctMin
  }
}

export const ACCOUNT_CREDIT_CONFIGS: AccountCreditConfig[] = [
  {
    id: 'acc-jane-fs',
    allocated: 920_000,
    pctMin: 0.6,
    pctMax: 0.75,
    growthRate: 1,
    volatility: 0.35,
    status: 'active',
  },
  {
    id: 'acc-jane-hc',
    allocated: 410_000,
    pctMin: 0.1,
    pctMax: 0.2,
    growthRate: 1,
    volatility: 0.3,
    status: 'onboarding',
  },
  {
    id: 'acc-jane-ret',
    allocated: 380_000,
    pctMin: 0.4,
    pctMax: 0.55,
    growthRate: 0.4,
    volatility: 0.85,
    status: 'at_risk',
  },
  {
    id: 'acc-jane-tech',
    allocated: 650_000,
    pctMin: 0.8,
    pctMax: 0.9,
    growthRate: 0.2,
    volatility: 0.25,
    status: 'go_live',
  },
  {
    id: 'acc-carlos-media',
    allocated: 540_000,
    pctMin: 0.55,
    pctMax: 0.7,
    growthRate: 1,
    volatility: 0.38,
    status: 'active',
  },
  {
    id: 'acc-carlos-mfg',
    allocated: 295_000,
    pctMin: 0.08,
    pctMax: 0.18,
    growthRate: 1,
    volatility: 0.28,
    status: 'onboarding',
  },
  {
    id: 'acc-carlos-ins',
    allocated: 470_000,
    pctMin: 0.35,
    pctMax: 0.5,
    growthRate: 0.35,
    volatility: 0.9,
    status: 'at_risk',
  },
  {
    id: 'acc-carlos-tel',
    allocated: 1_050_000,
    pctMin: 0.82,
    pctMax: 0.92,
    growthRate: 0.15,
    volatility: 0.22,
    status: 'go_live',
  },
]

export function generateCreditSeries(): CreditDailyEntry[] {
  const out: CreditDailyEntry[] = []
  const denom = Math.max(1, DAY_COUNT - 1)

  for (const cfg of ACCOUNT_CREDIT_CONFIGS) {
    for (let d = 0; d < DAY_COUNT; d++) {
      const t = d / denom
      const frac = usageFraction(cfg, d, t)
      const credits_used = Math.round(cfg.allocated * frac)
      out.push({
        account_id: cfg.id,
        date: isoDateForDayIndex(d),
        credits_used,
        credits_allocated: cfg.allocated,
      })
    }
  }

  return out
}

export const MOCK_CREDIT_SERIES = generateCreditSeries()

export function getCreditSeriesForAccount(accountId: string): CreditDailyEntry[] {
  return MOCK_CREDIT_SERIES.filter((e) => e.account_id === accountId)
}
