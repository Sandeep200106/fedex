import { useEffect, useMemo, useState } from 'react'
import './App.css'
import Stepper, { type StepDef } from './components/Stepper'
import TemplateStep from './components/TemplateStep'
import ConnectionPicker from './components/ConnectionPicker'
import ConnectionsView from './components/ConnectionsView'
import MappingStep from './components/MappingStep'
import PipelineDetailsStep from './components/PipelineDetailsStep'
import ReviewStep from './components/ReviewStep'
import JobHistoryView from './components/JobHistoryView'
import DataQualityView from './components/DataQualityView'
import ChatWidget from './components/ChatWidget'
import HomeView from './components/HomeView'
import InfoModal from './components/InfoModal'
import type { ArchNode } from './data/archNodes'
import { STEP_INFO } from './data/stepInfo'
import { PIPELINE_TEMPLATES, TARGET_OBJECT_CONFIG } from './data/templates'
import { MOCK_JOB_RUNS, simulateRerun } from './data/jobRuns'
import {
  MOCK_DQ_EXECUTIONS,
  MOCK_DQ_RULE_SETS,
  evaluateToday,
  simulateDedupCheck,
  simulateFirstCheck,
  simulateSchemaDriftCheck,
  simulateTableRuleCheck,
  worseStatus,
} from './data/dataQuality'
import { TARGET_SCHEMA_EXISTS, deriveFileObjectKey, fetchColumns, fetchColumnsSync } from './data/schemaIntrospection'
import { loadConnections, saveConnections } from './data/connectionsStore'
import { loadPipelines, savePipelines, upsertPipeline } from './data/pipelinesStore'
import LineageView from './components/LineageView'
import AirflowConfigView from './components/AirflowConfigView'
import { loadAirflowTriggers, saveAirflowTriggers } from './data/airflowTriggerStore'
import { loadFrameworkRules, saveFrameworkRules, frameworkRuleFromSuggestion, isPatternAdopted } from './data/dqFramework'
import type { RuleSuggestion } from './rag/llmClient'
import { emptyConnectionConfig, emptyThroughputProfile } from './types'
import type {
  AirflowTriggerConfig,
  ColumnInfo,
  ColumnMapping,
  ConnectionConfig,
  ConnectionType,
  DataServiceEngine,
  DedupDetail,
  DqCheckStatus,
  DqExecution,
  DqRuleSet,
  JobRun,
  PipelineConfig,
  PipelineLanguage,
  PipelineSource,
  PipelineTarget,
  RuleFailureDetail,
  Schedule,
  SchemaDriftDetail,
  ThroughputProfile,
  Transformation,
} from './types'
import { slugify } from './utils/slug'

type AppView = 'home' | 'build' | 'history' | 'quality' | 'connections' | 'lineage' | 'airflow'

const VIEW_LABELS: Record<AppView, string> = {
  home: 'Home tab',
  build: 'Build Pipeline wizard',
  history: 'Job History tab',
  quality: 'Data Quality tab',
  connections: 'Connections tab',
  lineage: 'Lineage tab',
  airflow: 'Airflow Scheduling tab',
}

const STEPS: StepDef[] = [
  { key: 'template', title: 'Template', desc: 'Pick a pipeline type' },
  { key: 'source', title: 'Source', desc: 'Choose a connection' },
  { key: 'target', title: 'Target', desc: 'Choose a connection' },
  { key: 'mapping', title: 'Mapping', desc: 'Object & columns' },
  { key: 'details', title: 'Details', desc: 'Transform pipeline' },
  { key: 'review', title: 'Review', desc: 'Generate JSON' },
]

