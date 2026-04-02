import { useState } from 'react'
import { Send, UserCircle } from 'lucide-react'
import type { TMRReviewNote, UserRole } from '../../types'

interface ReviewPanelProps {
  notes: TMRReviewNote[]
  tmrStatus: string
  userRole: UserRole
  currentUserId: string
  currentUserName: string
  onAddNote: (content: string) => void
  onSubmitReview?: () => void
  onApprove?: () => void
  onSendBack?: () => void
}

export function ReviewPanel({
  notes,
  tmrStatus,
  userRole,
  currentUserId: _currentUserId,
  currentUserName: _currentUserName,
  onAddNote,
  onSubmitReview,
  onApprove,
  onSendBack,
}: ReviewPanelProps) {
  const [draft, setDraft] = useState('')

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAddNote(trimmed)
    setDraft('')
  }

  const showAceSubmit = userRole === 'ace' && tmrStatus === 'Pending Review'
  const showManagerActions = userRole === 'acem' && tmrStatus === 'Manager Review'

  return (
    <div className="flex flex-col gap-4">
      {notes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Review Notes
          </p>
          <div className="space-y-2">
            {notes.map((note) => {
              const isManager = note.author_id.startsWith('acem')
              return (
                <div
                  key={note.note_id}
                  className={`rounded-lg border p-3 ${
                    isManager
                      ? 'border-blue-100 bg-blue-50/50'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <UserCircle
                      size={14}
                      className={isManager ? 'text-blue-500' : 'text-slate-400'}
                    />
                    <span className="text-xs font-medium text-slate-700">{note.author_name}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isManager
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isManager ? 'Manager' : 'ACE'}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{note.content}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(showAceSubmit || showManagerActions || tmrStatus === 'Pending Review') && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-300"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="self-end rounded-lg bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
              title="Add note"
            >
              <Send size={16} />
            </button>
          </div>

          <div className="flex gap-2">
            {showAceSubmit && onSubmitReview && (
              <button
                onClick={onSubmitReview}
                className="rounded-lg bg-snow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-snow-600"
              >
                Submit Review
              </button>
            )}
            {showManagerActions && (
              <>
                {onApprove && (
                  <button
                    onClick={onApprove}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                  >
                    Approve → Scheduled
                  </button>
                )}
                {onSendBack && (
                  <button
                    onClick={onSendBack}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    Send Back
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
