import { Fragment, useEffect, useState } from 'react'
import type { ColumnInfo, ConnectionConfig, ConnectionType, DqExecution, DqRuleSet, DqSourceKind } from '../types'
import { emptyDqRuleSet, evaluateToday } from '../data/dataQuality'
import { buildDqSelectSql } from '../data/dqSqlGenerator'
import { QUALITY_RULE_LABELS } from '../data/qualityRules'
import { deriveFileObjectKey, fetchColumns } from '../data/schemaIntrospection'
import {
  buildDedupAnalysisPrompt,
  buildDqFailureAnalysisPrompt,
  buildFileCheckAnalysisPrompt,
  buildSchemaDriftAnalysisPrompt,
  callLlm,
  getLlmSettings,
  isLlmConfigured,
  mockDedupAnalysis,
  mockDqFailureAnalysis,
  mockFileCheckAnalysis,
  mockSchemaDriftAnalysis,
} from '../rag/llmClient'
import { formatBytes, formatDate, formatDateTime } from '../utils/format'
import { slugify } from '../utils/slug'
import FileSizeChart from './FileSizeChart'
import QualityRuleEditor from './QualityRuleEditor'
import ColumnRulesGrid from './ColumnRulesGrid'
import CustomSqlChecks from './CustomSqlChecks'
import AccordionToggle from './AccordionToggle'
import HelpTip from './HelpTip'
import Modal from './Modal'
import QualityPatternsView from './QualityPatternsView'
import CaseStudyDqCoverageView from './CaseStudyDqCoverageView'
import type { FrameworkRule } from '../data/dqFramework'
import type { RuleSuggestion } from '../rag/llmClient'

interface DataQualityViewProps {
  ruleSets: DqRuleSet[]
  executions: DqExecution[]
  connections: ConnectionConfig[]
  onChange: (next: DqRuleSet[]) => void
  onRunNow: (pipelineId: string) => void
  frameworkRules: FrameworkRule[]
  onAdoptIntoFramework: (patternKey: string, suggestion: RuleSuggestion) => void
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pass: 'status-success',
  warning: 'status-warning',
  fail: 'status-failed',
  pending: 'status-queued',
}

const TABLE_CONNECTION_TYPES: ConnectionType[] = ['bigquery']
const FILE_CONNECTION_TYPES: ConnectionType[] = ['gcs']

const DEFAULT_PIPELINE_ID = 'pl_orders_feed_gcs'