export default function App() {
  const [view, setView] = useState<AppView>('home')
  const [chatOpen, setChatOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [infoNode, setInfoNode] = useState<ArchNode | null>(null)

  const [templateId, setTemplateId] = useState('')
  const [connections, setConnections] = useState<ConnectionConfig[]>(() => loadConnections())
  const [connectionsPrefillType, setConnectionsPrefillType] = useState<ConnectionType | null>(null)
  const [sourceConnectionId, setSourceConnectionId] = useState('')
  const [targetConnectionId, setTargetConnectionId] = useState('')
  const [frameworkRules, setFrameworkRules] = useState(() => loadFrameworkRules())
  const [pipelines, setPipelines] = useState<PipelineConfig[]>(() => loadPipelines())
  const [airflowTriggers, setAirflowTriggers] = useState<AirflowTriggerConfig[]>(() => loadAirflowTriggers())
  const [airflowFocusPipelineId, setAirflowFocusPipelineId] = useState<string | null>(null)

  function openPipelineInAirflow(pipelineId: string) {
    setAirflowFocusPipelineId(pipelineId)
    setView('airflow')
  }

  useEffect(() => {
    saveConnections(connections)
  }, [connections])

  useEffect(() => {
    savePipelines(pipelines)
  }, [pipelines])

  useEffect(() => {
    saveAirflowTriggers(airflowTriggers)
  }, [airflowTriggers])

  useEffect(() => {
    saveFrameworkRules(frameworkRules)
  }, [frameworkRules])

  function adoptIntoFramework(patternKey: string, suggestion: RuleSuggestion) {
    setFrameworkRules((prev) => [...prev, frameworkRuleFromSuggestion({ patternKey, ...suggestion })])
  }

  const [pipelineSource, setPipelineSource] = useState<PipelineSource>({
    connection_ref: '',
    object: '',
    extraction_mode: 'incremental',
    delivery_pattern: 'micro_batch',
    cursor_column: '',
    filter_column: '',
    filter_operator: '=',
    filter_value: '',
  })
  const [pipelineTarget, setPipelineTarget] = useState<PipelineTarget>({
    connection_ref: '',
    schema: '',
    table: '',
    load_mode: 'update_merge',
  })
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [transformations, setTransformations] = useState<Transformation[]>([])
  const [schedule, setSchedule] = useState<Schedule>({ type: 'cron', expression: '0 3 * * *', timezone: 'Asia/Kolkata' })
  const [dataService, setDataService] = useState<DataServiceEngine>('dataflow')
  const [language, setLanguage] = useState<PipelineLanguage>('python')
  const [throughput, setThroughput] = useState<ThroughputProfile>(emptyThroughputProfile())
  const [isSourceOfTruth, setIsSourceOfTruth] = useState(false)
  const [pipelineName, setPipelineName] = useState('')
  const [pipelineOwner, setPipelineOwner] = useState('')
  const [gitPath, setGitPath] = useState('')

  const [jobRuns, setJobRuns] = useState<JobRun[]>(MOCK_JOB_RUNS)

  function rerunJob(run: JobRun) {
    const dqPatternAdopted = run.dq_pattern_key ? isPatternAdopted(frameworkRules, run.dq_pattern_key) : false
    setJobRuns((prev) => [simulateRerun(run, dqPatternAdopted), ...prev])
  }

  const [dqRuleSets, setDqRuleSets] = useState<DqRuleSet[]>(MOCK_DQ_RULE_SETS)
  const [dqExecutions, setDqExecutions] = useState<DqExecution[]>(MOCK_DQ_EXECUTIONS)

  const [sourceColumns, setSourceColumns] = useState<ColumnInfo[]>([])
  const [targetColumns, setTargetColumns] = useState<ColumnInfo[]>([])
  const [sourceColumnsLoading, setSourceColumnsLoading] = useState(false)
  const [targetColumnsLoading, setTargetColumnsLoading] = useState(false)

  const currentTemplate = useMemo(() => PIPELINE_TEMPLATES.find((t) => t.id === templateId), [templateId])
  const sourceType: ConnectionType = currentTemplate?.sourceType ?? 'postgresql'
  const targetType: ConnectionType = currentTemplate?.targetType ?? 'gcs'
  const sourceConn = connections.find((c) => c.connection_id === sourceConnectionId)
  const targetConn = connections.find((c) => c.connection_id === targetConnectionId)

  useEffect(() => {
    const object = pipelineSource.object.trim()
    if (!object) {
      setSourceColumns([])
      return
    }
    setSourceColumnsLoading(true)
    const timer = setTimeout(() => {
      fetchColumns(object, sourceType)
        .then(setSourceColumns)
        .finally(() => setSourceColumnsLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [pipelineSource.object, sourceType])

  useEffect(() => {
    if (!TARGET_SCHEMA_EXISTS[targetType]) {
      setTargetColumns([])
      return
    }
    const cfg = TARGET_OBJECT_CONFIG[targetType]
    const object = cfg.showSchema ? [pipelineTarget.schema, pipelineTarget.table].filter(Boolean).join('.') : pipelineTarget.table
    if (!object.trim()) {
      setTargetColumns([])
      return
    }
    setTargetColumnsLoading(true)
    const timer = setTimeout(() => {
      fetchColumns(object, targetType)
        .then(setTargetColumns)
        .finally(() => setTargetColumnsLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [pipelineTarget.schema, pipelineTarget.table, targetType])

  useEffect(() => {
    const showsFileFormat = TARGET_OBJECT_CONFIG[targetType].showFileFormat
    setPipelineTarget((prev) => {
      if (!showsFileFormat) return prev.file_format ? { ...prev, file_format: undefined } : prev
      return prev.file_format ? prev : { ...prev, file_format: 'parquet' }
    })
  }, [targetType])

  useEffect(() => {
    const showsLoadMode = TARGET_OBJECT_CONFIG[targetType].showLoadMode
    setPipelineTarget((prev) => {
      if (!showsLoadMode) return prev.load_mode ? { ...prev, load_mode: undefined } : prev
      return prev.load_mode ? prev : { ...prev, load_mode: 'insert' }
    })
  }, [targetType])

  function selectTemplate(id: string) {
    setTemplateId(id)
    const template = PIPELINE_TEMPLATES.find((t) => t.id === id)
    if (!template) return
    setPipelineSource((prev) => ({
      ...prev,
      extraction_mode: template.defaultExtractionMode,
      delivery_pattern: template.defaultDeliveryPattern,
    }))
    setPipelineTarget((prev) => ({ ...prev, load_mode: template.defaultLoadMode }))
    setDataService(template.defaultDataService)
    setLanguage(template.defaultLanguage)
    setThroughput(emptyThroughputProfile())
    if (!connections.some((c) => c.connection_id === sourceConnectionId && c.type === template.sourceType)) {
      setSourceConnectionId('')
    }
    if (!connections.some((c) => c.connection_id === targetConnectionId && c.type === template.targetType)) {
      setTargetConnectionId('')
    }
  }

  function selectSourceConnection(id: string) {
    setSourceConnectionId(id)
  }

  function selectTargetConnection(id: string) {
    setTargetConnectionId(id)
  }

  function goToConnections(prefillType: ConnectionType) {
    setConnectionsPrefillType(prefillType)
    setView('connections')
  }

  // Seeds a complete Oracle -> GCS pipeline (mock HR.ORDERS data, dedupe on order_id
  // so the row-count reconciliation check passes) so the full wizard flow can be
  // demoed end to end without re-entering every field by hand.
  function loadDemoPipeline() {
    setTemplateId('oracle_to_gcs_v1')
    setSourceConnectionId('conn_hr_oracle_prod')
    setTargetConnectionId('conn_gcs_lake_prod')
    setPipelineSource({
      connection_ref: 'conn_hr_oracle_prod',
      object: 'HR.ORDERS',
      extraction_mode: 'full',
      delivery_pattern: 'batch',
      cursor_column: '',
      filter_column: '',
      filter_operator: '=',
      filter_value: '',
    })
    setPipelineTarget({
      connection_ref: 'conn_gcs_lake_prod',
      schema: '',
      table: 'orders/dt={{ds}}/part-*',
      file_format: 'parquet',
    })
    setMapping([])
    setTransformations([{ type: 'dedupe', keys: ['order_id'] }])
    setSchedule({ type: 'cron', expression: '0 3 * * *', timezone: 'Asia/Kolkata' })
    setDataService('data_fusion')
    setLanguage('scala')
    setThroughput({ value: 30, unit: 'rows_per_sec', sla_minutes: '' })
    setIsSourceOfTruth(false)
    setPipelineName('Orders Sync - Daily')
    setPipelineOwner('data-engineering')
    setGitPath('pipelines/orders_sync_daily.json')
    setView('build')
    setStep(0)
    setMaxReached(5)
  }

  function runPipeline(pipeline: PipelineConfig) {
    const runId = `manual__${new Date().toISOString()}`
    const triggeredAt = new Date().toISOString()
    const newRun: JobRun = {
      run_id: runId,
      pipeline_id: pipeline.pipeline_id,
      dag_id: pipeline.pipeline_id,
      state: 'running',
      trigger_type: 'manual',
      execution_date: triggeredAt,
      start_date: triggeredAt,
      end_date: null,
      duration_seconds: null,
      log_excerpt: '[mock] Triggered manually from Federated Ingestion Platform UI — dummy execution starting…',
    }
    setJobRuns((prev) => [newRun, ...prev])
    setView('history')
    setTimeout(() => {
      setJobRuns((prev) =>
        prev.map((r) =>
          r.run_id === runId
            ? {
                ...r,
                state: 'success',
                end_date: new Date().toISOString(),
                duration_seconds: 4,
                log_excerpt: `${r.log_excerpt}\n[mock] Dummy execution completed — no real source/target were touched.\n[mock] Task exited with return code 0`,
              }
            : r,
        ),
      )
    }, 3000)
  }

  function runDqCheckNow(pipelineId: string) {
    const rule = dqRuleSets.find((r) => r.pipeline_id === pipelineId)
    if (!rule) return
    const connectionType = connections.find((c) => c.connection_id === rule.connection_ref)?.type

    // A freshly onboarded file has no history yet — there is no real backend
    // to inspect, so the first run simulates that initial inspection and
    // records it as the baseline going forward. Table sources have no file
    // history to simulate — they're evaluated straight from their rules.
    let ruleForEvaluation = rule
    if (rule.source_kind === 'file' && rule.history.length === 0) {
      const firstSample = simulateFirstCheck()
      const updatedHistory = [firstSample]
      setDqRuleSets((prev) => prev.map((r) => (r.pipeline_id === pipelineId ? { ...r, history: updatedHistory } : r)))
      ruleForEvaluation = { ...ruleForEvaluation, history: updatedHistory }
    }

    // Same bootstrap idea for schema drift: the first run with the check enabled
    // captures a baseline instead of comparing against one, since there is
    // nothing yet to compare against. Applies to both file and table sources —
    // a file's "object" for schema lookup is derived from its path.
    let justCapturedSchemaBaseline = false
    if (ruleForEvaluation.schema_drift_check_enabled && ruleForEvaluation.schema_baseline.length === 0) {
      const objectKey = ruleForEvaluation.source_kind === 'table' ? ruleForEvaluation.table_name : deriveFileObjectKey(ruleForEvaluation.file_path)
      const baseline = fetchColumnsSync(objectKey, connectionType)
      setDqRuleSets((prev) => prev.map((r) => (r.pipeline_id === pipelineId ? { ...r, schema_baseline: baseline } : r)))
      ruleForEvaluation = { ...ruleForEvaluation, schema_baseline: baseline }
      justCapturedSchemaBaseline = true
    }

    let status: DqCheckStatus
    let message: string
    let ruleFailures: RuleFailureDetail[] | undefined
    let schemaDriftDetails: SchemaDriftDetail[] | undefined
    let dedupDetails: DedupDetail[] | undefined

    if (ruleForEvaluation.source_kind === 'table') {
      const result = simulateTableRuleCheck(ruleForEvaluation, connectionType)
      status = result.status
      message = result.message
      ruleFailures = result.ruleFailures.length > 0 ? result.ruleFailures : undefined
    } else {
      const evaluation = evaluateToday(ruleForEvaluation)
      status = evaluation.status
      message = evaluation.message
    }

    if (ruleForEvaluation.schema_drift_check_enabled) {
      if (justCapturedSchemaBaseline) {
        message = `${message} Schema baseline captured (${ruleForEvaluation.schema_baseline.length} columns) — future checks will compare against it.`
      } else {
        const drift = simulateSchemaDriftCheck(ruleForEvaluation, connectionType)
        status = worseStatus(status, drift.status)
        if (drift.details.length > 0) {
          message = `${message} ${drift.message}`
          schemaDriftDetails = drift.details
        }
      }
    }

    if (ruleForEvaluation.dedup_check_enabled) {
      const dedup = simulateDedupCheck(ruleForEvaluation, connectionType)
      status = worseStatus(status, dedup.status)
      if (dedup.details.length > 0) {
        message = `${message} ${dedup.message}`
        dedupDetails = dedup.details
      }
    }

    const execution: DqExecution = {
      id: `dqe_manual_${Math.random().toString(36).slice(2, 9)}`,
      pipeline_id: pipelineId,
      executed_at: new Date().toISOString(),
      trigger: 'manual',
      status,
      message,
      rule_failures: ruleFailures,
      schema_drift_details: schemaDriftDetails,
      dedup_details: dedupDetails,
    }
    setDqExecutions((prev) => [execution, ...prev])
  }

  const finalPipeline = useMemo(() => {
    const slug = slugify(pipelineName)
    return {
      pipeline_id: slug ? `pl_${slug}` : '',
      name: pipelineName,
      template: templateId,
      source: { ...pipelineSource, connection_ref: sourceConnectionId },
      target: { ...pipelineTarget, connection_ref: targetConnectionId },
      mapping,
      transformations,
      schedule,
      data_service: dataService,
      language,
      expected_throughput: throughput,
      is_source_of_truth: isSourceOfTruth,
      owner: pipelineOwner,
      git_path: gitPath || (slug ? `pipelines/${slug}.json` : ''),
    }
  }, [
    pipelineName,
    templateId,
    pipelineSource,
    pipelineTarget,
    sourceConnectionId,
    targetConnectionId,
    mapping,
    transformations,
    schedule,
    dataService,
    language,
    throughput,
    isSourceOfTruth,
    pipelineOwner,
    gitPath,
  ])

  const finalSource = useMemo(() => sourceConn ?? emptyConnectionConfig(), [sourceConn])
  const finalTarget = useMemo(() => targetConn ?? emptyConnectionConfig(), [targetConn])

  // Lineage reflects the pipeline as it's being built, not just once it's committed —
  // as soon as it has a name (and therefore a pipeline_id), every further edit in the
  // wizard keeps this same Lineage row live-updated instead of waiting for Review & commit.
  useEffect(() => {
    if (!finalPipeline.pipeline_id) return
    setPipelines((prev) => upsertPipeline(prev, finalPipeline))
  }, [finalPipeline])

  function issuesFor(index: number): string[] {
    const issues: string[] = []
    if (index === 0 && !templateId) issues.push('select a template')
    if (index === 1 && !sourceConn) issues.push('select a source connection')
    if (index === 2 && !targetConn) issues.push('select a target connection')
    if (index === 3) {
      if (!pipelineSource.object) issues.push('source object is required')
      if (pipelineSource.extraction_mode !== 'full' && !pipelineSource.cursor_column) issues.push('cursor column is required for incremental/cdc')
      if (pipelineSource.cursor_column && !pipelineSource.filter_value) issues.push('filter value is required when the incremental key is set')
      if (TARGET_OBJECT_CONFIG[targetType].showSchema && !pipelineTarget.schema) issues.push('target schema is required')
      if (!pipelineTarget.table) issues.push('target table is required')
      if (TARGET_OBJECT_CONFIG[targetType].showFileFormat && !pipelineTarget.file_format) issues.push('file format is required')
      if (!TARGET_OBJECT_CONFIG[targetType].showFileFormat) {
        if (mapping.length === 0) issues.push('add at least one column mapping')
        if (mapping.some((m) => !m.source_column || !m.target_column)) issues.push('every mapped column needs a source and target name')
      }
    }
    if (index === 4) {
      if (!pipelineName) issues.push('pipeline name is required')
      if (!schedule.expression) issues.push('cron expression is required')
      if (transformations.some((t) => t.type === 'filter' && !t.condition)) issues.push('every filter needs a condition')
      if (transformations.some((t) => t.type === 'dedupe' && (!t.keys || t.keys.length === 0))) issues.push('every dedupe needs at least one key')
      if (transformations.some((t) => t.type === 'transform' && (!t.column || !t.function))) issues.push('every transform needs a column and a function')
    }
    return issues
  }

  const reviewIssues = [0, 1, 2, 3, 4].flatMap((i) => issuesFor(i))
  const currentIssues = issuesFor(step)

  function goNext() {
    if (currentIssues.length > 0) return
    const next = Math.min(step + 1, STEPS.length - 1)
    setStep(next)
    setMaxReached((m) => Math.max(m, next))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function goTo(index: number) {
    if (index <= maxReached) setStep(index)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            F<span className="brand-mark-accent">IP</span>
          </span>
          <div>
            <h1>Federated Ingestion Platform</h1>
          </div>
        </div>
      </header>

      <nav className="app-tabs">
        <button type="button" className={`app-tab ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
          Home
        </button>
        <button type="button" className={`app-tab ${view === 'build' ? 'active' : ''}`} onClick={() => setView('build')}>
          Build Pipeline
        </button>
        <button type="button" className={`app-tab ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
          Job History
        </button>
        <button type="button" className={`app-tab ${view === 'airflow' ? 'active' : ''}`} onClick={() => setView('airflow')}>
          Airflow Scheduling
        </button>
        <button type="button" className={`app-tab ${view === 'quality' ? 'active' : ''}`} onClick={() => setView('quality')}>
          Data Quality
        </button>
        <button type="button" className={`app-tab ${view === 'lineage' ? 'active' : ''}`} onClick={() => setView('lineage')}>
          Lineage
        </button>
        <button type="button" className={`app-tab ${view === 'connections' ? 'active' : ''}`} onClick={() => setView('connections')}>
          Connections
        </button>
      </nav>

      {view === 'home' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <HomeView onStartBuilding={() => setView('build')} onOpenChat={() => setChatOpen(true)} onLoadDemo={loadDemoPipeline} />
        </div>
      )}

      {view === 'history' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <JobHistoryView runs={jobRuns} onRerun={rerunJob} onOpenPipeline={openPipelineInAirflow} />
        </div>
      )}

      {view === 'quality' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <DataQualityView
            ruleSets={dqRuleSets}
            executions={dqExecutions}
            connections={connections}
            onChange={setDqRuleSets}
            onRunNow={runDqCheckNow}
            frameworkRules={frameworkRules}
            onAdoptIntoFramework={adoptIntoFramework}
          />
        </div>
      )}

      {view === 'lineage' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <LineageView
            pipelines={pipelines}
            connections={connections}
            airflowTriggers={airflowTriggers}
            onBuildNew={() => setView('build')}
          />
        </div>
      )}

      {view === 'connections' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <ConnectionsView
            connections={connections}
            onChange={setConnections}
            prefillType={connectionsPrefillType}
            onPrefillConsumed={() => setConnectionsPrefillType(null)}
          />
        </div>
      )}

      {view === 'airflow' && (
        <div className="app-body" style={{ gridTemplateColumns: '1fr' }}>
          <AirflowConfigView
            configs={airflowTriggers}
            connections={connections}
            pipelines={pipelines}
            onChange={setAirflowTriggers}
            onBuildPipeline={() => setView('build')}
            focusPipelineId={airflowFocusPipelineId}
            onFocusConsumed={() => setAirflowFocusPipelineId(null)}
          />
        </div>
      )}

      {view === 'build' && (
        <div className="app-body">
          <Stepper
            steps={STEPS}
            activeIndex={step}
            maxReachedIndex={maxReached}
            onSelect={goTo}
            onInfo={(stepKey) => setInfoNode(STEP_INFO[stepKey] ?? null)}
          />

          <div>
            {step === 0 && <TemplateStep templateId={templateId} onSelect={selectTemplate} />}
            {step === 1 && (
              <ConnectionPicker
                role="source"
                requiredType={sourceType}
                connections={connections}
                selectedId={sourceConnectionId}
                onSelect={selectSourceConnection}
                onManageConnections={goToConnections}
              />
            )}
            {step === 2 && (
              <ConnectionPicker
                role="target"
                requiredType={targetType}
                connections={connections}
                selectedId={targetConnectionId}
                onSelect={selectTargetConnection}
                onManageConnections={goToConnections}
              />
            )}
            {step === 3 && (
              <MappingStep
                sourceType={sourceType}
                targetType={targetType}
                source={pipelineSource}
                target={pipelineTarget}
                mapping={mapping}
                sourceColumns={sourceColumns}
                targetColumns={targetColumns}
                sourceColumnsLoading={sourceColumnsLoading}
                targetColumnsLoading={targetColumnsLoading}
                onSourceChange={setPipelineSource}
                onTargetChange={setPipelineTarget}
                onMappingChange={setMapping}
              />
            )}
            {step === 4 && (
              <PipelineDetailsStep
                name={pipelineName}
                owner={pipelineOwner}
                gitPath={gitPath}
                transformations={transformations}
                schedule={schedule}
                dataService={dataService}
                deliveryPattern={pipelineSource.delivery_pattern}
                throughput={throughput}
                language={language}
                sourceColumns={sourceColumns}
                onNameChange={setPipelineName}
                onOwnerChange={setPipelineOwner}
                onGitPathChange={setGitPath}
                onTransformationsChange={setTransformations}
                onDataServiceChange={setDataService}
                onLanguageChange={setLanguage}
              />
            )}
            {step === 5 && (
              <ReviewStep
                source={finalSource}
                target={finalTarget}
                pipeline={finalPipeline}
                issues={reviewIssues}
                onRunPipeline={() => runPipeline(finalPipeline)}
              />
            )}

            {step < 5 && (
              <div className="panel-footer" style={{ border: 'none', padding: '16px 4px 0' }}>
                <button type="button" className="btn ghost" onClick={goBack} disabled={step === 0}>
                  Back
                </button>
                <button type="button" className="btn primary" onClick={goNext} disabled={currentIssues.length > 0}>
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <InfoModal node={infoNode} onClose={() => setInfoNode(null)} />

      <ChatWidget
        open={chatOpen}
        onOpenChange={setChatOpen}
        currentLocation={view === 'build' ? `${VIEW_LABELS.build} — ${STEPS[step].title} step` : VIEW_LABELS[view]}
        jobRuns={jobRuns}
        dqExecutions={dqExecutions}
        dqRuleSets={dqRuleSets}
      />
    </div>
  )
}
