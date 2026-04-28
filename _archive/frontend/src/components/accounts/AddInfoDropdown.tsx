import { useState } from 'react'
import {
  Plus,
  StickyNote,
  Link2,
  X,
  FileText,
  BookOpen,
  Mail,
  MessageSquare,
  Globe,
} from 'lucide-react'
import type { AccountResource, LinkType, ResourceType } from '../../types'

const LINK_TYPE_OPTIONS: { value: LinkType; label: string; icon: typeof FileText }[] = [
  { value: 'google_drive', label: 'Google Drive', icon: FileText },
  { value: 'confluence', label: 'Confluence', icon: BookOpen },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'slack', label: 'Slack', icon: MessageSquare },
  { value: 'other', label: 'Other', icon: Globe },
]

interface AddInfoDropdownProps {
  accountId: string
  createdBy: string
  onAdd: (resource: AccountResource) => void
}

let idCounter = 0

export function AddInfoDropdown({ accountId, createdBy, onAdd }: AddInfoDropdownProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ResourceType | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('google_drive')

  function reset() {
    setMode(null)
    setTitle('')
    setContent('')
    setLinkType('google_drive')
    setOpen(false)
  }

  function handleSubmit() {
    if (!title.trim() || !content.trim() || !mode) return
    idCounter += 1
    const resource: AccountResource = {
      resource_id: `res-new-${idCounter}`,
      account_id: accountId,
      resource_type: mode,
      title: title.trim(),
      content: content.trim(),
      link_type: mode === 'link' ? linkType : null,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    }
    onAdd(resource)
    reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
      >
        <Plus size={14} />
        Add Info
      </button>
    )
  }

  if (!mode) {
    return (
      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode('note')}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-snow-50 hover:text-snow-700"
        >
          <StickyNote size={14} />
          Add Note
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-snow-50 hover:text-snow-700"
        >
          <Link2 size={14} />
          Link Document
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {mode === 'note' ? 'Add Note' : 'Link Document'}
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
        />
        {mode === 'note' ? (
          <textarea
            placeholder="Notes, context, observations..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400 resize-none"
          />
        ) : (
          <>
            <div className="flex gap-1 flex-wrap">
              {LINK_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLinkType(opt.value)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    linkType === opt.value
                      ? 'bg-snow-50 text-snow-700 border border-snow-200'
                      : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon size={12} />
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              placeholder="https://..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
            />
          </>
        )}
        <button
          type="button"
          disabled={!title.trim() || !content.trim()}
          onClick={handleSubmit}
          className="w-full rounded-md bg-snow-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-snow-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === 'note' ? 'Save Note' : 'Save Link'}
        </button>
      </div>
    </div>
  )
}

export function linkTypeIcon(type: LinkType | null) {
  switch (type) {
    case 'google_drive':
      return <FileText size={14} className="text-blue-500" />
    case 'confluence':
      return <BookOpen size={14} className="text-blue-600" />
    case 'email':
      return <Mail size={14} className="text-amber-500" />
    case 'slack':
      return <MessageSquare size={14} className="text-purple-500" />
    case 'other':
      return <Globe size={14} className="text-slate-500" />
    default:
      return <StickyNote size={14} className="text-emerald-500" />
  }
}
