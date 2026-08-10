import type { ConnectionConfig, ConnectionType, FileFormat, LoadMode, PipelineTemplate } from '../types'

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'postgresql_to_gcs_v1',
    label: 'PostgreSQL → GCS',
    description: 'Extract from a PostgreSQL database and land objects in a GCS bucket.',
    sourceType: 'postgresql',
    targetType: 'gcs',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataflow',
    defaultLanguage: 'python',
  },
  {
    id: 'mysql_to_gcs_v1',
    label: 'MySQL → GCS',
    description: 'Extract from a MySQL database and land objects in a GCS bucket.',
    sourceType: 'mysql',
    targetType: 'gcs',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataflow',
    defaultLanguage: 'python',
  },
  {
    id: 'oracle_to_gcs_v1',
    label: 'Oracle → GCS',
    description: 'Extract from an Oracle database and land objects in a GCS bucket.',
    sourceType: 'oracle',
    targetType: 'gcs',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataproc',
    defaultLanguage: 'scala',
  },
  {
    id: 'sqlserver_to_gcs_v1',
    label: 'SQL Server → GCS',
    description: 'Extract from a SQL Server database and land objects in a GCS bucket.',
    sourceType: 'sqlserver',
    targetType: 'gcs',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataproc',
    defaultLanguage: 'scala',
  },
  {
    id: 's3_to_gcs_migration_v1',
    label: 'S3 → GCS (Migration)',
    description: 'Copy objects from an S3 bucket/prefix into a GCS bucket on a recurring schedule.',
    sourceType: 's3',
    targetType: 'gcs',
    defaultExtractionMode: 'full',
    defaultDeliveryPattern: 'batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataproc',
    defaultLanguage: 'scala',
  },
  {
    id: 'kafka_to_gcs_cdc_v1',
    label: 'Kafka → GCS (CDC)',
    description: 'Stream change-data-capture events from a Kafka topic into partitioned GCS objects.',
    sourceType: 'kafka',
    targetType: 'gcs',
    defaultExtractionMode: 'cdc',
    defaultDeliveryPattern: 'streaming',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataflow',
    defaultLanguage: 'java',
  },
  {
    id: 'rest_api_to_gcs_v1',
    label: 'REST API → GCS',
    description: 'Poll a REST API on a schedule and land normalized JSON objects into a GCS bucket.',
    sourceType: 'rest_api',
    targetType: 'gcs',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'data_fusion',
    defaultLanguage: 'python',
  },
  {
    id: 'postgresql_to_bigquery_v1',
    label: 'PostgreSQL table → BigQuery table',
    description: 'Extract from a PostgreSQL table and merge into a BigQuery table — map columns by dragging source onto target.',
    sourceType: 'postgresql',
    targetType: 'bigquery',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'update_merge',
    defaultDataService: 'dataflow',
    defaultLanguage: 'python',
  },
  {
    id: 'sftp_to_gcs_v1',
    label: 'SFTP → GCS',
    description: 'Poll an SFTP drop location on a schedule and land mediation/usage files (CSV, Parquet) in a GCS bucket.',
    sourceType: 'sftp',
    targetType: 'gcs',
    defaultExtractionMode: 'full',
    defaultDeliveryPattern: 'batch',
    defaultLoadMode: 'insert',
    defaultDataService: 'dataflow',
    defaultLanguage: 'python',
  },
  {
    id: 'oracle_to_bigquery_cdc_v1',
    label: 'Oracle (CDC) → BigQuery',
    description: 'Log-based change-data-capture from an Oracle OLTP source, merged into BigQuery on primary key + commit timestamp — captures updates and hard deletes with sub-15-minute lag.',
    sourceType: 'oracle',
    targetType: 'bigquery',
    defaultExtractionMode: 'cdc',
    defaultDeliveryPattern: 'streaming',
    defaultLoadMode: 'update_merge',
    defaultDataService: 'dataflow',
    defaultLanguage: 'java',
  },
  {
    id: 'mysql_to_bigquery_v1',
    label: 'MySQL table → BigQuery table',
    description: 'Extract from a MySQL table and merge into a BigQuery table — map columns by dragging source onto target.',
    sourceType: 'mysql',
    targetType: 'bigquery',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'update_merge',
    defaultDataService: 'dataflow',
    defaultLanguage: 'python',
  },
  {
    id: 'sqlserver_to_bigquery_v1',
    label: 'SQL Server table → BigQuery table',
    description: 'Extract from a SQL Server table and merge into a BigQuery table — map columns by dragging source onto target.',
    sourceType: 'sqlserver',
    targetType: 'bigquery',
    defaultExtractionMode: 'incremental',
    defaultDeliveryPattern: 'micro_batch',
    defaultLoadMode: 'update_merge',
    defaultDataService: 'dataproc',
    defaultLanguage: 'scala',
  },
]

