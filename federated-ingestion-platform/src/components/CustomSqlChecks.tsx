import { useState } from 'react'
import type { CustomSqlCheck } from '../types'
import AccordionToggle from './AccordionToggle'
import HelpTip from './HelpTip'

interface CustomSqlChecksProps {
  checks: CustomSqlCheck[]
  onChange: (next: CustomSqlCheck[]) => void
}

export default function CustomSqlChecks({ checks, onChange }: CustomSqlChecksProps) {
  const [expanded, setExpanded] = useState(false)
  const [label, setLabel] = useState('')
  const [sql, setSql] = useState('')

  function addCheck() {
    if (!sql.trim()) return
    const check: CustomSqlCheck = { id: `csc_${Math.random().toString(36).slice(2, 9)}`, label: label.trim(), sql: sql.trim() }
    onChange([...checks, check])
    setLabel('')
    setSql('')
  }

  function removeCheck(id: string) {
    onChange(checks.filter((c) => c.id !== id))
  }

  return (
    <div>
      <div className="section-title">
        <AccordionToggle label="Custom checks" expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        <HelpTip text="The auto-generated queries above cover the rules you picked per column. If you need something they don't express — a cross-table check, a business-specific invariant, a freshness check — add your own SELECT here and it will be included alongside the generated queries." />
      </div>

      {expanded && (
        <>
          {checks.map((check) => (
            <div className="transform-card" key={check.id}>
              <div className="transform-card-head">
                <strong>{check.label || '(untitled check)'}</strong>
                <button type="button" className="btn small danger" onClick={() => removeCheck(check.id)}>
                  Remove
                </button>
              </div>
              <pre className="sql-preview-block">{check.sql}</pre>
            </div>
          ))}

          <div className="transform-card">
            <div className="form-grid">
              <div className="field full">
                <label>Label</label>
                <input value={label} placeholder="No rows loaded in the last 24h (freshness)" onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="field full">
                <label>SELECT statement</label>
                <textarea
                  rows={4}
                  className="mono"
                  value={sql}
                  placeholder={'SELECT COUNT(*)\nFROM schema.table\nWHERE ...;'}
                  onChange={(e) => setSql(e.target.value)}
                />
              </div>
            </div>
            <button type="button" className="btn small" onClick={addCheck} disabled={!sql.trim()}>
              + Add custom check
            </button>
          </div>
        </>
      )}
    </div>
  )
}
