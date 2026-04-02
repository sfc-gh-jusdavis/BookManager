import { useState, useCallback, useEffect } from 'react'
import { Header } from '../components/layout/Header'
import { ChevronDown, ChevronRight, Download, Search, Key, Link2, X } from 'lucide-react'
import { clsx } from 'clsx'
import seedData from '../data/data-catalog.json'

interface CatalogColumn {
  name: string
  type: string
  nullable: boolean
  isPK: boolean
  isFK: boolean
  description: string
  notes: string
}

interface CatalogTable {
  id: string
  schema: 'RAW' | 'APP' | 'ML'
  tableName: string
  description: string
  grain: string
  refreshCadence: string
  snowhousePath: string
  notes: string
  columns: CatalogColumn[]
}

type SchemaFilter = 'ALL' | 'RAW' | 'APP' | 'ML'

const LS_KEY = 'data-catalog-edits'

function loadCatalog(): CatalogTable[] {
  const base = seedData as CatalogTable[]
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return base
    const edits: Record<string, Partial<CatalogTable> & { columns?: Record<string, Partial<CatalogColumn>> }> = JSON.parse(raw)
    return base.map((table) => {
      const tableEdits = edits[table.id]
      if (!tableEdits) return table
      const merged = {
        ...table,
        snowhousePath: tableEdits.snowhousePath ?? table.snowhousePath,
        notes: tableEdits.notes ?? table.notes,
        columns: table.columns.map((col) => {
          const colNotes = tableEdits.columns?.[col.name]?.notes
          return colNotes !== undefined ? { ...col, notes: colNotes } : col
        }),
      }
      return merged
    })
  } catch {
    return base
  }
}

function saveEdits(tables: CatalogTable[]) {
  const base = seedData as CatalogTable[]
  const edits: Record<string, { snowhousePath?: string; notes?: string; columns?: Record<string, { notes: string }> }> = {}
  for (const table of tables) {
    const seed = base.find((s) => s.id === table.id)
    if (!seed) continue
    const tableEdit: typeof edits[string] = {}
    let hasEdit = false
    if (table.snowhousePath !== seed.snowhousePath) {
      tableEdit.snowhousePath = table.snowhousePath
      hasEdit = true
    }
    if (table.notes !== seed.notes) {
      tableEdit.notes = table.notes
      hasEdit = true
    }
    const colEdits: Record<string, { notes: string }> = {}
    for (const col of table.columns) {
      const seedCol = seed.columns.find((c) => c.name === col.name)
      if (seedCol && col.notes !== seedCol.notes) {
        colEdits[col.name] = { notes: col.notes }
        hasEdit = true
      }
    }
    if (Object.keys(colEdits).length > 0) tableEdit.columns = colEdits
    if (hasEdit) edits[table.id] = tableEdit
  }
  if (Object.keys(edits).length === 0) {
    localStorage.removeItem(LS_KEY)
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(edits))
  }
}

const SCHEMA_COLORS: Record<string, { bg: string; text: string }> = {
  RAW: { bg: 'bg-amber-50', text: 'text-amber-700' },
  APP: { bg: 'bg-sky-50', text: 'text-sky-700' },
  ML: { bg: 'bg-violet-50', text: 'text-violet-700' },
}

const SCHEMA_DESCRIPTIONS: Record<string, string> = {
  RAW: 'Ingested source data, minimal transformation',
  APP: 'Derived tables serving the application directly',
  ML: 'Feature tables and prediction outputs',
}