function useTableColumns(schema: string, table: string, connType: ConnectionType | undefined, enabled: boolean) {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setColumns([])
      return
    }
    const object = [schema, table].filter(Boolean).join('.') || table
    if (!object.trim()) {
      setColumns([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      fetchColumns(object, connType)
        .then(setColumns)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [schema, table, connType, enabled])

  return { columns, loading }
}

// Files have no table name to fetch columns for — derive an equivalent lookup key from
// the path (see deriveFileObjectKey) so schema-drift baseline/columns work the same way
// for file sources as they do for tables.
function useFileColumns(filePath: string, connType: ConnectionType | undefined, enabled: boolean) {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const object = deriveFileObjectKey(filePath)
    if (!enabled || !object) {
      setColumns([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      fetchColumns(object, connType)
        .then(setColumns)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [filePath, connType, enabled])

  return { columns, loading }
}

interface DqAnalysis {
  loading: boolean
  text?: string
  isMock?: boolean
}

export default function DataQualityView({
  ruleSets,
  executions,
  connections,
  onChange,
  onRunNow,
  frameworkRules,
  onAdoptIntoFramework,
}: DataQualityViewProps) {
  const [selectedId, setSelectedId] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [step, setStep] = useState<'details' | 'rules' | 'review'>('details')
  const [draft, setDraft] = useState<DqRuleSet>(emptyDqRuleSet())
  const [issues, setIssues] = useState<string[]>([])
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null)
  const [showCoverageHelp, setShowCoverageHelp] = useState(false)
  const [showGeneratedSql, setShowGeneratedSql] = useState(false)
  const [dqAnalyses, setDqAnalyses] = useState<Record<string, DqAnalysis>>({})
  const [driftAnalyses, setDriftAnalyses] = useState<Record<string, DqAnalysis>>({})
  const [dedupAnalyses, setDedupAnalyses] = useState<Record<string, DqAnalysis>>({})
  const [fileCheckAnalyses, setFileCheckAnalyses] = useState<Record<string, DqAnalysis>>({})

  const existing = ruleSets.find((r) => r.pipeline_id === selectedId)
  const selected = isNew ? draft : existing

  const pipelineDropdownOptions = [...ruleSets].sort((a, b) => {
    if (a.pipeline_id === DEFAULT_PIPELINE_ID) return -1
    if (b.pipeline_id === DEFAULT_PIPELINE_ID) return 1
    return 0
  })

  const selectedConnection = connections.find((c) => c.connection_id === selected?.connection_ref)
  const { columns, loading: columnsLoading } = useTableColumns(
    selected?.table_schema ?? '',
    selected?.table_name ?? '',
    selectedConnection?.type,
    selected?.source_kind === 'table',
  )
  const { columns: fileColumns } = useFileColumns(selected?.file_path ?? '', selectedConnection?.type, selected?.source_kind === 'file')
  const availableColumns = selected?.source_kind === 'table' ? columns : fileColumns

  function goToPipeline(pipelineId: string) {
    setIsNew(false)
    setSelectedId(pipelineId)
  }

  function updateSelected(patch: Partial<DqRuleSet>) {
    if (isNew) {
      setDraft((prev) => ({ ...prev, ...patch }))
    } else if (existing) {
      onChange(ruleSets.map((r) => (r.pipeline_id === existing.pipeline_id ? { ...r, ...patch } : r)))
    }
  }

  function selectSourceKind(kind: DqSourceKind) {
    if (kind === 'table') {
      updateSelected({ source_kind: 'table', connection_ref: '', file_presence_enabled: false, file_size_check_enabled: false })
    } else {
      updateSelected({
        source_kind: 'file',
        connection_ref: '',
        table_schema: '',
        table_name: '',
        file_presence_enabled: true,
        file_size_check_enabled: true,
      })
    }
  }

  function startOnboarding() {
    setIsNew(true)
    setStep('details')
    setDraft(emptyDqRuleSet())
    setIssues([])
    setReviewConfirmed(false)
  }

  function cancelOnboarding() {
    setIsNew(false)
    setStep('details')
    setIssues([])
    setReviewConfirmed(false)
  }

  function goToRules() {
    const validationIssues: string[] = []
    if (!draft.pipeline_label.trim()) validationIssues.push('pipeline name is required')
    if (!draft.connection_ref) validationIssues.push('a connection is required')
    if (draft.source_kind === 'table') {
      if (!draft.table_name.trim()) validationIssues.push('table name is required')
      else if (columnsLoading) validationIssues.push('still fetching columns — wait a moment and try again')
      else if (columns.length === 0) validationIssues.push('no columns found for this table')
    }
    if (draft.source_kind === 'file' && !draft.file_path.trim()) validationIssues.push('file path is required')
    if (validationIssues.length > 0) {
      setIssues(validationIssues)
      return
    }
    setIssues([])
    setStep('rules')
  }

  function backToDetails() {
    setIssues([])
    setStep('details')
  }

  function goToReview() {
    const validationIssues: string[] = []
    if (draft.quality_rules.length === 0) validationIssues.push('select at least one column rule')
    if (validationIssues.length > 0) {
      setIssues(validationIssues)
      return
    }
    setIssues([])
    setReviewConfirmed(false)
    setStep('review')
  }

  function backToRules() {
    setIssues([])
    setStep('rules')
  }

  function saveOnboarding() {
    const validationIssues: string[] = []
    if (!draft.pipeline_label.trim()) validationIssues.push('pipeline name is required')
    if (!draft.connection_ref) validationIssues.push('a connection is required')
    if (draft.source_kind === 'table' && !draft.table_name.trim()) validationIssues.push('table name is required')
    if (draft.source_kind === 'file' && !draft.file_path.trim()) validationIssues.push('file path is required')
    if (draft.source_kind === 'table' && draft.quality_rules.length === 0) validationIssues.push('select at least one column rule')
    if (draft.source_kind === 'table' && !reviewConfirmed) validationIssues.push('review and approve the generated queries before onboarding')
    if (!draft.schedule.expression.trim()) validationIssues.push('a schedule is required')
    const pipelineId = `pl_${slugify(draft.pipeline_label)}`
    if (!validationIssues.length && ruleSets.some((r) => r.pipeline_id === pipelineId)) {
      validationIssues.push('a monitored pipeline with this name already exists')
    }
    if (validationIssues.length > 0) {
      setIssues(validationIssues)
      return
    }

    const finalized: DqRuleSet = { ...draft, pipeline_id: pipelineId }
    onChange([...ruleSets, finalized])
    setIsNew(false)
    setStep('details')
    setSelectedId(pipelineId)
    setIssues([])
    setReviewConfirmed(false)
  }

  async function analyzeDqFailure(exec: DqExecution) {
    if (!exec.rule_failures || exec.rule_failures.length === 0 || !existing) return
    const pipelineLabel = existing.pipeline_label
    setDqAnalyses((prev) => ({ ...prev, [exec.id]: { loading: true } }))
    const settings = getLlmSettings()

    if (isLlmConfigured(settings)) {
      try {
        const text = await callLlm(settings, buildDqFailureAnalysisPrompt(pipelineLabel, exec.rule_failures))
        setDqAnalyses((prev) => ({ ...prev, [exec.id]: { loading: false, text, isMock: false } }))
        return
      } catch {
        // fall through to the mock analyzer below
      }
    }

    const mock = mockDqFailureAnalysis(pipelineLabel, exec.rule_failures)
    setDqAnalyses((prev) => ({
      ...prev,
      [exec.id]: { loading: false, text: `Issue: ${mock.issue}\n\nResolution: ${mock.resolution}`, isMock: true },
    }))
  }

  async function analyzeSchemaDrift(exec: DqExecution) {
    if (!exec.schema_drift_details || exec.schema_drift_details.length === 0 || !existing) return
    const pipelineLabel = existing.pipeline_label
    setDriftAnalyses((prev) => ({ ...prev, [exec.id]: { loading: true } }))
    const settings = getLlmSettings()

    if (isLlmConfigured(settings)) {
      try {
        const text = await callLlm(settings, buildSchemaDriftAnalysisPrompt(pipelineLabel, exec.schema_drift_details))
        setDriftAnalyses((prev) => ({ ...prev, [exec.id]: { loading: false, text, isMock: false } }))
        return
      } catch {
        // fall through to the mock analyzer below
      }
    }

    const mock = mockSchemaDriftAnalysis(pipelineLabel, exec.schema_drift_details)
    setDriftAnalyses((prev) => ({
      ...prev,
      [exec.id]: { loading: false, text: `Issue: ${mock.issue}\n\nResolution: ${mock.resolution}`, isMock: true },
    }))
  }

  async function analyzeDedup(exec: DqExecution) {
    if (!exec.dedup_details || exec.dedup_details.length === 0 || !existing) return
    const pipelineLabel = existing.pipeline_label
    setDedupAnalyses((prev) => ({ ...prev, [exec.id]: { loading: true } }))
    const settings = getLlmSettings()

    if (isLlmConfigured(settings)) {
      try {
        const text = await callLlm(settings, buildDedupAnalysisPrompt(pipelineLabel, exec.dedup_details))
        setDedupAnalyses((prev) => ({ ...prev, [exec.id]: { loading: false, text, isMock: false } }))
        return
      } catch {
        // fall through to the mock analyzer below
      }
    }

    const mock = mockDedupAnalysis(pipelineLabel, exec.dedup_details)
    setDedupAnalyses((prev) => ({
      ...prev,
      [exec.id]: { loading: false, text: `Issue: ${mock.issue}\n\nResolution: ${mock.resolution}`, isMock: true },
    }))
  }

  async function analyzeFileCheck(exec: DqExecution) {
    if (!existing) return
    const pipelineLabel = existing.pipeline_label
    setFileCheckAnalyses((prev) => ({ ...prev, [exec.id]: { loading: true } }))
    const settings = getLlmSettings()

    if (isLlmConfigured(settings)) {
      try {
        const text = await callLlm(settings, buildFileCheckAnalysisPrompt(pipelineLabel, exec.message))
        setFileCheckAnalyses((prev) => ({ ...prev, [exec.id]: { loading: false, text, isMock: false } }))
        return
      } catch {
        // fall through to the mock analyzer below
      }
    }

    const mock = mockFileCheckAnalysis(exec.message)
    setFileCheckAnalyses((prev) => ({
      ...prev,
      [exec.id]: { loading: false, text: `Issue: ${mock.issue}\n\nResolution: ${mock.resolution}`, isMock: true },
    }))
  }

  const coverageHelpButton = (
    <button type="button" className="btn small ghost" onClick={() => setShowCoverageHelp(true)}>
      Help: DQ checks per ingestion pattern
    </button>
  )

  const coverageHelpModal = showCoverageHelp && (
    <Modal title="Help" onClose={() => setShowCoverageHelp(false)}>
      <CaseStudyDqCoverageView rules={frameworkRules} />
    </Modal>
  )

  if (!isNew && ruleSets.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h2>Data quality</h2>
          <p>No monitored sources yet. Onboard a table or a file below to define quality rules and checks.</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={startOnboarding}>
            + Onboard new source
          </button>
          {coverageHelpButton}
        </div>
        <QualityPatternsView
          executions={executions}
          ruleSets={ruleSets}
          frameworkRules={frameworkRules}
          onAdoptIntoFramework={onAdoptIntoFramework}
          onNavigateToPipeline={goToPipeline}
        />
        {coverageHelpModal}
      </div>
    )
  }

  if (!isNew && !selected) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h2>Data quality</h2>
          <p>Onboard a BigQuery table or a GCS file, then define field-level rules and (for files) presence/size checks.</p>
        </div>
        <div className="field" style={{ maxWidth: 380 }}>
          <label>Pipeline</label>
          <select value="" onChange={(e) => setSelectedId(e.target.value)}>
            <option value="" disabled>
              Select a pipeline…
            </option>
            {pipelineDropdownOptions.map((r) => (
              <option key={r.pipeline_id} value={r.pipeline_id}>
                {r.pipeline_label}
              </option>
            ))}
          </select>
          <span className="hint">Select a pipeline above to view its checks and execution history.</span>
        </div>
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={startOnboarding}>
            + Onboard new source
          </button>
          {coverageHelpButton}
        </div>
        <QualityPatternsView
          executions={executions}
          ruleSets={ruleSets}
          frameworkRules={frameworkRules}
          onAdoptIntoFramework={onAdoptIntoFramework}
          onNavigateToPipeline={goToPipeline}
        />
        {coverageHelpModal}
      </div>
    )
  }

  if (!selected) {
    return null
  }

  const evaluation = evaluateToday(selected)
  const pipelineExecutions = executions
    .filter((e) => e.pipeline_id === selected.pipeline_id)
    .sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1))

  const kindConnectionTypes = draft.source_kind === 'table' ? TABLE_CONNECTION_TYPES : FILE_CONNECTION_TYPES
  const availableConnections = connections.filter((c) => kindConnectionTypes.includes(c.type))
  const showRulesSection = !isNew || step === 'rules'
  const showTableRulesEditor = selected.source_kind === 'table' && (!isNew || step === 'rules')
  const showTableSqlSection = selected.source_kind === 'table' && (!isNew || step === 'rules' || step === 'review')

  const generatedSql = selected.source_kind === 'table' ? buildDqSelectSql(selected, selectedConnection?.type) : ''

  const schemaDriftCard = (
    <div className="transform-card">
      <div className="transform-card-head">
        <AccordionToggle
          label="Schema drift detection"
          expanded={selected.schema_drift_check_enabled}
          onToggle={() => updateSelected({ schema_drift_check_enabled: !selected.schema_drift_check_enabled })}
        />
        <HelpTip text="Compares each run's schema against a captured baseline. Column removals or type changes break downstream mapping and are treated as a hard failure; added columns are usually additive and only flagged as a warning." />
      </div>
      {selected.schema_drift_check_enabled && (
        <>
          <div className="form-grid">
            <div className="field full">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selected.schema_drift_config.compare_types}
                  onChange={(e) =>
                    updateSelected({ schema_drift_config: { ...selected.schema_drift_config, compare_types: e.target.checked } })
                  }
                />
                Also flag column type changes
              </label>
            </div>
          </div>
          <p className="hint">
            {selected.schema_baseline.length > 0
              ? `Baseline captured: ${selected.schema_baseline.length} columns.`
              : 'No baseline captured yet — the next check captures one.'}
          </p>
        </>
      )}
    </div>
  )

  const dedupCard = (
    <div className="transform-card">
      <div className="transform-card-head">
        <AccordionToggle
          label="Dedup / golden-record merge"
          expanded={selected.dedup_check_enabled}
          onToggle={() => updateSelected({ dedup_check_enabled: !selected.dedup_check_enabled })}
        />
        <HelpTip text="Checks the target for duplicate golden-record keys on an ongoing schedule — independent of the one-time source/target row-count check in the pipeline wizard's Review step, which only runs once at deploy time. If this pipeline's transformations include a dedupe step, keep the key columns here in sync with those keys." />
      </div>
      {selected.dedup_check_enabled && (
        <div className="form-grid">
          <div className="field full">
            <label>Key columns (comma separated)</label>
            <input
              value={selected.dedup_config.key_columns.join(', ')}
              placeholder="order_id"
              onChange={(e) =>
                updateSelected({
                  dedup_config: {
                    ...selected.dedup_config,
                    key_columns: e.target.value
                      .split(',')
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
            {availableColumns.length > 0 && (
              <span className="hint">Columns found: {availableColumns.map((c) => c.name).join(', ')}</span>
            )}
          </div>
          <div className="field">
            <label>Duplicate tolerance (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={selected.dedup_config.duplicate_tolerance_pct}
              onChange={(e) =>
                updateSelected({ dedup_config: { ...selected.dedup_config, duplicate_tolerance_pct: Number(e.target.value) || 0 } })
              }
            />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Data quality</h2>
        <p>Onboard a BigQuery table or a GCS file, then define field-level rules and (for files) presence/size checks.</p>
      </div>

      {!isNew && (
        <div className="row-actions" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ maxWidth: 380 }}>
            <label>Pipeline</label>
            <select value={selected.pipeline_id} onChange={(e) => setSelectedId(e.target.value)}>
              {pipelineDropdownOptions.map((r) => (
                <option key={r.pipeline_id} value={r.pipeline_id}>
                  {r.pipeline_label}
                </option>
              ))}
            </select>
            <span className="hint mono">
              {selectedConnection?.name ?? '(connection not found)'} ·{' '}
              {selected.source_kind === 'table'
                ? [selected.table_schema, selected.table_name].filter(Boolean).join('.')
                : selected.file_path}
            </span>
          </div>
          <button type="button" className="btn primary" style={{ marginTop: 20 }} onClick={() => onRunNow(selected.pipeline_id)}>
            Run check now
          </button>
        </div>
      )}

      <div className="row-actions">{coverageHelpButton}</div>
      {coverageHelpModal}

      {(() => {
        const onboardOrEditContent = (
          <>
      {isNew && step === 'rules' && (
        <div className="row-actions" style={{ justifyContent: 'space-between' }}>
          <span className="hint mono">
            <strong>{draft.pipeline_label}</strong> ·{' '}
            {draft.source_kind === 'table' ? [draft.table_schema, draft.table_name].filter(Boolean).join('.') : draft.file_path}
          </span>
          <button type="button" className="btn small ghost" onClick={backToDetails}>
            Edit details
          </button>
        </div>
      )}

      {isNew && step === 'review' && (
        <div className="row-actions" style={{ justifyContent: 'space-between' }}>
          <span className="hint mono">
            <strong>{draft.pipeline_label}</strong> ·{' '}
            {[draft.table_schema, draft.table_name].filter(Boolean).join('.')}
          </span>
          <button type="button" className="btn small ghost" onClick={backToRules}>
            Back to rules
          </button>
        </div>
      )}

      {isNew && step === 'details' && (
        <div>
          <div className="field full">
            <label>Pipeline name</label>
            <input
              value={draft.pipeline_label}
              placeholder="Customer Master (BigQuery)"
              onChange={(e) => updateSelected({ pipeline_label: e.target.value })}
            />
          </div>

          <div>
            <div className="section-title">
              What are you monitoring?
              <HelpTip text="BigQuery tables get field-level quality rules only. GCS files also get file presence and file-size checks, since 'exists' and 'size' are meaningful for files but not for tables." />
            </div>
            <div className="row-actions">
              <button
                type="button"
                className={`btn small ${draft.source_kind === 'table' ? 'primary' : ''}`}
                onClick={() => selectSourceKind('table')}
              >
                BigQuery table
              </button>
              <button
                type="button"
                className={`btn small ${draft.source_kind === 'file' ? 'primary' : ''}`}
                onClick={() => selectSourceKind('file')}
              >
                GCS file
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Connection</label>
              {availableConnections.length > 0 ? (
                <select value={draft.connection_ref} onChange={(e) => updateSelected({ connection_ref: e.target.value })}>
                  <option value="">Select a connection…</option>
                  {availableConnections.map((c) => (
                    <option key={c.connection_id} value={c.connection_id}>
                      {c.name} ({c.environment})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="hint">
                  No saved {draft.source_kind === 'table' ? 'BigQuery' : 'GCS'} connections yet — add one in the Connections tab.
                </span>
              )}
            </div>

            {draft.source_kind === 'table' ? (
              <>
                <div className="field">
                  <label>Dataset</label>
                  <input value={draft.table_schema} placeholder="analytics" onChange={(e) => updateSelected({ table_schema: e.target.value })} />
                </div>
                <div className="field">
                  <label>Table</label>
                  <input value={draft.table_name} placeholder="orders" onChange={(e) => updateSelected({ table_name: e.target.value })} />
                  <span className="hint">
                    {columnsLoading ? 'Fetching columns…' : columns.length > 0 ? `${columns.length} columns found` : 'Columns will be fetched once a table is entered.'}
                  </span>
                </div>
              </>
            ) : (
              <div className="field full">
                <label>File path</label>
                <input
                  value={draft.file_path}
                  placeholder="gs://my-gcs-bucket/returns/dt={{ds}}/part-0.parquet"
                  onChange={(e) => updateSelected({ file_path: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {issues.length > 0 && <div className="warning-banner">Fix the following: {issues.join(' · ')}</div>}

      {isNew ? (
        <div className="dq-banner pending">
          <strong>＋</strong>
          <span>
            {step === 'details'
              ? 'Fill in the source details above, then continue to choose column rules.'
              : step === 'rules'
                ? draft.source_kind === 'table'
                  ? 'Select which rules apply to each column, then review the generated queries before onboarding.'
                  : 'Select which rules apply to each column, set a schedule, then save to start monitoring this source.'
                : 'Review the generated queries below — add a custom check if the auto-generated ones don’t cover everything — then approve to start monitoring this source.'}
          </span>
        </div>
      ) : (
        <div className={`dq-banner ${evaluation.status}`}>
          <strong>
            {evaluation.status === 'pass' ? '✓' : evaluation.status === 'warning' ? '⚠' : evaluation.status === 'fail' ? '✕' : '…'}
          </strong>
          <span>{evaluation.message}</span>
        </div>
      )}

      {showTableRulesEditor && (
        <ColumnRulesGrid
          columns={columns}
          columnsLoading={columnsLoading}
          rules={selected.quality_rules}
          onRulesChange={(next) => updateSelected({ quality_rules: next })}
        />
      )}

      {showTableSqlSection && (
        <div>
          <div className="section-title">
            <AccordionToggle label="Generated SELECT statement" expanded={showGeneratedSql} onToggle={() => setShowGeneratedSql((v) => !v)} />
            <HelpTip text="There is no live database connection wired up yet — this is the query that would run against the source table to evaluate the rules configured above. It updates live as you check/uncheck rules." />
          </div>
          {showGeneratedSql &&
            (generatedSql ? (
              <pre className="sql-preview-block">{generatedSql}</pre>
            ) : (
              <p className="hint">Select at least one column rule above to preview the generated query.</p>
            ))}
        </div>
      )}

      {showTableSqlSection && (
        <CustomSqlChecks checks={selected.custom_sql_checks} onChange={(next) => updateSelected({ custom_sql_checks: next })} />
      )}

      {isNew && step === 'review' && (
        <div className="transform-card">
          <label className="checkbox-label">
            <input type="checkbox" checked={reviewConfirmed} onChange={(e) => setReviewConfirmed(e.target.checked)} />
            I've reviewed the generated queries above and they correctly reflect the rules I selected.
          </label>
        </div>
      )}

      {showRulesSection && selected.source_kind === 'file' && (
        <div className="transform-card">
          <div className="transform-card-head">
            <AccordionToggle
              label="Quality rules"
              expanded={selected.quality_rules_enabled}
              onToggle={() => updateSelected({ quality_rules_enabled: !selected.quality_rules_enabled })}
            />
            <HelpTip text="Validates field values on every run — null checks, ranges, regex patterns, allowed values, and uniqueness. Leave unchecked if this source doesn't need field-level validation." />
          </div>
        </div>
      )}

      {showRulesSection && selected.source_kind === 'file' && selected.quality_rules_enabled && (
        <QualityRuleEditor fields={[]} rules={selected.quality_rules} onRulesChange={(next) => updateSelected({ quality_rules: next })} />
      )}

      {showRulesSection && selected.source_kind === 'file' && (
        <div className="rule-grid">
          <div className="transform-card">
            <div className="transform-card-head">
              <AccordionToggle
                label="File presence check"
                expanded={selected.file_presence_enabled}
                onToggle={() => updateSelected({ file_presence_enabled: !selected.file_presence_enabled })}
              />
              <HelpTip text="Fails the check if the expected file is not found at the target path for today's run." />
            </div>
            {selected.file_presence_enabled && (
              <p className="hint">Confirms the file for today's run actually landed at the expected path before anything else is evaluated.</p>
            )}
          </div>

          <div className="transform-card">
            <div className="transform-card-head">
              <AccordionToggle
                label="File size check"
                expanded={selected.file_size_check_enabled}
                onToggle={() => updateSelected({ file_size_check_enabled: !selected.file_size_check_enabled })}
              />
              <HelpTip text="Compares today's file size against the average size over the lookback window. Flags a warning if the deviation exceeds the threshold." />
            </div>
            {selected.file_size_check_enabled && (
              <div className="form-grid">
                <div className="field">
                  <label>Lookback (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={selected.file_size_config.lookback_days}
                    onChange={(e) =>
                      updateSelected({ file_size_config: { ...selected.file_size_config, lookback_days: Number(e.target.value) || 1 } })
                    }
                  />
                </div>
                <div className="field">
                  <label>Deviation threshold (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={selected.file_size_config.deviation_threshold_pct}
                    onChange={(e) =>
                      updateSelected({
                        file_size_config: { ...selected.file_size_config, deviation_threshold_pct: Number(e.target.value) || 1 },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {schemaDriftCard}
          {dedupCard}

          <div className="transform-card">
            <div className="transform-card-head">
              <span className="checkbox-label">Schedule</span>
              <HelpTip text="When these checks run automatically, expressed as a cron schedule plus timezone — same format as a pipeline's Airflow schedule." />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Cron expression</label>
                <input
                  value={selected.schedule.expression}
                  onChange={(e) => updateSelected({ schedule: { ...selected.schedule, expression: e.target.value } })}
                />
              </div>
              <div className="field">
                <label>Timezone</label>
                <input
                  value={selected.schedule.timezone}
                  onChange={(e) => updateSelected({ schedule: { ...selected.schedule, timezone: e.target.value } })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showTableRulesEditor && (
        <div className="rule-grid">
          {schemaDriftCard}
          {dedupCard}

          <div className="transform-card">
            <div className="transform-card-head">
              <span className="checkbox-label">Schedule</span>
              <HelpTip text="When these quality rules run automatically, expressed as a cron schedule plus timezone." />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Cron expression</label>
                <input
                  value={selected.schedule.expression}
                  onChange={(e) => updateSelected({ schedule: { ...selected.schedule, expression: e.target.value } })}
                />
              </div>
              <div className="field">
                <label>Timezone</label>
                <input
                  value={selected.schedule.timezone}
                  onChange={(e) => updateSelected({ schedule: { ...selected.schedule, timezone: e.target.value } })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row-actions">
        {!isNew ? (
          <button type="button" className="btn" onClick={startOnboarding}>
            + Onboard new source
          </button>
        ) : step === 'details' ? (
          <>
            <button type="button" className="btn primary" onClick={goToRules}>
              Next: choose rules
            </button>
            <button type="button" className="btn ghost" onClick={cancelOnboarding}>
              Cancel
            </button>
          </>
        ) : step === 'rules' ? (
          <>
            <button type="button" className="btn ghost" onClick={backToDetails}>
              Back
            </button>
            {draft.source_kind === 'table' ? (
              <button type="button" className="btn primary" onClick={goToReview}>
                Review generated queries
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={saveOnboarding}>
                Save source
              </button>
            )}
            <button type="button" className="btn ghost" onClick={cancelOnboarding}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={backToRules}>
              Back
            </button>
            <button type="button" className="btn primary" onClick={saveOnboarding} disabled={!reviewConfirmed}>
              Approve &amp; onboard
            </button>
            <button type="button" className="btn ghost" onClick={cancelOnboarding}>
              Cancel
            </button>
          </>
        )}
      </div>
          </>
        )
        return isNew ? (
          <Modal title="Onboard new source" onClose={cancelOnboarding}>
            {onboardOrEditContent}
          </Modal>
        ) : (
          onboardOrEditContent
        )
      })()}

      {!isNew && selected.source_kind === 'file' && (
        <div>
          <div className="section-title">
            Size trend <HelpTip text="The dashed line marks the average size over the lookback window (excluding today). Today's bar is colored by its check result." />
          </div>
          {selected.history.length > 0 ? (
            <FileSizeChart history={selected.history} avg={evaluation.avg} todayStatus={evaluation.status} />
          ) : (
            <p className="hint">No size history yet. Run a check to record the first data point.</p>
          )}
        </div>
      )}

      {!isNew && selected.source_kind === 'file' && (
        <div>
          <div className="section-title">Size history</div>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>File present</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {[...selected.history].reverse().map((sample) => (
                <tr key={sample.date}>
                  <td>{formatDate(sample.date)}</td>
                  <td>{sample.file_exists ? 'Yes' : 'No'}</td>
                  <td>{formatBytes(sample.size_bytes)}</td>
                </tr>
              ))}
              {selected.history.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                    No size history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isNew && (
        <div>
          <div className="section-title">
            Execution history <HelpTip text="Every past run of this source's data quality checks, whether triggered by the schedule above or manually with Run check now. Runs with rule failures can be expanded for the debug query that finds the offending records, plus an AI explanation. Failed/warning runs with no structured debug data (e.g. file presence or size checks) can still be expanded for an AI-suggested next step based on the failure message." />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Executed at</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pipelineExecutions.map((exec) => {
                const hasFailures = Boolean(exec.rule_failures && exec.rule_failures.length > 0)
                const hasDrift = Boolean(exec.schema_drift_details && exec.schema_drift_details.length > 0)
                const hasDedup = Boolean(exec.dedup_details && exec.dedup_details.length > 0)
                const isPlainFailure = (exec.status === 'fail' || exec.status === 'warning') && !hasFailures && !hasDrift && !hasDedup
                const hasDetails = hasFailures || hasDrift || hasDedup || isPlainFailure
                const isExpanded = expandedExecId === exec.id
                const analysis = dqAnalyses[exec.id]
                const driftAnalysis = driftAnalyses[exec.id]
                const dedupAnalysis = dedupAnalyses[exec.id]
                const fileCheckAnalysis = fileCheckAnalyses[exec.id]
                return (
                  <Fragment key={exec.id}>
                    <tr
                      className={hasDetails ? 'run-row' : undefined}
                      onClick={hasDetails ? () => setExpandedExecId(isExpanded ? null : exec.id) : undefined}
                    >
                      <td>{formatDateTime(exec.executed_at)}</td>
                      <td>{exec.trigger}</td>
                      <td>
                        <span className={`status-badge ${STATUS_BADGE_CLASS[exec.status]}`}>{exec.status}</span>
                      </td>
                      <td>{exec.message}</td>
                      <td>
                        {hasDetails && <button type="button" className="btn small ghost">{isExpanded ? 'Hide details' : 'View details'}</button>}
                      </td>
                    </tr>
                    {hasDetails && isExpanded && (
                      <tr className="log-row">
                        <td colSpan={5}>
                          {hasFailures &&
                            exec.rule_failures!.map((f) => (
                              <div className="transform-card" style={{ margin: '10px 16px' }} key={`${f.field}-${f.rule}`}>
                                <div className="transform-card-head">
                                  <strong>{f.field}</strong>
                                  <span className="hint mono">
                                    {QUALITY_RULE_LABELS[f.rule]} · {f.violation_count} row{f.violation_count === 1 ? '' : 's'} failing
                                  </span>
                                </div>
                                <p className="hint">Debug query to identify the offending records:</p>
                                <pre className="sql-preview-block">{f.debug_sql}</pre>
                              </div>
                            ))}
                          {hasFailures && (
                            <div className="ai-analysis" style={{ margin: '0 16px 12px' }}>
                              {!analysis && (
                                <button type="button" className="btn small" onClick={() => analyzeDqFailure(exec)}>
                                  Analyze with AI
                                </button>
                              )}
                              {analysis?.loading && <span className="hint">The AI is looking at these failures…</span>}
                              {analysis && !analysis.loading && (
                                <div className="ai-analysis-result">
                                  <div className="ai-analysis-head">
                                    <strong>AI analysis</strong>
                                    {analysis.isMock && <span className="badge">built-in analyzer</span>}
                                    <button type="button" className="btn small ghost" onClick={() => analyzeDqFailure(exec)}>
                                      Re-analyze
                                    </button>
                                  </div>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{analysis.text}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {hasDrift &&
                            exec.schema_drift_details!.map((d) => (
                              <div className="transform-card" style={{ margin: '10px 16px' }} key={`${d.column}-${d.change_type}`}>
                                <div className="transform-card-head">
                                  <strong>{d.column}</strong>
                                  <span className="hint mono">
                                    {d.change_type === 'column_added'
                                      ? `added (${d.new_type})`
                                      : d.change_type === 'column_removed'
                                        ? `removed (was ${d.previous_type})`
                                        : `type changed: ${d.previous_type} → ${d.new_type}`}
                                  </span>
                                </div>
                                <p className="hint">What production would query instead of this illustrative diff:</p>
                                <pre className="sql-preview-block">{d.introspection_sql}</pre>
                              </div>
                            ))}
                          {hasDrift && (
                            <div className="ai-analysis" style={{ margin: '0 16px 12px' }}>
                              {!driftAnalysis && (
                                <button type="button" className="btn small" onClick={() => analyzeSchemaDrift(exec)}>
                                  Analyze with AI
                                </button>
                              )}
                              {driftAnalysis?.loading && <span className="hint">The AI is looking at this schema drift…</span>}
                              {driftAnalysis && !driftAnalysis.loading && (
                                <div className="ai-analysis-result">
                                  <div className="ai-analysis-head">
                                    <strong>AI analysis</strong>
                                    {driftAnalysis.isMock && <span className="badge">built-in analyzer</span>}
                                    <button type="button" className="btn small ghost" onClick={() => analyzeSchemaDrift(exec)}>
                                      Re-analyze
                                    </button>
                                  </div>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{driftAnalysis.text}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {hasDedup &&
                            exec.dedup_details!.map((d, i) => (
                              <div className="transform-card" style={{ margin: '10px 16px' }} key={`dedup-${i}`}>
                                <div className="transform-card-head">
                                  <strong>{d.key_values.join(', ')}</strong>
                                  <span className="hint mono">{d.duplicate_row_count} duplicate row{d.duplicate_row_count === 1 ? '' : 's'}</span>
                                </div>
                                <p className="hint">Debug query to identify the offending records:</p>
                                <pre className="sql-preview-block">{d.debug_sql}</pre>
                              </div>
                            ))}
                          {hasDedup && (
                            <div className="ai-analysis" style={{ margin: '0 16px 12px' }}>
                              {!dedupAnalysis && (
                                <button type="button" className="btn small" onClick={() => analyzeDedup(exec)}>
                                  Analyze with AI
                                </button>
                              )}
                              {dedupAnalysis?.loading && <span className="hint">The AI is looking at these duplicates…</span>}
                              {dedupAnalysis && !dedupAnalysis.loading && (
                                <div className="ai-analysis-result">
                                  <div className="ai-analysis-head">
                                    <strong>AI analysis</strong>
                                    {dedupAnalysis.isMock && <span className="badge">built-in analyzer</span>}
                                    <button type="button" className="btn small ghost" onClick={() => analyzeDedup(exec)}>
                                      Re-analyze
                                    </button>
                                  </div>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{dedupAnalysis.text}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {isPlainFailure && (
                            <div className="ai-analysis" style={{ margin: '0 16px 12px' }}>
                              <p className="hint">No structured debug data for this check — next steps from the failure message:</p>
                              {!fileCheckAnalysis && (
                                <button type="button" className="btn small" onClick={() => analyzeFileCheck(exec)}>
                                  Analyze with AI
                                </button>
                              )}
                              {fileCheckAnalysis?.loading && <span className="hint">The AI is looking at this failure…</span>}
                              {fileCheckAnalysis && !fileCheckAnalysis.loading && (
                                <div className="ai-analysis-result">
                                  <div className="ai-analysis-head">
                                    <strong>AI analysis</strong>
                                    {fileCheckAnalysis.isMock && <span className="badge">built-in analyzer</span>}
                                    <button type="button" className="btn small ghost" onClick={() => analyzeFileCheck(exec)}>
                                      Re-analyze
                                    </button>
                                  </div>
                                  <p style={{ whiteSpace: 'pre-wrap' }}>{fileCheckAnalysis.text}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {pipelineExecutions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                    No executions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
