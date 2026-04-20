import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

import { CreditBar, formatCredits } from '../accounts/CreditBar'
import { useAccountCreditSeries } from '../../api/hooks'

interface CreditOverviewProps {
  accountId: string
  allocated: number
}

export function CreditOverview({ accountId, allocated }: CreditOverviewProps) {
  const { data: series = [] } = useAccountCreditSeries(accountId)

  const sparkData = useMemo(() => series.slice(-30), [series])
  const lastEntry = sparkData[sparkData.length - 1]
  const used = lastEntry?.credits_used ?? 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Credit Usage
      </h3>

      <CreditBar used={used} allocated={allocated} />

      <div className="mt-3" title={`${formatCredits(allocated)} allocated`}>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="credits_used"
              stroke="#29B5E8"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-xs text-slate-400">30-day trend</p>
      </div>
    </div>
  )
}
