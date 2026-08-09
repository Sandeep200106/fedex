import type { ColumnInfo, ColumnMapping, ConnectionType, ExtractionMode, FileFormat, FilterOperator, LoadMode, PipelineSource, PipelineTarget } from '../types'
import { FILE_FORMAT_OPTIONS, LOAD_MODE_OPTIONS, SOURCE_OBJECT_CONFIG, TARGET_OBJECT_CONFIG } from '../data/templates'
import { isIncrementalKeyCandidate } from '../data/schemaIntrospection'
import { ALLOWED_DELIVERY_PATTERNS_BY_EXTRACTION_MODE } from '../data/deliveryPatterns'
import { FILTER_OPERATOR_OPTIONS } from '../data/filterOperators'
import HelpTip from './HelpTip'
import ColumnMappingBoard from './ColumnMappingBoard'

interface MappingStepProps {
  sourceType: ConnectionType
  targetType: ConnectionType
  source: PipelineSource
  target: PipelineTarget
  mapping: ColumnMapping[]
  sourceColumns: ColumnInfo[]
  targetColumns: ColumnInfo[]
  sourceColumnsLoading: boolean
  targetColumnsLoading: boolean
  sourceObjects: string[]
  targetObjects: string[]
  sourceObjectsLoading: boolean
  targetObjectsLoading: boolean
  onSourceChange: (next: PipelineSource) => void
  onTargetChange: (next: PipelineTarget) => void
  onMappingChange: (next: ColumnMapping[]) => void
}

const TYPE_OPTIONS = ['string', 'integer', 'decimal(12,2)', 'boolean', 'timestamp', 'date']

