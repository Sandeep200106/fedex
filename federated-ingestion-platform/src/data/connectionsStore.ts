import type { ConnectionConfig } from '../types'

const STORAGE_KEY = 'pipeline-builder-connections'

const DEFAULT_CONNECTIONS: ConnectionConfig[] = [
  {
    connection_id: 'conn_orders_db_prod',
    name: 'Orders DB (PostgreSQL, Production) — orders',
    type: 'postgresql',
    environment: 'prod',
    host: 'orders-db.internal.company.com',
    port: 5432,
    database: 'orders',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/orders_db_prod' },
    tags: ['orders', 'prod', 'postgres'],
    owner: 'data-engineering',
    created_at: '2026-07-01T09:00:00Z',
  },
  {
    connection_id: 'conn_hr_oracle_prod',
    name: 'HR Oracle (Production) — ORCLPDB1',
    type: 'oracle',
    environment: 'prod',
    host: 'hr-oracle.internal.company.com',
    port: 1521,
    database: 'ORCLPDB1',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/hr_oracle_prod' },
    tags: ['hr', 'prod', 'oracle'],
    owner: 'data-engineering',
    created_at: '2026-07-02T09:00:00Z',
  },
  {
    connection_id: 'conn_clickstream_kafka',
    name: 'Clickstream Kafka — clickstream.events',
    type: 'kafka',
    environment: 'prod',
    host: 'broker1:9092,broker2:9092',
    port: 9092,
    database: 'clickstream.events',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/clickstream_kafka' },
    tags: ['clickstream', 'streaming'],
    owner: 'data-engineering',
    created_at: '2026-07-03T09:00:00Z',
  },
  {
    connection_id: 'conn_gcs_lake_prod',
    name: 'Primary Data Lake (GCS) — raw/',
    type: 'gcs',
    environment: 'prod',
    host: 'prodapt-data-lake',
    port: '',
    database: 'raw/',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/gcs_lake_prod' },
    tags: ['lake', 'gcs', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-03T09:30:00Z',
  },
  {
    connection_id: 'conn_analytics_bigquery_prod',
    name: 'Customer Analytics Warehouse (BigQuery) — analytics',
    type: 'bigquery',
    environment: 'prod',
    host: 'prodapt-analytics',
    port: '',
    database: 'analytics',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/analytics_bigquery_prod' },
    tags: ['analytics', 'bigquery', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-04T09:00:00Z',
  },
  {
    connection_id: 'conn_inventory_mysql_prod',
    name: 'Inventory DB (MySQL, Production) — inventory',
    type: 'mysql',
    environment: 'prod',
    host: 'inventory-db.internal.company.com',
    port: 3306,
    database: 'inventory',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/inventory_mysql_prod' },
    tags: ['inventory', 'prod', 'mysql'],
    owner: 'data-engineering',
    created_at: '2026-07-05T09:00:00Z',
  },
  {
    connection_id: 'conn_billing_sqlserver_prod',
    name: 'Billing Settlement DB (SQL Server) — Billing',
    type: 'sqlserver',
    environment: 'prod',
    host: 'billing-db.internal.company.com',
    port: 1433,
    database: 'Billing',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/billing_sqlserver_prod' },
    tags: ['billing', 'prod', 'sqlserver'],
    owner: 'data-engineering',
    created_at: '2026-07-05T09:30:00Z',
  },
  {
    connection_id: 'conn_ncm_s3_prod',
    name: 'NCM Usage Bucket (S3) — raw/ncm/',
    type: 's3',
    environment: 'prod',
    host: 'ncm-data-lake-bucket',
    port: '',
    database: 'raw/ncm/',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/ncm_s3_prod' },
    tags: ['ncm', 's3', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-06T09:30:00Z',
  },
  {
    connection_id: 'conn_ookla_rest_api_prod',
    name: 'Ookla Speedtest API — /v1/benchmarks',
    type: 'rest_api',
    environment: 'prod',
    host: 'https://api.ookla-speedtest-intelligence.example.com',
    port: 443,
    database: '/v1/benchmarks',
    auth: { method: 'oauth2', secret_ref: 'vault://data-eng/connections/ookla_rest_api_prod' },
    tags: ['benchmarking', 'rest_api', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-07T09:00:00Z',
  },
  {
    connection_id: 'conn_mediation_sftp_prod',
    name: 'Mediation Partner (SFTP) — /outbound/mediation',
    type: 'sftp',
    environment: 'prod',
    host: 'sftp.mediation-partner.com',
    port: 22,
    database: '/outbound/mediation',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/mediation_sftp_prod' },
    tags: ['mediation', 'sftp', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-07T09:30:00Z',
  },
  // Second examples for the connection types more than one template depends on
  // (postgresql x3, oracle x2, gcs x7, bigquery x2), so the Source/Target pickers
  // in the wizard show a real choice instead of a single, forced default.
  {
    connection_id: 'conn_marketing_postgresql_prod',
    name: 'Marketing DB (PostgreSQL, Production) — marketing',
    type: 'postgresql',
    environment: 'prod',
    host: 'marketing-db.internal.company.com',
    port: 5432,
    database: 'marketing',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/marketing_postgresql_prod' },
    tags: ['marketing', 'prod', 'postgres'],
    owner: 'data-engineering',
    created_at: '2026-07-08T09:00:00Z',
  },
  {
    connection_id: 'conn_billing_oracle_prod',
    name: 'Billing & Orders OLTP (Oracle) — BILLPDB1',
    type: 'oracle',
    environment: 'prod',
    host: 'billing-oracle.internal.company.com',
    port: 1521,
    database: 'BILLPDB1',
    auth: { method: 'secret_manager', secret_ref: 'vault://data-eng/connections/billing_oracle_prod' },
    tags: ['billing', 'prod', 'oracle'],
    owner: 'data-engineering',
    created_at: '2026-07-08T09:30:00Z',
  },
  {
    connection_id: 'conn_gcs_mediation_prod',
    name: 'Mediation Files Lake (GCS) — raw/mediation/',
    type: 'gcs',
    environment: 'prod',
    host: 'prodapt-mediation-lake',
    port: '',
    database: 'raw/mediation/',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/gcs_mediation_prod' },
    tags: ['mediation', 'gcs', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-09T09:00:00Z',
  },
  {
    connection_id: 'conn_billing_bigquery_prod',
    name: 'Billing Warehouse (BigQuery) — billing',
    type: 'bigquery',
    environment: 'prod',
    host: 'prodapt-billing',
    port: '',
    database: 'billing',
    auth: { method: 'iam_role', secret_ref: 'vault://data-eng/connections/billing_bigquery_prod' },
    tags: ['billing', 'bigquery', 'prod'],
    owner: 'data-engineering',
    created_at: '2026-07-09T09:30:00Z',
  },
]

// Bump this whenever DEFAULT_CONNECTIONS entries are renamed, added, removed, or otherwise
// edited. A browser whose saved version is behind gets healed on next load: every known seed
// connection_id is reset to the current DEFAULT_CONNECTIONS values (so renames/edits actually
// reach users who already have data saved), while any connection_id NOT in DEFAULT_CONNECTIONS
// — i.e. one the user genuinely added themselves via "+ New connection" — is left untouched.
const CONNECTIONS_VERSION = 5
const VERSION_KEY = 'pipeline-builder-connections-version'

// connection_ids that used to be in DEFAULT_CONNECTIONS and were renamed/replaced (not just
// added to) — listed explicitly so healing can drop the orphaned old copy instead of mistaking
// it for a connection the user genuinely added themselves.
const RETIRED_CONNECTION_IDS = new Set(['conn_gcs_returns_prod'])

function healToCurrentDefaults(stored: ConnectionConfig[]): ConnectionConfig[] {
  const defaultIds = new Set(DEFAULT_CONNECTIONS.map((c) => c.connection_id))
  const userAdded = stored.filter((c) => !defaultIds.has(c.connection_id) && !RETIRED_CONNECTION_IDS.has(c.connection_id))
  return [...DEFAULT_CONNECTIONS, ...userAdded]
}

export function loadConnections(): ConnectionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONNECTIONS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CONNECTIONS

    const storedVersion = Number(localStorage.getItem(VERSION_KEY) ?? '0')
    return storedVersion < CONNECTIONS_VERSION ? healToCurrentDefaults(parsed) : parsed
  } catch {
    return DEFAULT_CONNECTIONS
  }
}

export function saveConnections(connections: ConnectionConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  localStorage.setItem(VERSION_KEY, String(CONNECTIONS_VERSION))
}