export const CONNECTION_TYPES: { value: ConnectionType; label: string; defaultPort: number | '' }[] = [
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433 },
  { value: 'bigquery', label: 'BigQuery', defaultPort: '' },
  { value: 's3', label: 'Amazon S3', defaultPort: '' },
  { value: 'gcs', label: 'Google Cloud Storage', defaultPort: '' },
  { value: 'rest_api', label: 'REST API', defaultPort: 443 },
  { value: 'kafka', label: 'Kafka', defaultPort: 9092 },
  { value: 'sftp', label: 'SFTP', defaultPort: 22 },
]

interface ConnectionFieldSpec {
  show: boolean
  label: string
  placeholder: string
  required: boolean
}

export interface ConnectionFieldConfig {
  host: ConnectionFieldSpec
  port: Pick<ConnectionFieldSpec, 'show' | 'required'>
  database: ConnectionFieldSpec
}

export interface SourceObjectConfig {
  label: string
  placeholder: string
}

export const SOURCE_OBJECT_CONFIG: Record<ConnectionType, SourceObjectConfig> = {
  postgresql: { label: 'Source object (schema.table)', placeholder: 'public.orders' },
  mysql: { label: 'Source object (schema.table)', placeholder: 'orders_db.orders' },
  oracle: { label: 'Source object (schema.table)', placeholder: 'HR.ORDERS' },
  sqlserver: { label: 'Source object (schema.table)', placeholder: 'dbo.Orders' },
  bigquery: { label: 'Source object (dataset.table)', placeholder: 'raw.orders' },
  s3: { label: 'Source object (bucket key / prefix)', placeholder: 'raw/orders/*.parquet' },
  gcs: { label: 'Source object (bucket key / prefix)', placeholder: 'raw/orders/*.parquet' },
  rest_api: { label: 'Source object (API resource path)', placeholder: '/v1/orders' },
  kafka: { label: 'Source topic', placeholder: 'orders.events' },
  sftp: { label: 'Source path (glob pattern)', placeholder: '/outbound/mediation/usage_*.csv' },
}

export interface TargetObjectConfig {
  showSchema: boolean
  schemaLabel: string
  schemaPlaceholder: string
  tableLabel: string
  tablePlaceholder: string
  showFileFormat: boolean
  showLoadMode: boolean
}

export const TARGET_OBJECT_CONFIG: Record<ConnectionType, TargetObjectConfig> = {
  postgresql: { showSchema: true, schemaLabel: 'Target schema', schemaPlaceholder: 'public', tableLabel: 'Target table', tablePlaceholder: 'orders', showFileFormat: false, showLoadMode: true },
  mysql: { showSchema: true, schemaLabel: 'Target schema', schemaPlaceholder: 'orders_db', tableLabel: 'Target table', tablePlaceholder: 'orders', showFileFormat: false, showLoadMode: true },
  oracle: { showSchema: true, schemaLabel: 'Target schema', schemaPlaceholder: 'HR', tableLabel: 'Target table', tablePlaceholder: 'ORDERS', showFileFormat: false, showLoadMode: true },
  sqlserver: { showSchema: true, schemaLabel: 'Target schema', schemaPlaceholder: 'dbo', tableLabel: 'Target table', tablePlaceholder: 'Orders', showFileFormat: false, showLoadMode: true },
  bigquery: { showSchema: true, schemaLabel: 'Target dataset', schemaPlaceholder: 'analytics', tableLabel: 'Target table', tablePlaceholder: 'fct_orders', showFileFormat: false, showLoadMode: true },
  s3: { showSchema: false, schemaLabel: '', schemaPlaceholder: '', tableLabel: 'Object prefix / filename pattern', tablePlaceholder: 'orders/dt={{ds}}/part-*', showFileFormat: true, showLoadMode: false },
  gcs: { showSchema: false, schemaLabel: '', schemaPlaceholder: '', tableLabel: 'Object prefix / filename pattern', tablePlaceholder: 'orders/dt={{ds}}/part-*', showFileFormat: true, showLoadMode: false },
  rest_api: { showSchema: false, schemaLabel: '', schemaPlaceholder: '', tableLabel: 'Endpoint', tablePlaceholder: '/v1/orders', showFileFormat: false, showLoadMode: true },
  kafka: { showSchema: false, schemaLabel: '', schemaPlaceholder: '', tableLabel: 'Target topic', tablePlaceholder: 'orders.events', showFileFormat: false, showLoadMode: true },
  sftp: { showSchema: false, schemaLabel: '', schemaPlaceholder: '', tableLabel: 'Target path', tablePlaceholder: '/inbound/usage_*.csv', showFileFormat: true, showLoadMode: false },
}

