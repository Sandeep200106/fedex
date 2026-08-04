import type { PipelineConfig } from '../types'

const STORAGE_KEY = 'pipeline-builder-pipelines'

// Pipelines that already exist on the platform — same pipeline_ids as the mock data in
// jobRuns.ts / dataQuality.ts, so the Lineage tab's "last run" and "DQ" columns resolve
// against real entries instead of showing blanks for every pre-existing pipeline.
export const DEFAULT_PIPELINES: PipelineConfig[] = [
  {
    pipeline_id: 'pl_inventory_full_load',
    name: 'Inventory Full Load',
    template: 'mysql_to_bigquery_v1',
    source: {
      connection_ref: 'conn_inventory_mysql_prod',
      object: 'inventory.stock_levels',
      extraction_mode: 'full',
      delivery_pattern: 'batch',
      cursor_column: '',
    },
    target: {
      connection_ref: 'conn_analytics_bigquery_prod',
      schema: 'analytics',
      table: 'DIM_INVENTORY',
      load_mode: 'truncate_insert',
    },
    mapping: [],
    transformations: [],
    schedule: { type: 'cron', expression: '0 2 * * *', timezone: 'Asia/Kolkata' },
    data_service: 'dataproc',
    language: 'scala',
    expected_throughput: { value: '', unit: 'rows_per_sec', sla_minutes: '' },
    is_source_of_truth: true,
    owner: 'data-engineering',
    git_path: 'pipelines/inventory_full_load.json',
  },
  {
    pipeline_id: 'pl_clickstream_cdc',
    name: 'Clickstream Events (Streaming)',
    template: 'kafka_to_gcs_cdc_v1',
    source: {
      connection_ref: 'conn_clickstream_kafka',
      object: 'clickstream.events',
      extraction_mode: 'cdc',
      delivery_pattern: 'streaming',
      cursor_column: '',
    },
    target: {
      connection_ref: 'conn_ncm_s3_prod',
      schema: '',
      table: 'clickstream/dt={{ds}}/part-*.json',
      file_format: 'json',
    },
    mapping: [],
    transformations: [],
    schedule: { type: 'cron', expression: '0 4 * * *', timezone: 'Asia/Kolkata' },
    data_service: 'dataflow',
    language: 'java',
    expected_throughput: { value: '', unit: 'rows_per_sec', sla_minutes: '' },
    is_source_of_truth: false,
    owner: 'data-engineering',
    git_path: 'pipelines/clickstream_cdc.json',
  },
  {
    pipeline_id: 'pl_vendor_orders_api',
    name: 'Vendor Orders Merge',
    template: '',
    source: {
      connection_ref: 'conn_mediation_sftp_prod',
      object: '/inbound/vendor/orders_dt={{ds}}.csv',
      extraction_mode: 'incremental',
      delivery_pattern: 'micro_batch',
      cursor_column: 'order_date',
    },
    target: {
      connection_ref: 'conn_orders_db_prod',
      schema: 'public',
      table: 'vendor_orders',
      load_mode: 'update_merge',
    },
    mapping: [],
    transformations: [],
    schedule: { type: 'cron', expression: '30 * * * *', timezone: 'Asia/Kolkata' },
    data_service: 'dataflow',
    language: 'python',
    expected_throughput: { value: '', unit: 'rows_per_sec', sla_minutes: '' },
    is_source_of_truth: false,
    owner: 'data-engineering',
    git_path: 'pipelines/vendor_orders_merge.json',
  },
  {
    pipeline_id: 'pl_billing_orders_cdc_bigquery',
    name: 'Billing / Order Replication (CDC)',
    template: 'oracle_to_bigquery_cdc_v1',
    source: {
      connection_ref: 'conn_billing_oracle_prod',
      object: 'BILLING.ORDERS',
      extraction_mode: 'cdc',
      delivery_pattern: 'streaming',
      cursor_column: 'commit_scn',
    },
    target: {
      connection_ref: 'conn_billing_bigquery_prod',
      schema: 'billing',
      table: 'billing_orders',
      load_mode: 'update_merge',
    },
    mapping: [],
    transformations: [],
    schedule: { type: 'cron', expression: '*/15 * * * *', timezone: 'Asia/Kolkata' },
    data_service: 'dataflow',
    language: 'java',
    expected_throughput: { value: '', unit: 'rows_per_sec', sla_minutes: '' },
    is_source_of_truth: true,
    owner: 'data-engineering',
    git_path: 'pipelines/billing_orders_cdc_bigquery.json',
  },
]

export function loadPipelines(): PipelineConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PIPELINES
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PIPELINES
    return parsed
  } catch {
    return DEFAULT_PIPELINES
  }
}

export function savePipelines(pipelines: PipelineConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines))
}

// Newly built/committed pipelines land here — insert if new, overwrite in place if this
// pipeline_id (i.e. this pipeline name, since the id is slugified from it) was rebuilt.
export function upsertPipeline(pipelines: PipelineConfig[], pipeline: PipelineConfig): PipelineConfig[] {
  const index = pipelines.findIndex((p) => p.pipeline_id === pipeline.pipeline_id)
  if (index === -1) return [pipeline, ...pipelines]
  return pipelines.map((p, i) => (i === index ? pipeline : p))
}
