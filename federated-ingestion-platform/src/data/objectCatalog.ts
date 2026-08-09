import type { ConnectionConfig, ConnectionType } from '../types'

/**
 * No live schema/bucket introspection backend exists, so this is a mock "what's actually in
 * there" catalog the Mapping step's source/target object pickers use to offer a dropdown of
 * plausible real-looking choices instead of a blank free-text field. Keyed by connection_id so
 * each connection's list matches its own domain (orders DB shows order tables, the mediation
 * GCS bucket shows mediation paths, etc.) — a connection not in here (e.g. one a user adds
 * themselves) falls back to a generic per-type list.
 *
 * Source and target entries are kept separate because the two sides are shaped differently for
 * the same connection type: a source object is one combined "schema.table" (or full bucket
 * path) string, per SOURCE_OBJECT_CONFIG in templates.ts, while a target with its own schema
 * field (TARGET_OBJECT_CONFIG.showSchema) only needs the bare table name, and a target file path
 * is conventionally relative (no repeated bucket-root prefix).
 */
const SOURCE_OBJECT_CATALOG: Record<string, string[]> = {
  conn_orders_db_prod: ['public.orders', 'public.order_items', 'public.customers', 'public.payments'],
  conn_hr_oracle_prod: ['HR.EMPLOYEES', 'HR.DEPARTMENTS', 'HR.PAYROLL', 'HR.TIMESHEETS'],
  conn_clickstream_kafka: ['clickstream.events', 'clickstream.pageviews', 'clickstream.sessions'],
  conn_gcs_lake_prod: ['raw/orders/*.parquet', 'raw/inventory/*.parquet', 'raw/clickstream_events/*.json'],
  conn_analytics_bigquery_prod: ['analytics.DIM_INVENTORY', 'analytics.FCT_ORDERS', 'analytics.DIM_CUSTOMER'],
  conn_inventory_mysql_prod: ['inventory.stock_levels', 'inventory.warehouses', 'inventory.reorder_thresholds'],
  conn_billing_sqlserver_prod: ['dbo.Invoices', 'dbo.Payments', 'dbo.Settlements'],
  conn_ncm_s3_prod: ['raw/ncm/usage/*.csv', 'raw/ncm/devices/*.csv'],
  conn_ookla_rest_api_prod: ['/v1/benchmarks', '/v1/devices', '/v1/network-tests'],
  conn_mediation_sftp_prod: ['/outbound/mediation/usage_*.csv', '/outbound/mediation/settlements_*.csv'],
  conn_marketing_postgresql_prod: ['public.campaigns', 'public.leads', 'public.email_events'],
  conn_billing_oracle_prod: ['BILLING.ORDERS', 'BILLING.CUSTOMERS', 'BILLING.ACCOUNTS'],
  conn_gcs_mediation_prod: ['raw/mediation/cdrs/*.csv', 'raw/mediation/settlements/*.csv'],
  conn_billing_bigquery_prod: ['billing.billing_orders', 'billing.billing_accounts', 'billing.invoices'],
}

const TARGET_OBJECT_CATALOG: Record<string, string[]> = {
  conn_orders_db_prod: ['orders', 'order_items', 'customers', 'payments'],
  conn_hr_oracle_prod: ['EMPLOYEES', 'DEPARTMENTS', 'PAYROLL', 'TIMESHEETS'],
  conn_clickstream_kafka: ['events', 'pageviews', 'sessions'],
  conn_gcs_lake_prod: ['orders/dt={{ds}}/part-*', 'inventory/dt={{ds}}/part-*', 'clickstream/dt={{ds}}/part-*'],
  conn_analytics_bigquery_prod: ['DIM_INVENTORY', 'FCT_ORDERS', 'DIM_CUSTOMER'],
  conn_inventory_mysql_prod: ['stock_levels', 'warehouses', 'reorder_thresholds'],
  conn_billing_sqlserver_prod: ['Invoices', 'Payments', 'Settlements'],
  conn_ncm_s3_prod: ['ncm/usage/dt={{ds}}/part-*', 'ncm/devices/dt={{ds}}/part-*'],
  conn_ookla_rest_api_prod: ['/v1/benchmarks', '/v1/devices', '/v1/network-tests'],
  conn_mediation_sftp_prod: ['/inbound/mediation/usage_*.csv', '/inbound/mediation/settlements_*.csv'],
  conn_marketing_postgresql_prod: ['campaigns', 'leads', 'email_events'],
  conn_billing_oracle_prod: ['ORDERS', 'CUSTOMERS', 'ACCOUNTS'],
  conn_gcs_mediation_prod: ['mediation/cdrs/dt={{ds}}/part-*', 'mediation/settlements/dt={{ds}}/part-*'],
  conn_billing_bigquery_prod: ['billing_orders', 'billing_accounts', 'invoices'],
}

const FALLBACK_SOURCE_BY_TYPE: Record<ConnectionType, string[]> = {
  postgresql: ['public.orders', 'public.customers', 'public.events'],
  mysql: ['app.orders', 'app.customers', 'app.events'],
  oracle: ['APP.ORDERS', 'APP.CUSTOMERS', 'APP.EVENTS'],
  sqlserver: ['dbo.Orders', 'dbo.Customers', 'dbo.Events'],
  bigquery: ['dataset.fct_orders', 'dataset.dim_customer', 'dataset.events'],
  s3: ['raw/data/*.parquet'],
  gcs: ['raw/data/*.parquet'],
  rest_api: ['/v1/resource'],
  kafka: ['app.events'],
  sftp: ['/outbound/data_*.csv'],
}

const FALLBACK_TARGET_BY_TYPE: Record<ConnectionType, string[]> = {
  postgresql: ['orders', 'customers', 'events'],
  mysql: ['orders', 'customers', 'events'],
  oracle: ['ORDERS', 'CUSTOMERS', 'EVENTS'],
  sqlserver: ['Orders', 'Customers', 'Events'],
  bigquery: ['fct_orders', 'dim_customer', 'events'],
  s3: ['data/dt={{ds}}/part-*'],
  gcs: ['data/dt={{ds}}/part-*'],
  rest_api: ['/v1/resource'],
  kafka: ['events'],
  sftp: ['/inbound/data_*.csv'],
}

function fetchObjects(catalog: Record<string, string[]>, fallback: Record<ConnectionType, string[]>, connection: ConnectionConfig | undefined): Promise<string[]> {
  if (!connection) return Promise.resolve([])
  const objects = catalog[connection.connection_id] ?? fallback[connection.type] ?? []
  return new Promise((resolve) => {
    setTimeout(() => resolve(objects), 350)
  })
}

export function fetchAvailableSourceObjects(connection: ConnectionConfig | undefined): Promise<string[]> {
  return fetchObjects(SOURCE_OBJECT_CATALOG, FALLBACK_SOURCE_BY_TYPE, connection)
}

export function fetchAvailableTargetObjects(connection: ConnectionConfig | undefined): Promise<string[]> {
  return fetchObjects(TARGET_OBJECT_CATALOG, FALLBACK_TARGET_BY_TYPE, connection)
}
