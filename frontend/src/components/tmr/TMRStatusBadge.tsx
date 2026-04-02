import clsx from 'clsx'

const statusStyles: Record<string, string> = {
  Open: 'bg-slate-50 text-slate-600 border border-slate-200',
  'Pending Review': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Manager Review': 'bg-blue-50 text-blue-700 border border-blue-200',
  Scheduled: 'bg-violet-50 text-violet-700 border border-violet-200',
  'In Progress': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Blocked: 'bg-red-50 text-red-700 border border-red-200',
}

const priorityStyles: Record<string, string> = {
  P1: 'bg-red-50 text-red-700 border border-red-200',
  P2: 'bg-amber-50 text-amber-700 border border-amber-200',
  P3: 'bg-slate-50 text-slate-600 border border-slate-200',
}

export function TMRStatusBadge({ status }: { status: string }) {
  const cls = statusStyles[status] ?? 'bg-slate-50 text-slate-600 border border-slate-200'
  return (
    <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', cls)}>
      {status}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = priorityStyles[priority] ?? 'bg-slate-50 text-slate-600 border border-slate-200'
  return (
    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', cls)}>
      {priority}
    </span>
  )
}
