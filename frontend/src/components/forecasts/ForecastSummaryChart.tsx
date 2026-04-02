import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ForecastCategory } from '../../types'

const CATEGORY_ORDER: ForecastCategory[] = ['Commit', 'Most Likely', 'Stretch']
const COLORS = ['#10b981', '#3b82f6', '#f59e0b'] as const

interface ForecastSummaryChartProps {
  categories: ForecastCategory[]
}

export function ForecastSummaryChart({ categories }: ForecastSummaryChartProps) {
  const data = useMemo(() => {
    const counts = { Commit: 0, 'Most Likely': 0, Stretch: 0 }
    for (const c of categories) counts[c] = (counts[c] ?? 0) + 1
    return [
      { name: 'Commit', value: counts.Commit },
      { name: 'Most Likely', value: counts['Most Likely'] },
      { name: 'Stretch', value: counts.Stretch },
    ].filter((d) => d.value > 0)
  }, [categories])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Forecast Distribution
      </h3>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No forecast data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}-${index}`}
                  fill={COLORS[CATEGORY_ORDER.indexOf(entry.name as ForecastCategory)]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
