import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ForecastCategory } from '../../types'

export function categoryBadgeClass(cat: ForecastCategory): string {
  switch (cat) {
    case 'Commit':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'Most Likely':
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'Stretch':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
}

const CATEGORY_OPTIONS: ForecastCategory[] = ['Commit', 'Most Likely', 'Stretch']

export interface AdjustModalProps {
  open: boolean
  onClose: () => void
  useCaseName: string
  accountName: string
  currentAutoCategory: ForecastCategory
  currentEffective: ForecastCategory
  userRole: 'ace' | 'acem'
  onSubmit: (newCategory: ForecastCategory, note: string) => void
}

export function AdjustModal({
  open,
  onClose,
  useCaseName,
  accountName,
  currentAutoCategory,
  currentEffective,
  userRole,
  onSubmit,
}: AdjustModalProps) {
  const [newCategory, setNewCategory] = useState<ForecastCategory>(currentEffective)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setNewCategory(currentEffective)
      setNote('')
    }
  }, [open, currentEffective])

  if (!open) return null

  const noteTrimmed = note.trim()
  const submitDisabled = noteTrimmed === '' || newCategory === currentEffective

  const handleSubmit = () => {
    if (submitDisabled) return
    onSubmit(newCategory, noteTrimmed)
    onClose()
  }

  const textareaClass =
    'w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400 resize-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-forecast-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="adjust-forecast-title" className="text-lg font-semibold text-slate-800">
            Adjust Forecast
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 text-sm text-slate-600">
          <p>Account: {accountName}</p>
          <p>Use Case: {useCaseName}</p>
        </div>

        <div className="mb-3 text-sm">
          <span className="text-slate-600">Auto Classification:</span>{' '}
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(currentAutoCategory)}`}
          >
            {currentAutoCategory}
          </span>
        </div>

        <div className="mb-4 text-sm">
          <span className="text-slate-600">Current Forecast:</span>{' '}
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(currentEffective)}`}
          >
            {currentEffective}
          </span>
        </div>

        <div className="mb-3">
          <label htmlFor="adjust-new-classification" className="mb-1 block text-sm font-medium text-slate-700">
            New Classification
          </label>
          <select
            id="adjust-new-classification"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ForecastCategory)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="adjust-justification" className="mb-1 block text-sm font-medium text-slate-700">
            Justification (required)
          </label>
          <textarea
            id="adjust-justification"
            rows={3}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={textareaClass}
          />
        </div>

        {userRole === 'ace' ? (
          <p className="mb-4 text-xs text-slate-400">Your adjustment will be submitted for manager approval.</p>
        ) : null}

        <button
          type="button"
          disabled={submitDisabled}
          onClick={handleSubmit}
          className="w-full rounded-lg bg-snow-500 py-2 text-sm font-medium text-white transition-colors hover:bg-snow-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {userRole === 'ace' ? 'Submit for Approval' : 'Apply Override'}
        </button>
      </div>
    </div>
  )
}
