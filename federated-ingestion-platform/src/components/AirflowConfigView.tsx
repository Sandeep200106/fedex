import { useEffect, useState } from 'react'
import type { AirflowTriggerConfig, ColumnInfo, ConnectionConfig, ConnectionType, FilterOperator, PipelineConfig } from '../types'
import { emptyAirflowTriggerConfig } from '../types'
import {
  CHECK_OBJECT_LABEL,
  airflowConfigDisplayName,
  airflowUiUrl,
  buildAirflowDagConfig,
  mockDagRunTimes,
  requiresCheckColumn,
  sensorOperatorLabel,
  suggestAirflowConfigName,
} from '../data/airflowSensors'
import { IconAirflow } from './icons'
import { pipelineDisplayName } from '../data/dataServices'
import { CONNECTION_TYPES } from '../data/templates'
import { FILTER_OPERATOR_OPTIONS } from '../data/filterOperators'
import { fetchColumns, isIncrementalKeyCandidate } from '../data/schemaIntrospection'
import { downloadJson } from '../utils/download'
import { formatDateTime } from '../utils/format'
import { slugify } from '../utils/slug'
import HelpTip from './HelpTip'

interface AirflowConfigViewProps {
  configs: AirflowTriggerConfig[]
  connections: ConnectionConfig[]
  pipelines: PipelineConfig[]
  onChange: (next: AirflowTriggerConfig[]) => void
  onBuildPipeline: () => void
  // Set when arriving here from "view in Airflow" on a Job History row — focuses the config
  // (or a fresh draft) for that pipeline and surfaces its connection details.
  focusPipelineId?: string | null
  onFocusConsumed?: () => void
}

function connectionTypeLabel(type: ConnectionType | undefined): string {
  return CONNECTION_TYPES.find((t) => t.value === type)?.label ?? (type ?? '—')
}

function ConnectionSummaryCard({ label, connection }: { label: string; connection: ConnectionConfig | undefined }) {
  return (
    <div className="detail-card">
      <div className="detail-card-label">{label}</div>
      {connection ? (
        <>
          <strong>{connection.name}</strong>
          <div className="connection-list-meta">
            {connectionTypeLabel(connection.type)} · {connection.environment}
          </div>
          <div className="hint">
            {connection.host}
            {connection.port ? `:${connection.port}` : ''}
            {connection.database ? ` / ${connection.database}` : ''}
          </div>
        </>
      ) : (
        <span className="hint">Not set on the pipeline.</span>
      )}
    </div>
  )
}

function mockCommitSha(): string {
  return Math.random().toString(16).slice(2, 9)
}

function validate(draft: AirflowTriggerConfig, checkConnectionType: ConnectionType | undefined): string[] {
  const issues: string[] = []
  if (!draft.name) issues.push('name is required')
  if (!draft.check_connection_ref) issues.push('a connection to check is required')
  if (!draft.check_object) issues.push('the location/object to check is required')
  if (checkConnectionType && requiresCheckColumn(checkConnectionType)) {
    if (!draft.check_column) issues.push('a column to check for data availability is required')
    if (draft.check_column && !draft.check_value) issues.push('a value is required for the availability check')
  }
  if (!draft.target_pipeline_id) issues.push('a pipeline to trigger is required')
  if (!draft.schedule.expression) issues.push('cron expression is required')
  if (!draft.poke_interval_seconds || draft.poke_interval_seconds <= 0) issues.push('poke interval must be greater than 0')
  if (!draft.timeout_seconds || draft.timeout_seconds <= draft.poke_interval_seconds) issues.push('timeout must be greater than the poke interval')
  return issues
}

