import { useState } from 'react'
import type { ColumnInfo, ColumnMapping } from '../types'
import { typesCompatible } from '../data/schemaIntrospection'
import {
  buildColumnMappingPrompt,
  callLlm,
  getLlmSettings,
  isLlmConfigured,
  mockAutoMapColumns,
  parseColumnMappingResponse,
} from '../rag/llmClient'

interface ColumnMappingBoardProps {
  sourceColumns: ColumnInfo[]
  targetColumns: ColumnInfo[]
  mapping: ColumnMapping[]
  onMappingChange: (next: ColumnMapping[]) => void
}

const DRAG_MIME = 'application/x-column'

export default function ColumnMappingBoard({ sourceColumns, targetColumns, mapping, onMappingChange }: ColumnMappingBoardProps) {
  const [draggingName, setDraggingName] = useState<string | null>(null)
  const [dragOverName, setDragOverName] = useState<string | null>(null)
  const [autoMapping, setAutoMapping] = useState(false)
  const [autoMapStatus, setAutoMapStatus] = useState<string | null>(null)

  function upsertMapping(targetCol: ColumnInfo, sourceCol: ColumnInfo) {
    const withoutTarget = mapping.filter((m) => m.target_column !== targetCol.name)
    onMappingChange([...withoutTarget, { source_column: sourceCol.name, target_column: targetCol.name, type: sourceCol.type }])
  }

  function removeMapping(targetName: string) {
    onMappingChange(mapping.filter((m) => m.target_column !== targetName))
  }

  async function autoMapWithAi() {
    setAutoMapping(true)
    setAutoMapStatus(null)
    const settings = getLlmSettings()
    let usedAi = false
    let suggestions: { source: string; target: string }[] = []

    if (isLlmConfigured(settings)) {
      try {
        const raw = await callLlm(settings, buildColumnMappingPrompt(sourceColumns, targetColumns))
        suggestions = parseColumnMappingResponse(raw)
        usedAi = true
      } catch {
        suggestions = mockAutoMapColumns(sourceColumns, targetColumns)
      }
    } else {
      suggestions = mockAutoMapColumns(sourceColumns, targetColumns)
    }

    const alreadyMapped = new Set(mapping.map((m) => m.target_column))
    const additions: ColumnMapping[] = []
    for (const s of suggestions) {
      if (alreadyMapped.has(s.target)) continue
      const sourceCol = sourceColumns.find((c) => c.name === s.source)
      const targetCol = targetColumns.find((c) => c.name === s.target)
      if (!sourceCol || !targetCol) continue
      additions.push({ source_column: sourceCol.name, target_column: targetCol.name, type: sourceCol.type })
      alreadyMapped.add(s.target)
    }

    if (additions.length > 0) onMappingChange([...mapping, ...additions])
    setAutoMapStatus(
      `Mapped ${additions.length} of ${targetColumns.length} target column${targetColumns.length === 1 ? '' : 's'} ${
        usedAi ? 'using AI name matching' : 'using built-in name matching (no LLM configured)'
      }. Review the mapping below and adjust anything that isn't right.`,
    )
    setAutoMapping(false)
  }

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p className="hint">Drag a source column onto a target column to map it, or pick one from the dropdown on the target side.</p>
        <button type="button" className="btn small primary" onClick={autoMapWithAi} disabled={autoMapping}>
          {autoMapping ? 'Auto-mapping…' : 'Auto-map with AI'}
        </button>
      </div>
      {autoMapStatus && <p className="hint">{autoMapStatus}</p>}
      <div className="dnd-board">
        <div className="dnd-pane">
          <div className="dnd-pane-title">Source columns</div>
          {sourceColumns.map((col) => {
            const mappedTo = mapping.filter((m) => m.source_column === col.name).map((m) => m.target_column)
            return (
              <div
                key={col.name}
                className={`dnd-pill ${mappedTo.length > 0 ? 'mapped' : ''} ${draggingName === col.name ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDraggingName(col.name)
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(col))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDragEnd={() => setDraggingName(null)}
              >
                <span className="dnd-pill-name">{col.name}</span>
                <span className="dnd-pill-type">{col.type}</span>
                {mappedTo.length > 0 && <span className="dnd-pill-arrow">→ {mappedTo.join(', ')}</span>}
              </div>
            )
          })}
          {sourceColumns.length === 0 && <p className="hint">No source columns found.</p>}
        </div>

        <div className="dnd-pane">
          <div className="dnd-pane-title">Target columns</div>
          {targetColumns.map((col) => {
            const existing = mapping.find((m) => m.target_column === col.name)
            const mismatch = Boolean(existing && !typesCompatible(existing.type, col.type))
            return (
              <div
                key={col.name}
                className={`dnd-drop-row ${existing ? 'filled' : ''} ${mismatch ? 'mismatch' : ''} ${dragOverName === col.name ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverName(col.name)
                }}
                onDragLeave={() => setDragOverName(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverName(null)
                  const raw = e.dataTransfer.getData(DRAG_MIME)
                  if (!raw) return
                  upsertMapping(col, JSON.parse(raw) as ColumnInfo)
                }}
              >
                <div className="dnd-drop-row-main">
                  <span className="dnd-pill-name">{col.name}</span>
                  <span className="dnd-pill-type">{col.type}</span>
                </div>
                {existing ? (
                  <div className="dnd-drop-row-mapped">
                    <span>
                      ← {existing.source_column} ({existing.type})
                    </span>
                    {mismatch && (
                      <span className="dnd-mismatch-warning" title={`Type mismatch: source is ${existing.type}, target is ${col.type}`}>
                        ⚠ type mismatch
                      </span>
                    )}
                    <button type="button" className="dnd-remove" onClick={() => removeMapping(col.name)} aria-label="Remove mapping">
                      ×
                    </button>
                  </div>
                ) : (
                  <select
                    value=""
                    onChange={(e) => {
                      const sourceCol = sourceColumns.find((s) => s.name === e.target.value)
                      if (sourceCol) upsertMapping(col, sourceCol)
                    }}
                  >
                    <option value="">Drop or pick a source column…</option>
                    {sourceColumns.map((sc) => (
                      <option key={sc.name} value={sc.name}>
                        {sc.name} ({sc.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
          {targetColumns.length === 0 && <p className="hint">No target columns found.</p>}
        </div>
      </div>
    </div>
  )
}
