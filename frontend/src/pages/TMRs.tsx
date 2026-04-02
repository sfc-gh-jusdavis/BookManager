import { useState, useMemo } from 'react'
import { Header } from '../components/layout/Header'
import { useAuth } from '../context/AuthContext'
import { MOCK_TMRS } from '../mocks/tmrs'
import { TMRTable } from '../components/tmr/TMRTable'
import { AssignModal } from '../components/tmr/AssignModal'
import { ACE_DISPLAY_NAMES } from '../mocks/aceDisplayNames'
import type { TMR, TMRReviewNote } from '../types'
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarCheck,
  Search,
} from 'lucide-react'

const PRIORITY_FILTERS = ['All', 'P1', 'P2', 'P3'] as const
const REQUEST_TYPE_FILTERS = [
  'All',
  'Architecture Review',
  'Data Engineering',
  'ML Engineering',
  'Security Review',
  'Performance Tuning',
] as const

export function TMRs() {
  const { currentUser } = useAuth()
  const isManager = currentUser.role === 'acem'

  const [tmrs, setTmrs] = useState<TMR[]>(MOCK_TMRS)
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [assignTarget, setAssignTarget] = useState<TMR | null>(null)

  const scopedTmrs = useMemo(() => {
    if (isManager) return tmrs
    return tmrs.filter(
      (t) =>
        t.assigned_to === currentUser.user_id ||
        (t.status === 'Scheduled' &&
          tmrs.some(
            (other) =>
              other.account_id === t.account_id && other.assigned_to === currentUser.user_id,
          )) ||
        t.status === 'In Progress',
    )
  }, [tmrs, isManager, currentUser.user_id])

  const filtered = useMemo(() => {
    let list = scopedTmrs
    if (statusFilter !== 'All') list = list.filter((t) => t.status === statusFilter)
    if (priorityFilter !== 'All') list = list.filter((t) => t.priority === priorityFilter)
    if (typeFilter !== 'All') list = list.filter((t) => t.request_type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.account_name.toLowerCase().includes(q) ||
          t.request_type.toLowerCase().includes(q) ||
          t.tmr_id.toLowerCase().includes(q),
      )
    }
    return list
  }, [scopedTmrs, statusFilter, priorityFilter, typeFilter, search])

  const kpis = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of scopedTmrs) {
      counts[t.status] = (counts[t.status] ?? 0) + 1
    }
    return {
      open: counts['Open'] ?? 0,
      pendingReview: counts['Pending Review'] ?? 0,
      managerReview: counts['Manager Review'] ?? 0,
      scheduled: counts['Scheduled'] ?? 0,
      inProgress: counts['In Progress'] ?? 0,
      completed: counts['Completed'] ?? 0,
      blocked: counts['Blocked'] ?? 0,
      total: scopedTmrs.length,
    }
  }, [scopedTmrs])

  const handleAssign = (aceId: string, note: string) => {
    if (!assignTarget) return
    const managerName =
      ACE_DISPLAY_NAMES[currentUser.user_id] ?? currentUser.display_name

    const reviewNote: TMRReviewNote = {
      note_id: `rn-${assignTarget.tmr_id}-assign-${Date.now()}`,
      tmr_id: assignTarget.tmr_id,
      author_id: currentUser.user_id,
      author_name: managerName,
      content: note || 'Assigned for review.',
      created_at: new Date().toISOString(),
    }

    setTmrs((prev) =>
      prev.map((t) =>
        t.tmr_id === assignTarget.tmr_id
          ? {
              ...t,
              assigned_to: aceId,
              status: 'Pending Review',
              review_notes: [...t.review_notes, reviewNote],
            }
          : t,
      ),
    )
    setAssignTarget(null)
  }

  const handleUpdateTmr = (updated: TMR) => {
    setTmrs((prev) => prev.map((t) => (t.tmr_id === updated.tmr_id ? updated : t)))
  }

  const kpiCards: { label: string; value: number; icon: React.ReactNode; className: string }[] = [
    {
      label: 'Open',
      value: kpis.open,
      icon: <FileText size={16} />,
      className: 'text-slate-600',
    },
    {
      label: 'Pending Review',
      value: kpis.pendingReview,
      icon: <Clock size={16} />,
      className: 'text-amber-600',
    },
    {
      label: 'Manager Review',
      value: kpis.managerReview,
      icon: <Clock size={16} />,
      className: 'text-blue-600',
    },
    {
      label: 'Scheduled',
      value: kpis.scheduled,
      icon: <CalendarCheck size={16} />,
      className: 'text-violet-600',
    },
    {
      label: 'In Progress',
      value: kpis.inProgress,
      icon: <FileText size={16} />,
      className: 'text-indigo-600',
    },
    {
      label: 'Completed',
      value: kpis.completed,
      icon: <CheckCircle2 size={16} />,
      className: 'text-emerald-600',
    },
    {
      label: 'Blocked',
      value: kpis.blocked,
      icon: <AlertTriangle size={16} />,
      className: 'text-red-600',
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <Header
        title="TMR Review"
        subtitle={
          isManager
            ? `${kpis.total} total TMRs across team`
            : `${kpis.total} TMRs in your queue`
        }
      />

      <div className="flex-1 p-6">
        {/* KPI Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {kpiCards.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() =>
                setStatusFilter(statusFilter === kpi.label ? 'All' : kpi.label)
              }
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${
                statusFilter === kpi.label
                  ? 'border-snow-300 ring-1 ring-snow-200'
                  : 'border-slate-200'
              }`}
            >
              <div className={`mb-1 ${kpi.className}`}>{kpi.icon}</div>
              <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
              <p className="text-xs text-slate-500">{kpi.label}</p>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TMRs..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
          >
            {PRIORITY_FILTERS.map((p) => (
              <option key={p} value={p}>
                {p === 'All' ? 'All Priorities' : p}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
          >
            {REQUEST_TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Types' : t}
              </option>
            ))}
          </select>

          {statusFilter !== 'All' && (
            <button
              onClick={() => setStatusFilter('All')}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Clear status filter
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <TMRTable
            tmrs={filtered}
            userRole={currentUser.role}
            currentUserId={currentUser.user_id}
            currentUserName={currentUser.display_name}
            onAssign={setAssignTarget}
            onUpdateTmr={handleUpdateTmr}
          />
        </div>
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          tmrId={assignTarget.tmr_id}
          accountName={assignTarget.account_name}
          requestType={assignTarget.request_type}
          priority={assignTarget.priority}
          onAssign={handleAssign}
        />
      )}
    </div>
  )
}
