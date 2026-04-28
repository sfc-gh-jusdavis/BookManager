import clsx from 'clsx'

const healthStyles: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Onboarding: 'bg-sky-50 text-sky-700 border border-sky-200',
  'At Risk': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Go Live': 'bg-violet-50 text-violet-700 border border-violet-200',
  Blocked: 'bg-red-50 text-red-700 border border-red-200',
  Discovery: 'bg-slate-50 text-slate-600 border border-slate-200',
  Scoping: 'bg-slate-50 text-slate-600 border border-slate-200',
  'Technical Win': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'Use Case Won': 'bg-sky-50 text-sky-700 border border-sky-200',
  'Impl Pending': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Impl In Progress': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'Go-Live': 'bg-violet-50 text-violet-700 border border-violet-200',
  Deployed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const engagementConfig: Record<
  string,
  { dot: string; label: string; pulse?: boolean }
> = {
  'Pre-Activation': {
    dot: 'bg-slate-400',
    label: 'text-slate-600',
  },
  Active: {
    dot: 'bg-emerald-500',
    label: 'text-emerald-700',
    pulse: true,
  },
  Completed: {
    dot: 'bg-sky-500',
    label: 'text-sky-600',
  },
}

interface StatusBadgeProps {
  status: string
  variant?: 'health' | 'engagement'
}

export function StatusBadge({ status, variant = 'health' }: StatusBadgeProps) {
  if (variant === 'engagement') {
    const cfg = engagementConfig[status] ?? {
      dot: 'bg-slate-400',
      label: 'text-slate-600',
    }
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 text-xs font-medium',
          cfg.label,
        )}
      >
        <span
          className={clsx(
            'h-2 w-2 shrink-0 rounded-full',
            cfg.dot,
            cfg.pulse && 'animate-pulse',
          )}
        />
        {status}
      </span>
    )
  }

  const healthClass =
    healthStyles[status] ?? 'bg-slate-50 text-slate-700 border border-slate-200'

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        healthClass,
      )}
    >
      {status}
    </span>
  )
}
