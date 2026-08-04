import { useState } from 'react'
import type { ColumnInfo, QualityRule, QualityRuleType } from '../types'
import { QUALITY_RULE_LABELS, applicableRuleTypes, emptyQualityRule } from '../data/qualityRules'
import AccordionToggle from './AccordionToggle'
import HelpTip from './HelpTip'

interface ColumnRulesGridProps {
  columns: ColumnInfo[]
  columnsLoading: boolean
  rules: QualityRule[]
  onRulesChange: (next: QualityRule[]) => void
}

export default function ColumnRulesGrid({ columns, columnsLoading, rules, onRulesChange }: ColumnRulesGridProps) {
  const [expanded, setExpanded] = useState(false)

  function ruleFor(field: string, type: QualityRuleType) {
    return rules.find((r) => r.field === field && r.rule === type)
  }

  function toggleRule(field: string, type: QualityRuleType, enabled: boolean) {
    if (enabled) {
      onRulesChange([...rules, { ...emptyQualityRule(field), rule: type }])
    } else {
      onRulesChange(rules.filter((r) => !(r.field === field && r.rule === type)))
    }
  }

  function updateRule(field: string, type: QualityRuleType, patch: Partial<QualityRule>) {
    onRulesChange(rules.map((r) => (r.field === field && r.rule === type ? { ...r, ...patch } : r)))
  }

  return (
    <div>
      <div className="section-title">
        <AccordionToggle label="Column rules" expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        <HelpTip text="Pick which checks apply to each column. Only the checks that make sense for a column's data type are offered — text columns don't get a numeric range, and numeric columns don't get a regex pattern." />
      </div>

      {expanded && (
        <>
          {columnsLoading && <p className="hint">Fetching columns…</p>}
          {!columnsLoading && columns.length === 0 && <p className="hint">No columns discovered yet — go back and check the table name.</p>}

          {columns.map((col) => (
            <div className="transform-card" key={col.name}>
              <div className="transform-card-head">
                <strong>{col.name}</strong>
                <span className="hint mono">{col.type}</span>
              </div>
              <div className="rule-grid">
                {applicableRuleTypes(col.type).map((type) => {
                  const rule = ruleFor(col.name, type)
                  return (
                    <div className="column-rule-item" key={type}>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={!!rule} onChange={(e) => toggleRule(col.name, type, e.target.checked)} />
                        {QUALITY_RULE_LABELS[type]}
                      </label>

                      {rule && type === 'range' && (
                        <div className="column-rule-config">
                          <input
                            type="number"
                            placeholder="Min"
                            value={rule.min ?? ''}
                            onChange={(e) => updateRule(col.name, type, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            value={rule.max ?? ''}
                            onChange={(e) => updateRule(col.name, type, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        </div>
                      )}

                      {rule && type === 'length' && (
                        <div className="column-rule-config">
                          <input
                            type="number"
                            min={0}
                            placeholder="Min length"
                            value={rule.min ?? ''}
                            onChange={(e) => updateRule(col.name, type, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Max length"
                            value={rule.max ?? ''}
                            onChange={(e) => updateRule(col.name, type, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                          />
                        </div>
                      )}

                      {rule && type === 'regex' && (
                        <div className="column-rule-config">
                          <input
                            placeholder="^[^@]+@[^@]+\.[^@]+$"
                            value={rule.pattern ?? ''}
                            onChange={(e) => updateRule(col.name, type, { pattern: e.target.value })}
                          />
                        </div>
                      )}

                      {rule && type === 'allowed_values' && (
                        <div className="column-rule-config">
                          <input
                            placeholder="created, shipped, cancelled"
                            value={(rule.values ?? []).join(', ')}
                            onChange={(e) =>
                              updateRule(col.name, type, {
                                values: e.target.value
                                  .split(',')
                                  .map((v) => v.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
