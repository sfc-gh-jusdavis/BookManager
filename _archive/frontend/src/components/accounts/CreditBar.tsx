import clsx from 'clsx'

export function formatCredits(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const v = n / 1_000_000
    const s = v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')
    return `${s}M`
  }
  if (abs >= 1_000) {
    const v = n / 1_000
    const s = v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')
    return `${s}K`
  }
  return `${Math.round(n)}`
}

interface CreditBarProps {
  used: number
  allocated: number
}

export function CreditBar({ used, allocated }: CreditBarProps) {
  const pct =
    allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0
  return (
    <div className="w-full min-w-[6rem]">
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={clsx(
            'h-2 rounded-full transition-all',
            pct < 50 && 'bg-snow-400',
            pct >= 50 && pct <= 80 && 'bg-amber-400',
            pct > 80 && 'bg-red-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {pct}% · {formatCredits(used)} / {formatCredits(allocated)}
      </p>
    </div>
  )
}