export const LOAD_MODE_OPTIONS: { value: LoadMode; label: string }[] = [
  { value: 'insert', label: 'insert' },
  { value: 'update_merge', label: 'update & merge' },
  { value: 'truncate_insert', label: 'truncate & insert' },
]

export function loadModeLabel(value: LoadMode): string {
  return LOAD_MODE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export const FILE_FORMAT_OPTIONS: { value: FileFormat; label: string }[] = [
  { value: 'parquet', label: 'Parquet' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON (newline-delimited)' },
  { value: 'avro', label: 'Avro' },
  { value: 'orc', label: 'ORC' },
]

export const CONNECTION_FIELD_CONFIG: Record<ConnectionType, ConnectionFieldConfig> = {
  postgresql: {
    host: { show: true, label: 'Host', placeholder: 'orders-db.internal.company.com', required: true },
    port: { show: true, required: true },
    database: { show: true, label: 'Database', placeholder: 'orders', required: true },
  },
  mysql: {
    host: { show: true, label: 'Host', placeholder: 'orders-db.internal.company.com', required: true },
    port: { show: true, required: true },
    database: { show: true, label: 'Database', placeholder: 'orders', required: true },
  },
  oracle: {
    host: { show: true, label: 'Host', placeholder: 'orders-db.internal.company.com', required: true },
    port: { show: true, required: true },
    database: { show: true, label: 'Service name / SID', placeholder: 'ORCLPDB1', required: true },
  },
  sqlserver: {
    host: { show: true, label: 'Host', placeholder: 'orders-db.internal.company.com', required: true },
    port: { show: true, required: true },
    database: { show: true, label: 'Database', placeholder: 'orders', required: true },
  },
  bigquery: {
    host: { show: true, label: 'Project ID', placeholder: 'my-gcp-project', required: true },
    port: { show: false, required: false },
    database: { show: true, label: 'Dataset', placeholder: 'analytics', required: true },
  },
  s3: {
    host: { show: true, label: 'Bucket', placeholder: 'my-data-lake-bucket', required: true },
    port: { show: false, required: false },
    database: { show: true, label: 'Prefix / path', placeholder: 'raw/orders/', required: false },
  },
  gcs: {
    host: { show: true, label: 'Bucket', placeholder: 'my-gcs-bucket', required: true },
    port: { show: false, required: false },
    database: { show: true, label: 'Prefix / path', placeholder: 'raw/orders/', required: false },
  },
  rest_api: {
    host: { show: true, label: 'Base URL', placeholder: 'https://vendor-api.example.com', required: true },
    port: { show: false, required: false },
    database: { show: true, label: 'Resource path', placeholder: '/v1/orders', required: false },
  },
  kafka: {
    host: { show: true, label: 'Broker list', placeholder: 'broker1:9092,broker2:9092', required: true },
    port: { show: true, required: false },
    database: { show: true, label: 'Topic', placeholder: 'orders.events', required: true },
  },
  sftp: {
    host: { show: true, label: 'Host', placeholder: 'sftp.mediation-partner.com', required: true },
    port: { show: true, required: true },
    database: { show: true, label: 'Remote directory', placeholder: '/outbound/mediation', required: false },
  },
}

export function connectionTypeDefaults(current: ConnectionConfig, type: ConnectionType): ConnectionConfig {
  const meta = CONNECTION_TYPES.find((c) => c.value === type)
  const showsPort = CONNECTION_FIELD_CONFIG[type].port.show
  return {
    ...current,
    type,
    port: !showsPort ? '' : current.port === '' ? meta?.defaultPort ?? '' : current.port,
  }
}
