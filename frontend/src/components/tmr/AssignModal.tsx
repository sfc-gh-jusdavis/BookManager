import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PriorityBadge } from './TMRStatusBadge'
import { ACE_DISPLAY_NAMES } from '../../mocks/aceDisplayNames'

interface AssignModalProps {
  open: boolean
  onClose: () => void
  tmrId: string
  accountName: string
  requestType: string
  priority: string
  onAssign: (aceId: string, note: string) => void
}

const aceOptions = Object.entries(ACE_DISPLAY_NAMES).map(([id, name]) => ({ id, name }))

export function AssignModal({
  open,
  onClose,
  tmrId: _tmrId,
  accountName,
  requestType,
  priority,
  onAssign,
}: AssignModalProps) {
  const [selectedAce, setSelectedAce] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedAce('')
      setNote('')
    }
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    if (!selectedAce) return
    onAssign(selectedAce, note.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={18} />
        </button>

        <h2 className="mb-4 text-lg font-semibold text-slate-800">Assign TMR</h2>

        <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">{accountName}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-500">{requestType}</span>
            <PriorityBadge priority={priority} />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="assign-ace" className="mb-1 block text-sm font-medium text-slate-700">
            Assign To
          </label>
          <select
            id="assign-ace"
            value={selectedAce}
            onChange={(e) => setSelectedAce(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
          >
            <option value="">Select team member...</option>
            {aceOptions.map((ace) => (
              <option key={ace.id} value={ace.id}>
                {ace.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label htmlFor="assign-notes" className="mb-1 block text-sm font-medium text-slate-700">
            Notes for Reviewer
          </label>
          <textarea
            id="assign-notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context, things to look out for, dependencies..."
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selectedAce}
          className="w-full rounded-lg bg-snow-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-snow-600 disabled:opacity-40"
        >
          Assign & Send for Review
        </button>
      </div>
    </div>
  )
}
