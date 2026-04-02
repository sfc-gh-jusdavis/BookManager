import { useNavigate } from 'react-router-dom'
import type { Account } from '../../types'
import { StatusBadge } from './StatusBadge'
import { estimatedCreditsUsed } from './accountCreditEstimate'

function formatNextGoLiveLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface AccountCardProps {
  account: Account
  /** Earliest target go-live from use cases; omit to hide the line */
  nextGoLiveDate?: string | null
}

export function AccountCard({ account, nextGoLiveDate }: AccountCardProps) {
  const navigate = useNavigate()
  const allocated = account.total_credits_allocated
  const used = estimatedCreditsUsed(account.status, allocated)
  const pct =
    allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/accounts/${account.account_id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/accounts/${account.account_id}`)
        }
      }}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-snow-200 hover:shadow-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            {account.account_name}
          </h3>
          <StatusBadge
            status={account.engagement_status}
            variant="engagement"
          />
        </div>
        <StatusBadge status={account.status} />
        <p className="text-xs text-slate-500">{account.industry}</p>
        <div className="my-1 border-t border-slate-100" />
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{account.use_case_count} use cases</span>
          <span>{pct}% used</span>
        </div>
        {nextGoLiveDate ? (
          <p className="text-xs text-slate-500">
            Next go-live: {formatNextGoLiveLabel(nextGoLiveDate)}
          </p>
        ) : null}
      </div>
    </article>
  )
}
