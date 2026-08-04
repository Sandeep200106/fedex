export type ConnectionType =
  | 'postgresql'
  | 'mysql'
  | 'oracle'
  | 'sqlserver'
  | 'bigquery'
  | 's3'
  | 'gcs'
  | 'rest_api'
  | 'kafka'
  | 'sftp'

export type Environment = 'dev' | 'staging' | 'prod'

export interface ConnectionAuth {
  method: 'secret_manager' | 'basic' | 'oauth2' | 'iam_role'
  secret_ref: string
}

export interface ConnectionConfig {
  connection_id: string
  name: string
  type: ConnectionType
  environment: Environment
  host: string
  port: number | ''
  database: string
  auth: ConnectionAuth
  tags: string[]
  owner: string
  created_at: string
}

export type ExtractionMode = 'full' | 'incremental' | 'cdc'
export type LoadMode = 'insert' | 'update_merge' | 'truncate_insert'
export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN'

// How the job actually runs (continuous vs scheduled), as distinct from extraction_mode
// (how rows are read). Allowed values are constrained per extraction_mode — see
// ALLOWED_DELIVERY_PATTERNS_BY_EXTRACTION_MODE in src/data/deliveryPatterns.ts.
export type DeliveryPattern = 'batch' | 'micro_batch' | 'streaming'

export interface PipelineSource {
  connection_ref: string
  object: string
  extraction_mode: ExtractionMode
  delivery_pattern: DeliveryPattern
  cursor_column: string
  filter_column?: string
  filter_operator?: FilterOperator
  filter_value?: string
}

export type FileFormat = 'csv' | 'json' | 'parquet' | 'avro' | 'orc'

export interface PipelineTarget {
  connection_ref: string
  schema: string
  table: string
  load_mode?: LoadMode
  file_format?: FileFormat
}

export interface ColumnMapping {
  source_column: string
  target_column: string
  type: string
}

export interface ColumnInfo {
  name: string
  type: string
}

export type TransformFunction = 'TRIM' | 'UPPER' | 'LOWER' | 'ROUND' | 'CAST' | 'RENAME' | 'REPLACE' | 'COALESCE'

export type TransformationType = 'filter' | 'dedupe' | 'transform'

export interface Transformation {
  type: TransformationType
  condition?: string
  keys?: string[]
  column?: string
  function?: TransformFunction
  args?: string[]
}

export interface Schedule {
  type: 'cron'
  expression: string
  timezone: string
}

export type DataServiceEngine = 'dataflow' | 'dataproc' | 'data_fusion'
export type PipelineLanguage = 'python' | 'java' | 'scala'
export type ThroughputUnit = 'rows_per_sec' | 'gb_per_hour'

export interface ThroughputProfile {
  value: number | ''
  unit: ThroughputUnit
  sla_minutes: number | ''
}

export type QualityRuleType = 'not_null' | 'range' | 'length' | 'regex' | 'allowed_values' | 'unique'

export interface QualityRule {
  field: string
  rule: QualityRuleType
  min?: number
  max?: number
  pattern?: string
  values?: string[]
}

// Derived only, never stored — see estimateCostTier() in src/data/costEstimate.ts.
export type CostTier = 'low' | 'medium' | 'high'

export interface PipelineConfig {
  pipeline_id: string
  name: string
  template: string
  source: PipelineSource
  target: PipelineTarget
  mapping: ColumnMapping[]
  transformations: Transformation[]
  schedule: Schedule
  data_service: DataServiceEngine
  language: PipelineLanguage
  expected_throughput: ThroughputProfile
  // Governance signal for downstream consumers (e.g. ML models) — does not affect execution.
  is_source_of_truth: boolean
  owner: string
  git_path: string
}

export interface PipelineTemplate {
  id: string
  label: string
  description: string
  sourceType: ConnectionType
  targetType: ConnectionType
  defaultExtractionMode: ExtractionMode
  defaultDeliveryPattern: DeliveryPattern
  defaultLoadMode: LoadMode
  defaultDataService: DataServiceEngine
  defaultLanguage: PipelineLanguage
}

export interface WizardState {
  source: ConnectionConfig
  target: ConnectionConfig
  pipeline: PipelineConfig
}

export type RunState = 'success' | 'failed' | 'running' | 'queued' | 'up_for_retry'
export type TriggerType = 'scheduled' | 'manual'

export interface JobRun {
  run_id: string
  pipeline_id: string
  dag_id: string
  state: RunState
  trigger_type: TriggerType
  execution_date: string
  start_date: string
  end_date: string | null
  duration_seconds: number | null
  log_excerpt: string
  // Set only when this run's failure IS a DQ issue (as opposed to an infra error like a
  // timeout or rate limit) — the QualityPattern.key (see qualityPatterns.ts classify()) it
  // corresponds to, so a rerun can check whether that exact pattern has been adopted into
  // the DQ framework and, if so, actually behave like the fix is in place.
  dq_pattern_key?: string
}