export function DataCatalog() {
  const [tables, setTables] = useState<CatalogTable[]>(loadCatalog)
  const [schemaFilter, setSchemaFilter] = useState<SchemaFilter>('ALL')
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    saveEdits(tables)
  }, [tables])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const updateTableField = useCallback((tableId: string, field: 'snowhousePath' | 'notes', value: string) => {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, [field]: value } : t))
    )
  }, [])

  const updateColumnNotes = useCallback((tableId: string, colName: string, value: string) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.name === colName ? { ...c, notes: value } : c
              ),
            }
          : t
      )
    )
  }, [])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(tables, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data-catalog.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [tables])

  const lowerSearch = search.toLowerCase()
  const filtered = tables.filter((t) => {
    if (schemaFilter !== 'ALL' && t.schema !== schemaFilter) return false
    if (!lowerSearch) return true
    if (t.tableName.toLowerCase().includes(lowerSearch)) return true
    if (t.description.toLowerCase().includes(lowerSearch)) return true
    if (t.snowhousePath.toLowerCase().includes(lowerSearch)) return true
    return t.columns.some(
      (c) =>
        c.name.toLowerCase().includes(lowerSearch) ||
        c.description.toLowerCase().includes(lowerSearch)
    )
  })

  const schemaCounts = {
    ALL: tables.length,
    RAW: tables.filter((t) => t.schema === 'RAW').length,
    APP: tables.filter((t) => t.schema === 'APP').length,
    ML: tables.filter((t) => t.schema === 'ML').length,
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Data Catalog" subtitle={`${filtered.length} of ${tables.length} tables`} />

      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Schema filter pills */}
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(['ALL', 'RAW', 'APP', 'ML'] as SchemaFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setSchemaFilter(s)}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  schemaFilter === s
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                )}
              >
                {s}
                <span className="ml-1.5 text-[10px] opacity-70">{schemaCounts[s]}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tables or columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-snow-400 focus:outline-none focus:ring-1 focus:ring-snow-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download size={14} />
            Export JSON
          </button>
        </div>

        {/* Schema description when filtered */}
        {schemaFilter !== 'ALL' && (
          <p className="text-xs text-slate-500">
            <span className={clsx('inline-block rounded px-1.5 py-0.5 text-[10px] font-bold mr-1.5', SCHEMA_COLORS[schemaFilter]?.bg, SCHEMA_COLORS[schemaFilter]?.text)}>
              {schemaFilter}
            </span>
            {SCHEMA_DESCRIPTIONS[schemaFilter]}
          </p>
        )}

        {/* Table cards */}
        <div className="flex flex-col gap-4">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">No tables match your search.</p>
            </div>
          )}
          {filtered.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              isExpanded={expandedIds.has(table.id)}
              onToggle={() => toggleExpanded(table.id)}
              onUpdateField={updateTableField}
              onUpdateColumnNotes={updateColumnNotes}
              searchTerm={lowerSearch}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TableCard({
  table,
  isExpanded,
  onToggle,
  onUpdateField,
  onUpdateColumnNotes,
  searchTerm,
}: {
  table: CatalogTable
  isExpanded: boolean
  onToggle: () => void
  onUpdateField: (tableId: string, field: 'snowhousePath' | 'notes', value: string) => void
  onUpdateColumnNotes: (tableId: string, colName: string, value: string) => void
  searchTerm: string
}) {
  const colors = SCHEMA_COLORS[table.schema] ?? { bg: 'bg-slate-50', text: 'text-slate-700' }
  const [showNotes, setShowNotes] = useState(!!table.notes)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-5">
        <button
          onClick={onToggle}
          className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', colors.bg, colors.text)}>
              {table.schema}
            </span>
            <button
              onClick={onToggle}
              className="text-base font-semibold text-slate-800 hover:text-snow-600 transition-colors"
            >
              {table.tableName}
            </button>
          </div>

          <p className="mt-1 text-sm text-slate-500">{table.description}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
            <span>
              <span className="font-medium text-slate-500">Grain:</span> {table.grain}
            </span>
            <span>
              <span className="font-medium text-slate-500">Refresh:</span> {table.refreshCadence}
            </span>
            <span>
              <span className="font-medium text-slate-500">Columns:</span> {table.columns.length}
            </span>
          </div>

          {/* Snowhouse path */}
          <div className="mt-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Snowhouse Path
            </label>
            <input
              type="text"
              value={table.snowhousePath}
              onChange={(e) => onUpdateField(table.id, 'snowhousePath', e.target.value)}
              placeholder="e.g. BOOKMANAGER.RAW.ACCOUNTS"
              className="w-full max-w-lg rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-mono text-slate-700 placeholder:text-slate-300 focus:border-snow-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-snow-400"
            />
          </div>

          {/* Table notes */}
          <div className="mt-2">
            {!showNotes && !table.notes ? (
              <button
                onClick={() => setShowNotes(true)}
                className="text-xs text-slate-400 hover:text-snow-600 transition-colors"
              >
                + Add notes
              </button>
            ) : (
              <>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Notes
                </label>
                <textarea
                  value={table.notes}
                  onChange={(e) => onUpdateField(table.id, 'notes', e.target.value)}
                  placeholder="Add notes about this table..."
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-snow-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-snow-400 resize-y"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded column list */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-[180px]">Column</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-[120px]">Type</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-[80px]">Flags</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 w-[220px]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => {
                const highlighted =
                  searchTerm &&
                  (col.name.toLowerCase().includes(searchTerm) ||
                    col.description.toLowerCase().includes(searchTerm))
                return (
                  <tr
                    key={col.name}
                    className={clsx(
                      'border-b border-slate-100 last:border-0',
                      highlighted && 'bg-yellow-50/60'
                    )}
                  >
                    <td className="px-5 py-2 font-mono text-xs font-medium text-slate-700">
                      {col.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{col.type}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {col.isPK && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700" title="Primary Key">
                            <Key size={9} /> PK
                          </span>
                        )}
                        {col.isFK && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700" title="Foreign Key">
                            <Link2 size={9} /> FK
                          </span>
                        )}
                        {col.nullable && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400" title="Nullable">
                            null
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{col.description}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={col.notes}
                        onChange={(e) => onUpdateColumnNotes(table.id, col.name, e.target.value)}
                        placeholder="..."
                        className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-xs text-slate-600 placeholder:text-slate-300 hover:border-slate-200 hover:bg-white focus:border-snow-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-snow-400"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
