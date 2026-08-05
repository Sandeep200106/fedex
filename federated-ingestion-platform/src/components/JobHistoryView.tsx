import { Fragment, useMemo, useState } from 'react'
import type { JobRun, RunState } from '../types'
import { formatDateTime, formatDuration } from '../utils/format'
import { buildLogAnalysisPrompt, callLlm, getLlmSettings, isLlmConfigured, mockLogAnalysis } from '../rag/llmClient'

interface JobHistoryViewProps {
  runs: JobRun[]
  onRerun: (run: JobRun) => void
  onOpenPipeline: (pipelineId: string) => void
}

const RERUNNABLE_STATES: RunState[] = ['failed', 'up_for_retry']

const STATUS_OPTIONS: { value: RunState | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'up_for_retry', label: 'Up for retry' },
]

const ANALYZABLE_STATES: RunState[] = ['failed', 'up_for_retry']

interface Analysis {
  loading: boolean
  text?: string
  isMock?: boolean
}

export default function JobHistoryView({ runs, onRerun, onOpenPipeline }: JobHistoryViewProps) {
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<RunState | 'all'>('all')
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})

  const pipelineIds = useMemo(() => Array.from(new Set(runs.map((r) => r.pipeline_id))).sort(), [runs])

  const filtered = useMemo(() => {
    return runs
      .filter((r) => pipelineFilter === 'all' || r.pipeline_id === pipelineFilter)
      .filter((r) => statusFilter === 'all' || r.state === statusFilter)
      .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
  }, [runs, pipelineFilter, statusFilter])

  async function analyze(run: JobRun) {
    setAnalyses((prev) => ({ ...prev, [run.run_id]: { loading: true } }))
    const settings = getLlmSettings()

    if (isLlmConfigured(settings)) {
      try {
        const text = await callLlm(settings, buildLogAnalysisPrompt(run.pipeline_id, run.log_excerpt))
        setAnalyses((prev) => ({ ...prev, [run.run_id]: { loading: false, text, isMock: false } }))
        return
      } catch {
        // fall through to the mock analyzer below
      }
    }

    const mock = mockLogAnalysis(run.log_excerpt)
    setAnalyses((prev) => ({
      ...prev,
      [run.run_id]: { loading: false, text: `Issue: ${mock.issue}\n\nResolution: ${mock.resolution}`, isMock: true },
    }))
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Job history</h2>
        <p>Run status and logs reported back from Airflow through the Config API for every generated pipeline.</p>
      </div>

      <div className="row-actions">
        <div className="field" style={{ minWidth: 220 }}>
          <label>Pipeline</label>
          <select value={pipelineFilter} onChange={(e) => setPipelineFilter(e.target.value)}>
            <option value="all">All pipelines</option>
            {pipelineIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 180 }}>
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RunState | 'all')}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Pipeline</th>
            <th>Run ID</th>
            <th>Status</th>
            <th>Trigger</th>
            <th>Started</th>
            <th>Duration</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((run) => {
            const isExpanded = expandedRunId === run.run_id
            const analysis = analyses[run.run_id]
            return (
              <Fragment key={run.run_id}>
                <tr
                  className="run-row"
                  onClick={() => {
                    const nowExpanded = !isExpanded
                    setExpandedRunId(nowExpanded ? run.run_id : null)
                    if (nowExpanded && ANALYZABLE_STATES.includes(run.state) && !analyses[run.run_id]) {
                      analyze(run)
                    }
                  }}
                >
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      title="Open this pipeline's Airflow scheduling config"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenPipeline(run.pipeline_id)
                      }}
                    >
                      {run.pipeline_id}
                    </button>
                    {run.dq_pattern_key && (
                      <span className="badge" style={{ marginLeft: 8 }} title="This failure is a DQ check, not an infra error — rerunning it checks whether that check has been adopted into the DQ framework.">
                        DQ-linked
                      </span>
                    )}
                  </td>
                  <td className="mono">{run.run_id}</td>
                  <td>
                    <StatusBadge state={run.state} />
                  </td>
                  <td>{run.trigger_type}</td>
                  <td>{formatDateTime(run.start_date)}</td>
                  <td>{formatDuration(run.duration_seconds)}</td>
                  <td>
                    <button type="button" className="btn small ghost">
                      {isExpanded ? 'Hide logs' : 'View logs'}
                    </button>
                    {RERUNNABLE_STATES.includes(run.state) && (
                      <button
                        type="button"
                        className="btn small"
                        style={{ marginLeft: 8 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onRerun(run)
                        }}
                      >
                        Rerun
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="log-row">
                    <td colSpan={7}>
                      <pre className="log-excerpt">{run.log_excerpt}</pre>
                      {ANALYZABLE_STATES.includes(run.state) && (
                        <div className="ai-analysis">
                          {!analysis && (
                            <button type="button" className="btn small" onClick={() => analyze(run)}>
                              Analyze with AI
                            </button>
                          )}
                          {analysis?.loading && <span className="hint">The AI is looking at this failure…</span>}
                          {analysis && !analysis.loading && (
                            <div className="ai-analysis-result">
                              <div className="ai-analysis-head">
                                <strong>AI analysis</strong>
                                {analysis.isMock && <span className="badge">built-in analyzer</span>}
                                <button type="button" className="btn small ghost" onClick={() => analyze(run)}>
                                  Re-analyze
                                </button>
                              </div>
                              <p>{analysis.text}</p>
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
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                No runs match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const STATUS_STYLE: Record<RunState, { label: string; className: string }> = {
  success: { label: 'Success', className: 'status-success' },
  failed: { label: 'Failed', className: 'status-failed' },
  running: { label: 'Running', className: 'status-running' },
  queued: { label: 'Queued', className: 'status-queued' },
  up_for_retry: { label: 'Up for retry', className: 'status-retry' },
}

function StatusBadge({ state }: { state: RunState }) {
  const meta = STATUS_STYLE[state]
  return <span className={`status-badge ${meta.className}`}>{meta.label}</span>
}
