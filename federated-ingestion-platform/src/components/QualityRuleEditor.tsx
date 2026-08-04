import type { QualityRule, QualityRuleType } from '../types'
import { QUALITY_RULE_LABELS, QUALITY_RULE_TYPES, emptyQualityRule, explainRule } from '../data/qualityRules'
import HelpTip from './HelpTip'

interface QualityRuleEditorProps {
  fields: string[]
  rules: QualityRule[]
  onRulesChange: (next: QualityRule[]) => void
}

export default function QualityRuleEditor({ fields, rules, onRulesChange }: QualityRuleEditorProps) {
  function addRule() {
    const used = new Set(rules.map((r) => r.field))
    const nextField = fields.find((f) => !used.has(f)) ?? fields[0] ?? ''
    onRulesChange([...rules, emptyQualityRule(nextField)])
  }

  function updateRule(index: number, patch: Partial<QualityRule>) {
    onRulesChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function changeType(index: number, type: QualityRuleType) {
    if (type === 'range') updateRule(index, { rule: type, min: 0, max: 100, pattern: undefined, values: undefined })
    else if (type === 'length') updateRule(index, { rule: type, min: 0, max: 255, pattern: undefined, values: undefined })
    else if (type === 'regex') updateRule(index, { rule: type, pattern: '', min: undefined, max: undefined, values: undefined })
    else if (type === 'allowed_values') updateRule(index, { rule: type, values: [], min: undefined, max: undefined, pattern: undefined })
    else updateRule(index, { rule: type, min: undefined, max: undefined, pattern: undefined, values: undefined })
  }

  function removeRule(index: number) {
    onRulesChange(rules.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <div className="section-title">
          Quality rules
          <HelpTip text="Null check flags missing values, range checks a numeric bound, regex checks a pattern match, allowed values checks set membership, and unique flags duplicate values for that field across records." />
        </div>
        <button type="button" className="btn small" onClick={addRule}>
          + Add rule
        </button>
      </div>

      {rules.length === 0 && <p className="hint">No quality rules added yet. Add one to start validating field values on every run.</p>}

      {rules.map((rule, i) => (
        <div className="transform-card" key={i}>
          <div className="transform-card-head">
            {fields.length > 0 ? (
              <select value={rule.field} onChange={(e) => updateRule(i, { field: e.target.value })}>
                <option value="">Select a column…</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input value={rule.field} placeholder="order_id" onChange={(e) => updateRule(i, { field: e.target.value })} />
            )}
            <select value={rule.rule} onChange={(e) => changeType(i, e.target.value as QualityRuleType)}>
              {QUALITY_RULE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUALITY_RULE_LABELS[type]}
                </option>
              ))}
            </select>
            <button type="button" className="btn small danger" onClick={() => removeRule(i)}>
              Remove
            </button>
          </div>

          {rule.rule === 'range' && (
            <div className="form-grid">
              <div className="field">
                <label>Min</label>
                <input
                  type="number"
                  value={rule.min ?? ''}
                  onChange={(e) => updateRule(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Max</label>
                <input
                  type="number"
                  value={rule.max ?? ''}
                  onChange={(e) => updateRule(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {rule.rule === 'length' && (
            <div className="form-grid">
              <div className="field">
                <label>Min length</label>
                <input
                  type="number"
                  min={0}
                  value={rule.min ?? ''}
                  onChange={(e) => updateRule(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Max length</label>
                <input
                  type="number"
                  min={0}
                  value={rule.max ?? ''}
                  onChange={(e) => updateRule(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {rule.rule === 'regex' && (
            <div className="field full">
              <label>Pattern</label>
              <input
                value={rule.pattern ?? ''}
                placeholder="^[^@]+@[^@]+\.[^@]+$"
                onChange={(e) => updateRule(i, { pattern: e.target.value })}
              />
            </div>
          )}

          {rule.rule === 'allowed_values' && (
            <div className="field full">
              <label>Allowed values (comma separated)</label>
              <input
                value={(rule.values ?? []).join(', ')}
                placeholder="created, shipped, cancelled"
                onChange={(e) =>
                  updateRule(i, {
                    values: e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          )}

          <p className="hint">{explainRule(rule)}</p>
        </div>
      ))}
    </div>
  )
}
