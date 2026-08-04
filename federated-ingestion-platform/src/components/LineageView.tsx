import { useMemo, useState } from 'react'
import type { AirflowTriggerConfig, ConnectionConfig, PipelineConfig } from '../types'
import { CONNECTION_TYPES } from '../data/templates'
import { dataServiceLabel, pipelineDisplayName } from '../data/dataServices'
import { airflowConfigDisplayName, sensorOperatorLabel } from '../data/airflowSensors'
import { downloadCsv } from '../utils/download'

interface LineageViewProps {
  pipelines: PipelineConfig[]
  connections: ConnectionConfig[]
  airflowTriggers: AirflowTriggerConfig[]
  onBuildNew: () => void
}

const CSV_HEADERS = [
  'Name',
  'ID',
  'Type',
  'Runs on',
  'Git path',
  'Source connection',
  'Source type',
  'Source object',
  'Target / trigger',
  'Target type',
  'Target object',
  'Schedule (cron)',
  'Timezone',
  'Owner',
]

function connectionTypeLabel(type: ConnectionConfig['type'] | undefined): string {
  return CONNECTION_TYPES.find((c) => c.value === type)?.label ?? type ?? '—'
}

interface LineageRow {
  key: string
  kind: 'pipeline' | 'airflow'
  name: string
  id: string
  gitPath: string
  typeLabel: string
  typeSub: string
  sourceName: string
  sourceType: string
  sourceObject: string
  targetName: string
  targetType: string
  targetObject: string
  cronExpression: string
  timezone: string
  owner: string
}

export default function LineageView({ pipelines, connections, airflowTriggers, onBuildNew }: LineageViewProps) {
  const [search, setSearch] = useState('')

  function connectionFor(ref: string): ConnectionConfig | undefined {
    return connections.find((c) => c.connection_id === ref)
  }

  const rows = useMemo<LineageRow[]>(() => {
    const pipelineRows: LineageRow[] = pipelines.map((pipeline) => {
      const sourceConn = connectionFor(pipeline.source.connection_ref)
      const targetConn = connectionFor(pipeline.target.connection_ref)
      const targetObject = [pipeline.target.schema, pipeline.target.table].filter(Boolean).join('.')
      const gate = airflowTriggers.find((a) => a.target_pipeline_id === pipeline.pipeline_id)
      return {
        key: `pipeline_${pipeline.pipeline_id}`,
        kind: 'pipeline',
        name: pipelineDisplayName(pipeline),
        id: pipeline.pipeline_id,
        gitPath: pipeline.git_path,
        typeLabel: 'Data pipeline',
        typeSub: dataServiceLabel(pipeline.data_service),
        sourceName: sourceConn?.name ?? (pipeline.source.connection_ref || '—'),
        sourceType: connectionTypeLabel(sourceConn?.type),
        sourceObject: pipeline.source.object || '—',
        targetName: gate ? `${targetConn?.name ?? (pipeline.target.connection_ref || '—')} (gated by Airflow)` : (targetConn?.name ?? (pipeline.target.connection_ref || '—')),
        targetType: connectionTypeLabel(targetConn?.type),
        targetObject: targetObject || '—',
        cronExpression: pipeline.schedule.expression,
        timezone: pipeline.schedule.timezone,
        owner: pipeline.owner,
      }
    })

    const airflowRows: LineageRow[] = airflowTriggers.map((config) => {
      const checkConn = connectionFor(config.check_connection_ref)
      const targetPipeline = pipelines.find((p) => p.pipeline_id === config.target_pipeline_id)
      return {
        key: `airflow_${config.config_id}`,
        kind: 'airflow',
        name: airflowConfigDisplayName(config),
        id: config.config_id,
        gitPath: config.git_path,
        typeLabel: 'Airflow',
        typeSub: checkConn ? sensorOperatorLabel(checkConn.type) : '—',
        sourceName: checkConn?.name ?? (config.check_connection_ref || '—'),
        sourceType: connectionTypeLabel(checkConn?.type),
        sourceObject: config.check_object || '—',
        targetName: `→ triggers ${targetPipeline ? pipelineDisplayName(targetPipeline) : config.target_pipeline_id || '—'}`,
        targetType: 'Pipeline trigger',
        targetObject: targetPipeline?.pipeline_id ?? config.target_pipeline_id ?? '—',
        cronExpression: config.schedule.expression,
        timezone: config.schedule.timezone,
        owner: config.owner,
      }
    })

    const term = search.trim().toLowerCase()
    return [...pipelineRows, ...airflowRows]
      .filter((r) => !term || r.name.toLowerCase().includes(term) || r.id.toLowerCase().includes(term))
      .sort((a, b) => {
        const aIsDataflow = a.typeSub === 'Dataflow' ? 0 : 1
        const bIsDataflow = b.typeSub === 'Dataflow' ? 0 : 1
        if (aIsDataflow !== bIsDataflow) return aIsDataflow - bIsDataflow
        return a.name.localeCompare(b.name)
      })
  }, [pipelines, connections, airflowTriggers, search])

  function exportToExcel() {
    const csvRows = rows.map((r) => [
      r.name,
      r.id,
      r.typeLabel,
      r.typeSub,
      r.gitPath,
      r.sourceName,
      r.sourceType,
      r.sourceObject,
      r.targetName,
      r.targetType,
      r.targetObject,
      r.cronExpression,
      r.timezone,
      r.owner,
    ])
    downloadCsv('pipeline_lineage.csv', CSV_HEADERS, csvRows)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Pipeline lineage</h2>
        <p>
          Every pipeline and Airflow scheduling config on the platform — freshly built or already running — with its source, target,
          and schedule in one place.
        </p>
      </div>

      <div className="row-actions">
        <div className="field" style={{ minWidth: 260 }}>
          <label>Search</label>
          <input type="text" placeholder="Filter by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="btn primary" style={{ alignSelf: 'flex-end' }} onClick={onBuildNew}>
          + Build new pipeline
        </button>
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
          onClick={exportToExcel}
          disabled={rows.length === 0}
        >
          Export to Excel
        </button>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Source</th>
              <th>Source object</th>
              <th>Target / trigger</th>
              <th>Target object</th>
              <th>Schedule</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <strong>{r.name}</strong>
                  <div className="hint">{r.gitPath || '—'}</div>
                </td>
                <td>
                  <span className={`badge ${r.kind === 'airflow' ? 'badge-airflow' : ''}`}>{r.typeLabel}</span>
                  <div className="hint">{r.typeSub}</div>
                </td>
                <td>
                  <div>{r.sourceName}</div>
                  <div className="hint">{r.sourceType}</div>
                </td>
                <td className="mono">{r.sourceObject}</td>
                <td>
                  <div>{r.targetName}</div>
                  <div className="hint">{r.targetType}</div>
                </td>
                <td className="mono">{r.targetObject}</td>
                <td className="mono">
                  {r.cronExpression}
                  <div className="hint">{r.timezone}</div>
                </td>
                <td>{r.owner || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 0' }}>
                  Nothing matches your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