export type DqCheckStatus = 'pass' | 'warning' | 'fail' | 'pending'

export interface DqFileSample {
  date: string
  file_exists: boolean
  size_bytes: number | null
}

export interface FileSizeRuleConfig {
  lookback_days: number
  deviation_threshold_pct: number
}

export type DqSourceKind = 'table' | 'file'

export interface CustomSqlCheck {
  id: string
  label: string
  sql: string
}

export type SchemaDriftChangeType = 'column_added' | 'column_removed' | 'type_changed'

export interface SchemaDriftConfig {
  compare_types: boolean
}

export interface SchemaDriftDetail {
  column: string
  change_type: SchemaDriftChangeType
  previous_type?: string
  new_type?: string
  introspection_sql: string
}

export interface DedupConfig {
  key_columns: string[]
  duplicate_tolerance_pct: number
}

export interface DedupDetail {
  key_values: string[]
  duplicate_row_count: number
  debug_sql: string
}

export interface DqRuleSet {
  pipeline_id: string
  pipeline_label: string
  source_kind: DqSourceKind
  connection_ref: string
  table_schema: string
  table_name: string
  file_path: string
  file_presence_enabled: boolean
  file_size_check_enabled: boolean
  file_size_config: FileSizeRuleConfig
  quality_rules_enabled: boolean
  quality_rules: QualityRule[]
  custom_sql_checks: CustomSqlCheck[]
  schema_drift_check_enabled: boolean
  schema_drift_config: SchemaDriftConfig
  schema_baseline: ColumnInfo[]
  dedup_check_enabled: boolean
  dedup_config: DedupConfig
  schedule: Schedule
  history: DqFileSample[]
}

export type DqTrigger = 'scheduled' | 'manual'

export interface RuleFailureDetail {
  field: string
  rule: QualityRuleType
  violation_count: number
  debug_sql: string
}

export interface DqExecution {
  id: string
  pipeline_id: string
  executed_at: string
  trigger: DqTrigger
  status: DqCheckStatus
  message: string
  rule_failures?: RuleFailureDetail[]
  schema_drift_details?: SchemaDriftDetail[]
  dedup_details?: DedupDetail[]
}

// The Airflow sensor operator used to check for data, derived from the checked
// connection's type — see SENSOR_TYPE_BY_CONNECTION in src/data/airflowSensors.ts.
export type SensorType =
  | 'gcs_object_sensor'
  | 's3_key_sensor'
  | 'sftp_sensor'
  | 'bigquery_table_sensor'
  | 'sql_sensor'
  | 'http_sensor'
  | 'kafka_sensor'

// A small "check-then-trigger" Airflow DAG: poll a location until data shows up, then kick
// off an already-deployed pipeline DAG. Distinct from PipelineConfig (which describes the
// pipeline's own extract/load logic) — this only wires a readiness gate in front of it.
export interface AirflowTriggerConfig {
  config_id: string
  name: string
  check_connection_ref: string
  check_object: string
  // Only asked for (and only meaningful) for table-backed connections — a SQL-based sensor
  // needs a date/timestamp/sequence column plus an operator/value to check freshness against,
  // the same role cursor_column/filter_operator/filter_value play for extraction in PipelineSource.
  check_column?: string
  check_operator?: FilterOperator
  check_value?: string
  poke_interval_seconds: number
  timeout_seconds: number
  target_pipeline_id: string
  schedule: Schedule
  owner: string
  git_path: string
}

export function emptyAirflowTriggerConfig(): AirflowTriggerConfig {
  return {
    config_id: '',
    name: '',
    check_connection_ref: '',
    check_object: '',
    check_column: '',
    check_operator: '=',
    check_value: '',
    poke_interval_seconds: 300,
    timeout_seconds: 21600,
    target_pipeline_id: '',
    schedule: { type: 'cron', expression: '*/15 * * * *', timezone: 'Asia/Kolkata' },
    owner: '',
    git_path: '',
  }
}

export function emptyThroughputProfile(): ThroughputProfile {
  return { value: '', unit: 'rows_per_sec', sla_minutes: '' }
}

export function emptyConnectionConfig(): ConnectionConfig {
  return {
    connection_id: '',
    name: '',
    type: 'postgresql',
    environment: 'dev',
    host: '',
    port: '',
    database: '',
    auth: { method: 'secret_manager', secret_ref: '' },
    tags: [],
    owner: '',
    created_at: '',
  }
}