export default function MappingStep({
  sourceType,
  targetType,
  source,
  target,
  mapping,
  sourceColumns,
  targetColumns,
  sourceColumnsLoading,
  targetColumnsLoading,
  sourceObjects,
  targetObjects,
  sourceObjectsLoading,
  targetObjectsLoading,
  onSourceChange,
  onTargetChange,
  onMappingChange,
}: MappingStepProps) {
  const sourceObjectConfig = SOURCE_OBJECT_CONFIG[sourceType]
  const targetObjectConfig = TARGET_OBJECT_CONFIG[targetType]

  function addRow() {
    const used = new Set(mapping.map((m) => m.source_column))
    const next = sourceColumns.find((c) => !used.has(c.name))
    onMappingChange([
      ...mapping,
      { source_column: next?.name ?? '', target_column: next?.name ?? '', type: next?.type ?? 'string' },
    ])
  }

  function updateRow(index: number, patch: Partial<ColumnMapping>) {
    onMappingChange(mapping.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    onMappingChange(mapping.filter((_, i) => i !== index))
  }

  function selectSourceColumn(index: number, name: string) {
    const column = sourceColumns.find((c) => c.name === name)
    updateRow(index, { source_column: name, type: column?.type ?? mapping[index].type })
  }

  const needsCursor = source.extraction_mode !== 'full'

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Object &amp; column mapping</h2>
        <p>Pick the source object and target table, then map columns. This becomes the source/target/mapping block of the pipeline config.</p>
      </div>

      <div>
        <div className="section-title">Source object</div>
        <div className="form-grid">
          <div className="field">
            <label>{sourceObjectConfig.label}</label>
            {sourceObjectsLoading ? (
              <input value="" placeholder="Loading available objects…" disabled />
            ) : sourceObjects.length > 0 ? (
              <select value={source.object} onChange={(e) => onSourceChange({ ...source, object: e.target.value })}>
                <option value="">Select…</option>
                {sourceObjects.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={source.object}
                placeholder={sourceObjectConfig.placeholder}
                onChange={(e) => onSourceChange({ ...source, object: e.target.value })}
              />
            )}
            <span className="hint">
              {sourceColumnsLoading
                ? 'Fetching columns…'
                : sourceColumns.length > 0
                  ? `${sourceColumns.length} columns found`
                  : 'Columns will be fetched once an object is entered.'}
            </span>
          </div>
          <div className="field">
            <label>
              Extraction mode
              <HelpTip text="full re-reads everything each run. incremental uses the incremental key to pull only new/changed rows. cdc streams row-level change events (inserts/updates/deletes), as used by the Kafka source." />
            </label>
            <select
              value={source.extraction_mode}
              onChange={(e) => {
                const extraction_mode = e.target.value as ExtractionMode
                const allowed = ALLOWED_DELIVERY_PATTERNS_BY_EXTRACTION_MODE[extraction_mode]
                const delivery_pattern = allowed.includes(source.delivery_pattern) ? source.delivery_pattern : allowed[0]
                onSourceChange({ ...source, extraction_mode, delivery_pattern })
              }}
            >
              <option value="full">full</option>
              <option value="incremental">incremental</option>
              <option value="cdc">cdc</option>
            </select>
          </div>
          {needsCursor && (
            <div className="field">
              <label>
                Incremental key
                <HelpTip text="The column used to detect new or changed rows since the last run — must be a timestamp/date column or an integer sequence/ID, since only monotonically increasing values make a valid high-water mark. The filter below is applied on this same column." />
              </label>
              {sourceColumns.length > 0 ? (
                <select
                  value={source.cursor_column}
                  onChange={(e) => onSourceChange({ ...source, cursor_column: e.target.value, filter_column: e.target.value })}
                >
                  <option value="">Select a column…</option>
                  {sourceColumns.filter((c) => isIncrementalKeyCandidate(c.type)).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={source.cursor_column}
                  placeholder="updated_dt"
                  onChange={(e) => onSourceChange({ ...source, cursor_column: e.target.value, filter_column: e.target.value })}
                />
              )}
            </div>
          )}
          {source.extraction_mode !== 'full' && (
            <>
              <div className="field">
                <label>
                  Operator
                  <HelpTip text="Filter applied on every extraction run using the incremental key above, e.g. WHERE updated_at >= '2024-01-01'. Requires the incremental key to be set." />
                </label>
                <select
                  value={source.filter_operator ?? '='}
                  disabled={!source.cursor_column}
                  onChange={(e) => onSourceChange({ ...source, filter_operator: e.target.value as FilterOperator })}
                >
                  {FILTER_OPERATOR_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  {source.cursor_column ? `Filtering on ${source.cursor_column}` : 'Set the incremental key to enable this filter'}
                </span>
              </div>
              <div className="field">
                <label>Value</label>
                <select
                  value={source.filter_value === 'current_date' ? 'current_date' : 'custom'}
                  disabled={!source.cursor_column}
                  onChange={(e) =>
                    onSourceChange({ ...source, filter_value: e.target.value === 'current_date' ? 'current_date' : '' })
                  }
                >
                  <option value="custom">Custom…</option>
                  <option value="current_date">current_date</option>
                </select>
                {source.filter_value !== 'current_date' && (
                  <input
                    value={source.filter_value ?? ''}
                    placeholder="2024-01-01"
                    disabled={!source.cursor_column}
                    onChange={(e) => onSourceChange({ ...source, filter_value: e.target.value })}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="section-title">Target object</div>
        <div className="form-grid">
          {targetObjectConfig.showSchema && (
            <div className="field">
              <label>{targetObjectConfig.schemaLabel}</label>
              <input
                value={target.schema}
                placeholder={targetObjectConfig.schemaPlaceholder}
                onChange={(e) => onTargetChange({ ...target, schema: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label>{targetObjectConfig.tableLabel}</label>
            {targetObjectsLoading ? (
              <input value="" placeholder="Loading available objects…" disabled />
            ) : targetObjects.length > 0 ? (
              <select value={target.table} onChange={(e) => onTargetChange({ ...target, table: e.target.value })}>
                <option value="">Select…</option>
                {targetObjects.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={target.table}
                placeholder={targetObjectConfig.tablePlaceholder}
                onChange={(e) => onTargetChange({ ...target, table: e.target.value })}
              />
            )}
            <span className="hint">
              {targetColumnsLoading
                ? 'Fetching columns…'
                : targetColumns.length > 0
                  ? `${targetColumns.length} existing columns found`
                  : 'No existing schema — target columns are free text.'}
            </span>
          </div>
          {targetObjectConfig.showFileFormat && (
            <div className="field">
              <label>
                File format
                <HelpTip text="The file format written for each generated object. Parquet/Avro/ORC are compact and typed; CSV/JSON are more universally readable." />
              </label>
              <select value={target.file_format ?? ''} onChange={(e) => onTargetChange({ ...target, file_format: e.target.value as FileFormat })}>
                <option value="">Select a format…</option>
                {FILE_FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <span className="hint">Format the pipeline writes each generated file in.</span>
            </div>
          )}
          {targetObjectConfig.showLoadMode && (
            <div className="field">
              <label>
                Load mode
                <HelpTip text="insert adds new rows without touching existing ones. update & merge upserts by key (updates matches, inserts the rest). truncate & insert replaces the entire target each run." />
              </label>
              <select value={target.load_mode ?? ''} onChange={(e) => onTargetChange({ ...target, load_mode: e.target.value as LoadMode })}>
                {LOAD_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {!targetObjectConfig.showFileFormat && (
        <div>
          <div className="row-actions" style={{ justifyContent: 'space-between' }}>
            <div className="section-title">Column mapping</div>
            {!(sourceColumns.length > 0 && targetColumns.length > 0) && (
              <button type="button" className="btn small" onClick={addRow}>
                + Add column
              </button>
            )}
          </div>

          {sourceColumns.length > 0 && targetColumns.length > 0 ? (
            <ColumnMappingBoard
              sourceColumns={sourceColumns}
              targetColumns={targetColumns}
              mapping={mapping}
              onMappingChange={onMappingChange}
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Source column</th>
                  <th>Target column</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((row, i) => (
                  <tr key={i}>
                    <td>
                      {sourceColumns.length > 0 ? (
                        <select value={row.source_column} onChange={(e) => selectSourceColumn(i, e.target.value)}>
                          <option value="">Select…</option>
                          {sourceColumns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={row.source_column}
                          placeholder="order_id"
                          onChange={(e) => updateRow(i, { source_column: e.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      {targetColumns.length > 0 ? (
                        <select value={row.target_column} onChange={(e) => updateRow(i, { target_column: e.target.value })}>
                          <option value="">Select…</option>
                          {targetColumns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={row.target_column}
                          placeholder="ORDER_ID"
                          onChange={(e) => updateRow(i, { target_column: e.target.value })}
                        />
                      )}
                    </td>
                    <td>
                      <select value={row.type} onChange={(e) => updateRow(i, { type: e.target.value })}>
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button type="button" className="btn small danger" onClick={() => removeRow(i)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {mapping.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                      No columns mapped yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
