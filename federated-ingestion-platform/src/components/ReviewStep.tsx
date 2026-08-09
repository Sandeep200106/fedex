import { useState } from 'react'
import type { ConnectionConfig, PipelineConfig } from '../types'
import { downloadJson } from '../utils/download'
import { dataServiceLabel } from '../data/dataServices'
import { simulateRowCountReconciliation, type RowCountReconciliation } from '../data/dataQuality'
import { estimateCostTier } from '../data/costEstimate'

interface ReviewStepProps {
  source: ConnectionConfig
  target: ConnectionConfig
  pipeline: PipelineConfig
  issues: string[]
  onRunPipeline: () => void
}

function mockCommitSha(): string {
  return Math.random().toString(16).slice(2, 9)
}

export default function ReviewStep({ source, target, pipeline, issues, onRunPipeline }: ReviewStepProps) {
  const canGenerate = issues.length === 0
  const [committing, setCommitting] = useState(false)
  const [commitSha, setCommitSha] = useState('')
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<RowCountReconciliation | null>(null)
  const canDeploy = canGenerate && validation?.status === 'pass'
  const costEstimate = estimateCostTier({
    data_service: pipeline.data_service,
    delivery_pattern: pipeline.source.delivery_pattern,
    expected_throughput: pipeline.expected_throughput,
    schedule: pipeline.schedule,
  })

  function downloadAll() {
    downloadJson(`${source.connection_id}.json`, source)
    downloadJson(`${target.connection_id}.json`, target)
    downloadJson(`${pipeline.pipeline_id}.json`, pipeline)
  }

  function commitToGitHub() {
    setCommitting(true)
    setTimeout(() => {
      setCommitSha(mockCommitSha())
      setCommitting(false)
    }, 900)
  }

  function runValidation() {
    setValidating(true)
    setValidation(null)
    setTimeout(() => {
      setValidation(simulateRowCountReconciliation(pipeline))
      setValidating(false)
    }, 900)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Review &amp; generate</h2>
        <p>
          These JSON files are what the Config API would commit to GitHub for Airflow to pick up and run on{' '}
          <strong>{dataServiceLabel(pipeline.data_service)}</strong> — one of GCP's Data Services (Dataflow, Dataproc, or Cloud Data
          Fusion).
        </p>
        <div className="badge-row" style={{ marginTop: 8 }}>
          <span className={`status-badge cost-${costEstimate.tier}`}>{costEstimate.tier} cost</span>
        </div>
      </div>

      {canGenerate ? (
        <div className="summary-banner">✓ Ready to generate. Download the files and commit them to your pipelines repo.</div>
      ) : (
        <div className="warning-banner">
          Fix the following before generating: {issues.join(' · ')}
        </div>
      )}

      <div className="review-columns">
        <JsonCard title="Source connection" filename={`${source.connection_id || 'source_connection'}.json`} data={source} />
        <JsonCard title="Target connection" filename={`${target.connection_id || 'target_connection'}.json`} data={target} />
        <JsonCard title="Pipeline config" filename={`${pipeline.pipeline_id || 'pipeline_config'}.json`} data={pipeline} />
      </div>

      <div className="panel-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
        <span className="hint">git_path: {pipeline.git_path || '—'}</span>
        <button type="button" className="btn primary" disabled={!canGenerate} onClick={downloadAll}>
          Download all 3 files
        </button>
      </div>

      <div className="deploy-section">
        <div className="section-title">Data validation (source vs. target row-count reconciliation)</div>
        <div className="row-actions">
          <button type="button" className="btn" disabled={!canGenerate || validating} onClick={runValidation}>
            {validating ? 'Validating…' : validation ? 'Re-run validation' : 'Run validation check'}
          </button>
        </div>
        {validation && (
          <div className={validation.status === 'pass' ? 'summary-banner' : 'warning-banner'}>
            {validation.status === 'pass' ? '✓ ' : '✗ '}
            {validation.message} (source: {validation.sourceCount.toLocaleString()} rows, target: {validation.targetCount.toLocaleString()} rows)
          </div>
        )}
        {!validation && <span className="hint">Deploy stays locked until this check passes — mirrors the row-count checks run before trusting a faster ingestion cycle in production.</span>}
      </div>

      <div className="deploy-section">
        <div className="section-title">Deploy</div>
        <div className="row-actions">
          <button type="button" className="btn" disabled={!canDeploy || committing || Boolean(commitSha)} onClick={commitToGitHub}>
            {committing ? 'Committing…' : commitSha ? 'Committed' : 'Commit to GitHub'}
          </button>
          <button type="button" className="btn primary" disabled={!commitSha} onClick={onRunPipeline}>
            Run pipeline
          </button>
          {commitSha && (
            <span className="hint">
              Committed {commitSha} to {pipeline.git_path || '(git path not set)'}
            </span>
          )}
        </div>
        {!commitSha && !canDeploy && <span className="hint">Run validation above and get a passing result before you can commit.</span>}
        {!commitSha && canDeploy && <span className="hint">Commit before you can trigger a run — matches UI → Config API → GitHub → Airflow.</span>}
      </div>
    </div>
  )
}

function JsonCard({ title, filename, data }: { title: string; filename: string; data: unknown }) {
  return (
    <div className="json-card">
      <div className="json-card-head">
        <strong>{title}</strong>
        <button type="button" className="btn small" onClick={() => downloadJson(filename, data)}>
          Download
        </button>
      </div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