export default function AirflowConfigView({ configs, connections, pipelines, onChange, onBuildPipeline, focusPipelineId, onFocusConsumed }: AirflowConfigViewProps) {
  const [subTab, setSubTab] = useState<'configure' | 'recent'>('configure')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AirflowTriggerConfig>(emptyAirflowTriggerConfig())
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [checkColumns, setCheckColumns] = useState<ColumnInfo[]>([])
  const [checkColumnsLoading, setCheckColumnsLoading] = useState(false)

  const checkConnection = connections.find((c) => c.connection_id === draft.check_connection_ref)
  const targetPipeline = pipelines.find((p) => p.pipeline_id === draft.target_pipeline_id)
  const needsCheckColumn = Boolean(checkConnection && requiresCheckColumn(checkConnection.type))
  const issues = validate(draft, checkConnection?.type)
  const canGenerate = issues.length === 0

  // Suggests the DAG name from whichever of the connection/pipeline are picked — only while
  // the user hasn't typed a name themselves, and never touches the connection/pipeline fields.
  useEffect(() => {
    if (nameManuallyEdited) return
    const suggested = suggestAirflowConfigName(checkConnection?.name, targetPipeline ? pipelineDisplayName(targetPipeline) : undefined)
    if (!suggested) return
    setDraft((prev) => (prev.name === suggested ? prev : { ...prev, name: suggested }))
  }, [checkConnection?.name, targetPipeline, nameManuallyEdited])

  useEffect(() => {
    if (!focusPipelineId) return
    const match = configs.find((c) => c.target_pipeline_id === focusPipelineId)
    if (match) {
      selectForEdit(match)
    } else {
      startNew()
      setDraft((prev) => ({ ...prev, target_pipeline_id: focusPipelineId }))
    }
    setSubTab('configure')
    onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPipelineId])

  useEffect(() => {
    const object = draft.check_object.trim()
    if (!needsCheckColumn || !object) {
      setCheckColumns([])
      return
    }
    setCheckColumnsLoading(true)
    const timer = setTimeout(() => {
      fetchColumns(object, checkConnection?.type)
        .then(setCheckColumns)
        .finally(() => setCheckColumnsLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [draft.check_object, needsCheckColumn, checkConnection?.type])

  function selectForEdit(config: AirflowTriggerConfig) {
    setSelectedId(config.config_id)
    setOriginalId(config.config_id)
    setDraft(config)
    setNameManuallyEdited(true)
  }

  function startNew() {
    setSelectedId(null)
    setOriginalId(null)
    setDraft(emptyAirflowTriggerConfig())
    setNameManuallyEdited(false)
  }

  function handleSave() {
    if (issues.length > 0) return
    // Airflow dag_ids can't contain spaces/commas, so the config_id — which doubles as the
    // dag_id in buildAirflowDagConfig — is always derived as a slug. draft.name stays the
    // freeform human label shown next to it (e.g. in the config list), unslugged.
    const configId = slugify(draft.name.trim())
    const finalized: AirflowTriggerConfig = {
      ...draft,
      config_id: configId,
      git_path: draft.git_path || `airflow/${slugify(configId)}.json`,
    }
    const withoutOriginal = originalId ? configs.filter((c) => c.config_id !== originalId) : configs
    onChange([finalized, ...withoutOriginal])
    setSelectedId(finalized.config_id)
    setOriginalId(finalized.config_id)
    setDraft(finalized)
  }

  function handleDelete(id: string) {
    onChange(configs.filter((c) => c.config_id !== id))
    setConfirmDeleteId(null)
    if (selectedId === id) startNew()
  }

  function commit() {
    if (!originalId) return
    setCommitting(true)
    setTimeout(() => {
      const committedAt = new Date()
      const { lastRunAt, nextRunAt } = mockDagRunTimes(committedAt)
      const updated: AirflowTriggerConfig = {
        ...draft,
        committed: true,
        commit_sha: mockCommitSha(),
        last_committed_at: committedAt.toISOString(),
        last_run_at: lastRunAt,
        next_run_at: nextRunAt,
      }
      onChange(configs.map((c) => (c.config_id === originalId ? updated : c)))
      setDraft(updated)
      setCommitting(false)
    }, 900)
  }

  const isDirty = originalId ? JSON.stringify(configs.find((c) => c.config_id === originalId)) !== JSON.stringify(draft) : true
  const objectLabel = checkConnection ? CHECK_OBJECT_LABEL[checkConnection.type] : undefined
  const previewConfigId = slugify(draft.name.trim())
  const dagConfig = buildAirflowDagConfig({ ...draft, config_id: previewConfigId || draft.config_id }, checkConnection, targetPipeline)

  return (
    <div className="panel connections-panel">
      <div className="panel-header">
        <h2><IconAirflow className="icon-inline" />Airflow scheduling</h2>
        <p>
          Wire up a "check-then-trigger" DAG: poll a location until data is available, then trigger an already-deployed pipeline.
          This is separate from the pipeline's own DAG — it just gates when that pipeline runs.
        </p>
      </div>

      <div className="sub-tabs">
        <button type="button" className={`sub-tab ${subTab === 'configure' ? 'active' : ''}`} onClick={() => setSubTab('configure')}>
          <IconAirflow className="icon-inline" />Build new Airflow
        </button>
        <button type="button" className={`sub-tab ${subTab === 'recent' ? 'active' : ''}`} onClick={() => setSubTab('recent')}>
          <IconAirflow className="icon-inline" />Existing Airflow DAGs
        </button>
      </div>

      {subTab === 'recent' && (
        <RecentDagsPanel configs={configs} pipelines={pipelines} />
      )}

      {subTab === 'configure' && (
      <div className="connections-layout tab-content-in">
        <div className="connections-list">
          <button type="button" className="btn primary small connections-new-btn" onClick={startNew}>
            + New Airflow config
          </button>
          {configs.length === 0 && <p className="hint">No Airflow configs saved yet.</p>}
          {configs.map((c) => {
            const pipeline = pipelines.find((p) => p.pipeline_id === c.target_pipeline_id)
            return (
              <div
                key={c.config_id}
                className={`connection-list-item ${selectedId === c.config_id ? 'active' : ''}`}
                onClick={() => selectForEdit(c)}
              >
                <div className="connection-list-item-info">
                  <strong>{c.name ? airflowConfigDisplayName(c) : '(unnamed)'}</strong>
                  <div className="connection-list-meta">→ {pipeline ? pipelineDisplayName(pipeline) : c.target_pipeline_id || 'no pipeline set'}</div>
                </div>
                {confirmDeleteId === c.config_id ? (
                  <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn small danger" onClick={() => handleDelete(c.config_id)}>
                      Confirm
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(c.config_id)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="connections-editor">
          <div className="section-title">{originalId ? 'Edit Airflow config' : 'New Airflow config'}</div>

          <div className="form-grid">
            <div className="field full">
              <label>Config name</label>
              <input
                value={draft.name}
                placeholder="Check vendor orders file, then trigger merge"
                onChange={(e) => {
                  setDraft({ ...draft, name: e.target.value })
                  setNameManuallyEdited(true)
                }}
              />
              <span className="hint">Suggested from the connection/pipeline picked below — feel free to override it.</span>
            </div>
          </div>

          <div>
            <div className="section-title">
              1. Check data availability
              <HelpTip text="The DAG polls this location on a schedule until the data shows up (or the sensor times out), before moving on to the trigger step." />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Connection to check</label>
                <select
                  value={draft.check_connection_ref}
                  onChange={(e) => setDraft({ ...draft, check_connection_ref: e.target.value, check_object: '', check_column: '' })}
                >
                  <option value="">Select a connection…</option>
                  {connections.map((c) => (
                    <option key={c.connection_id} value={c.connection_id}>
                      {c.name} ({CONNECTION_TYPES.find((t) => t.value === c.type)?.label ?? c.type})
                    </option>
                  ))}
                </select>
                {checkConnection && <span className="hint">Uses: {sensorOperatorLabel(checkConnection.type)}</span>}
              </div>
              <div className="field">
                <label>{objectLabel?.label ?? 'Location to check'}</label>
                <input
                  value={draft.check_object}
                  placeholder={objectLabel?.placeholder ?? 'raw/orders/dt={{ds}}/part-*'}
                  disabled={!draft.check_connection_ref}
                  onChange={(e) => setDraft({ ...draft, check_object: e.target.value })}
                />
              </div>
              {needsCheckColumn && (
                <div className="field">
                  <label>
                    Column to check for data availability
                    <HelpTip text="RDBMS sources have no file to sense — the sensor instead runs a SQL query checking this column (a date/timestamp or sequence column) for a row matching today's run, e.g. WHERE updated_at >= '{{ds}}'." />
                  </label>
                  {checkColumns.length > 0 ? (
                    <select value={draft.check_column ?? ''} onChange={(e) => setDraft({ ...draft, check_column: e.target.value })}>
                      <option value="">Select a column…</option>
                      {checkColumns.filter((c) => isIncrementalKeyCandidate(c.type)).map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={draft.check_column ?? ''}
                      placeholder="updated_at"
                      disabled={!draft.check_object}
                      onChange={(e) => setDraft({ ...draft, check_column: e.target.value })}
                    />
                  )}
                  <span className="hint">{checkColumnsLoading ? 'Fetching columns…' : checkColumns.length > 0 ? `${checkColumns.length} columns found` : 'Columns will be fetched once the table is entered.'}</span>
                </div>
              )}
              {needsCheckColumn && (
                <div className="field">
                  <label>
                    Operator
                    <HelpTip text="Comparison applied to the column above when the sensor's SQL query runs, e.g. WHERE updated_at >= '2024-01-01'." />
                  </label>
                  <select
                    value={draft.check_operator ?? '='}
                    disabled={!draft.check_column}
                    onChange={(e) => setDraft({ ...draft, check_operator: e.target.value as FilterOperator })}
                  >
                    {FILTER_OPERATOR_OPTIONS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <span className="hint">{draft.check_column ? `Filtering on ${draft.check_column}` : 'Set the column above to enable this filter'}</span>
                </div>
              )}
              {needsCheckColumn && (
                <div className="field">
                  <label>Value</label>
                  <select
                    value={draft.check_value === 'current_date' ? 'current_date' : 'custom'}
                    disabled={!draft.check_column}
                    onChange={(e) => setDraft({ ...draft, check_value: e.target.value === 'current_date' ? 'current_date' : '' })}
                  >
                    <option value="custom">Custom…</option>
                    <option value="current_date">current_date</option>
                  </select>
                  {draft.check_value !== 'current_date' && (
                    <input
                      value={draft.check_value ?? ''}
                      placeholder="2024-01-01"
                      disabled={!draft.check_column}
                      onChange={(e) => setDraft({ ...draft, check_value: e.target.value })}
                    />
                  )}
                </div>
              )}
              <div className="field">
                <label>
                  Poke interval (seconds)
                  <HelpTip text="How often the sensor re-checks the location while waiting." />
                </label>
                <input
                  type="number"
                  min={1}
                  value={draft.poke_interval_seconds}
                  onChange={(e) => setDraft({ ...draft, poke_interval_seconds: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>
                  Timeout (seconds)
                  <HelpTip text="How long the sensor keeps checking before giving up and failing the DAG run." />
                </label>
                <input
                  type="number"
                  min={1}
                  value={draft.timeout_seconds}
                  onChange={(e) => setDraft({ ...draft, timeout_seconds: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="section-title">2. Trigger pipeline</div>
            <div className="form-grid">
              <div className="field full">
                <label>Pipeline to trigger</label>
                <select
                  value={draft.target_pipeline_id}
                  onChange={(e) => setDraft({ ...draft, target_pipeline_id: e.target.value })}
                >
                  <option value="">Select a deployed pipeline…</option>
                  {pipelines.map((p) => (
                    <option key={p.pipeline_id} value={p.pipeline_id}>
                      {pipelineDisplayName(p)} ({p.pipeline_id})
                    </option>
                  ))}
                </select>
                {pipelines.length === 0 && (
                  <div className="warning-banner">
                    No pipelines built yet.
                    <button type="button" className="btn small primary" onClick={onBuildPipeline}>
                      Build a pipeline
                    </button>
                  </div>
                )}
                {targetPipeline && (
                  <span className="hint">
                    Triggers dag_id "{targetPipeline.pipeline_id}" — normally runs on {targetPipeline.schedule.expression} (
                    {targetPipeline.schedule.timezone}).
                  </span>
                )}
              </div>
            </div>
            {targetPipeline && (
              <div className="detail-cards">
                <ConnectionSummaryCard
                  label="Pipeline source connection"
                  connection={connections.find((c) => c.connection_id === targetPipeline.source.connection_ref)}
                />
                <ConnectionSummaryCard
                  label="Pipeline target connection"
                  connection={connections.find((c) => c.connection_id === targetPipeline.target.connection_ref)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="section-title">DAG schedule &amp; ownership</div>
            <div className="form-grid">
              <div className="field">
                <label>
                  Cron expression
                  <HelpTip text="How often this check-then-trigger DAG itself runs — independent of the triggered pipeline's own schedule." />
                </label>
                <input
                  value={draft.schedule.expression}
                  placeholder="*/15 * * * *"
                  onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, expression: e.target.value } })}
                />
              </div>
              <div className="field">
                <label>Timezone</label>
                <input
                  value={draft.schedule.timezone}
                  placeholder="Asia/Kolkata"
                  onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, timezone: e.target.value } })}
                />
              </div>
              <div className="field">
                <label>Owner</label>
                <input value={draft.owner} placeholder="data-engineering" onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
              </div>
              <div className="field">
                <label>Git path</label>
                <input
                  value={draft.git_path}
                  placeholder={`airflow/${slugify(draft.name || 'config_name')}.json`}
                  onChange={(e) => setDraft({ ...draft, git_path: e.target.value })}
                />
              </div>
            </div>
          </div>

          {issues.length > 0 && <div className="warning-banner">Fix the following: {issues.join(' · ')}</div>}

          <div className="row-actions">
            <button type="button" className="btn primary" onClick={handleSave} disabled={!isDirty || !canGenerate}>
              {originalId ? 'Save changes' : 'Save Airflow config'}
            </button>
            {originalId && (
              <button type="button" className="btn ghost" onClick={() => selectForEdit(configs.find((c) => c.config_id === originalId)!)}>
                Revert
              </button>
            )}
          </div>

          <div className="json-card">
            <div className="json-card-head">
              <strong>Generated DAG config</strong>
              <button
                type="button"
                className="btn small"
                disabled={!canGenerate}
                onClick={() => downloadJson(`${slugify(previewConfigId) || 'airflow_config'}.json`, dagConfig)}
              >
                Download
              </button>
            </div>
            <pre>{JSON.stringify(dagConfig, null, 2)}</pre>
          </div>

          <div className="deploy-section">
            <div className="section-title">Deploy (mock — no backend yet)</div>
            <div className="row-actions">
              <button type="button" className="btn" disabled={!canGenerate || committing || isDirty || !originalId} onClick={commit}>
                {committing ? 'Committing…' : draft.commit_sha ? 'Re-commit to GitHub' : 'Commit to GitHub'}
              </button>
              {draft.commit_sha && (
                <span className="hint">
                  Mock commit {draft.commit_sha} to {draft.git_path || `airflow/${slugify(previewConfigId)}.json`} — last committed{' '}
                  {formatDateTime(draft.last_committed_at ?? null)}. See it on the <strong>Existing Airflow DAGs</strong> tab.
                </span>
              )}
            </div>
            {!draft.commit_sha && (
              <span className="hint">
                {!originalId
                  ? 'Save this config before it can be committed.'
                  : isDirty
                    ? 'Save your changes before committing.'
                    : 'Commit before Airflow would pick this DAG up — matches UI → Config API → GitHub → Airflow.'}
              </span>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function RecentDagsPanel({
  configs,
  pipelines,
}: {
  configs: AirflowTriggerConfig[]
  pipelines: PipelineConfig[]
}) {
  const committed = configs
    .filter((c) => c.committed)
    .sort((a, b) => (a.last_committed_at ?? '') < (b.last_committed_at ?? '') ? 1 : -1)

  return (
    <div className="panel-body tab-content-in">
      <p className="hint" style={{ marginBottom: 12 }}>
        DAGs that have been committed from the Build new Airflow tab. No real Airflow instance is wired up yet, so the DAG link
        below is a placeholder (airflow.example.com) rather than a live grid view, and last/next run are mocked.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>DAG</th>
            <th>Triggers pipeline</th>
            <th>Schedule</th>
            <th>Last run</th>
            <th>Next run</th>
            <th>Commit</th>
            <th>Airflow link</th>
          </tr>
        </thead>
        <tbody>
          {committed.map((c) => {
            const pipeline = pipelines.find((p) => p.pipeline_id === c.target_pipeline_id)
            return (
              <tr key={c.config_id}>
                <td>{airflowConfigDisplayName(c)}</td>
                <td>{pipeline ? pipelineDisplayName(pipeline) : c.target_pipeline_id || '—'}</td>
                <td className="mono">{c.schedule.expression}</td>
                <td>{formatDateTime(c.last_run_at ?? null)}</td>
                <td>{formatDateTime(c.next_run_at ?? null)}</td>
                <td className="mono">{c.commit_sha ?? '—'}</td>
                <td>
                  <a className="link-button" href={airflowUiUrl(c.config_id)} target="_blank" rel="noopener noreferrer">
                    <IconAirflow className="icon-inline" />Open in Airflow
                  </a>
                </td>
              </tr>
            )
          })}
          {committed.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                No DAGs committed yet — commit a config from the Build new Airflow tab to see it here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
