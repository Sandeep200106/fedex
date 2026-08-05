import type { AirflowTriggerConfig, ConnectionConfig, ConnectionType, PipelineConfig, SensorType } from '../types'

// Which Airflow sensor operator checks for data at a connection of this type.
export const SENSOR_TYPE_BY_CONNECTION: Record<ConnectionType, SensorType> = {
  gcs: 'gcs_object_sensor',
  s3: 's3_key_sensor',
  sftp: 'sftp_sensor',
  bigquery: 'bigquery_table_sensor',
  postgresql: 'sql_sensor',
  mysql: 'sql_sensor',
  oracle: 'sql_sensor',
  sqlserver: 'sql_sensor',
  rest_api: 'http_sensor',
  kafka: 'kafka_sensor',
}

export const SENSOR_OPERATOR_CLASS: Record<SensorType, string> = {
  gcs_object_sensor: 'GCSObjectExistenceSensor',
  s3_key_sensor: 'S3KeySensor',
  sftp_sensor: 'SFTPSensor',
  bigquery_table_sensor: 'BigQueryTableExistenceSensor',
  sql_sensor: 'SqlSensor',
  http_sensor: 'HttpSensor',
  kafka_sensor: 'AwaitMessageTriggerFunctionSensor',
}

export const CHECK_OBJECT_LABEL: Record<ConnectionType, { label: string; placeholder: string }> = {
  postgresql: { label: 'Table to check for data (schema.table)', placeholder: 'public.orders' },
  mysql: { label: 'Table to check for data (schema.table)', placeholder: 'orders_db.orders' },
  oracle: { label: 'Table to check for data (schema.table)', placeholder: 'HR.ORDERS' },
  sqlserver: { label: 'Table to check for data (schema.table)', placeholder: 'dbo.Orders' },
  bigquery: { label: 'Table to check for data (dataset.table)', placeholder: 'raw.orders' },
  s3: { label: 'Object key / prefix to check', placeholder: 'raw/orders/dt={{ds}}/part-*' },
  gcs: { label: 'Object key / prefix to check', placeholder: 'raw/orders/dt={{ds}}/part-*' },
  rest_api: { label: 'API resource path to check', placeholder: '/v1/orders/status' },
  kafka: { label: 'Topic to check for messages', placeholder: 'orders.events' },
  sftp: { label: 'Remote file path to check (glob pattern)', placeholder: '/inbound/vendor/orders_dt={{ds}}.csv' },
}

export function sensorTypeForConnection(type: ConnectionType): SensorType {
  return SENSOR_TYPE_BY_CONNECTION[type]
}

export function sensorOperatorLabel(type: ConnectionType): string {
  return SENSOR_OPERATOR_CLASS[sensorTypeForConnection(type)]
}

// Same naming standard as pipelineDisplayName in dataServices.ts, applied to Airflow
// scheduling configs — prefixed with "Airflow" so it's visible at a glance alongside
// "Dataflow"/"Dataproc"-prefixed pipeline names wherever the two are listed together.
// Prefers config_id (always a slug — see handleSave in AirflowConfigView) over the freeform
// name field, since real Airflow dag_ids can't contain spaces or commas.
export function airflowConfigDisplayName(config: Pick<AirflowTriggerConfig, 'name' | 'config_id'>): string {
  return `Airflow - ${config.config_id || config.name}`
}

// Table-backed connections (traditional RDBMS + BigQuery) have no file to sense — the
// sensor instead needs a date/timestamp/sequence column to check for a fresh row against.
// File/message/API-backed types (GCS, S3, SFTP, Kafka, REST API) check for the object/message
// itself and have no such column.
const TABLE_BASED_TYPES: ConnectionType[] = ['postgresql', 'mysql', 'oracle', 'sqlserver', 'bigquery']

export function requiresCheckColumn(type: ConnectionType): boolean {
  return TABLE_BASED_TYPES.includes(type)
}

// No real Airflow scheduler behind this yet, so "last run"/"next run" are mocked as a fixed
// offset either side of the commit time — good enough for the Recent DAGs list without
// pretending to parse the cron expression.
export function mockDagRunTimes(committedAt: Date): { lastRunAt: string; nextRunAt: string } {
  const sixHoursMs = 6 * 60 * 60 * 1000
  return {
    lastRunAt: new Date(committedAt.getTime() - sixHoursMs).toISOString(),
    nextRunAt: new Date(committedAt.getTime() + sixHoursMs).toISOString(),
  }
}

// No real Airflow webserver behind this app — points at a documentation-reserved example.com
// host (same placeholder convention as other mock hosts in this codebase, e.g. the REST API
// connection placeholder) so the DAG link behaves like a real one without resolving anywhere.
export function airflowUiUrl(dagId: string): string {
  return `https://airflow.example.com/dags/${encodeURIComponent(dagId)}/grid`
}

// Suggests a config name from whichever of the check connection / target pipeline are already
// picked, so the DAG name field isn't left blank while the rest of the form is filled in. Only
// ever pre-fills — the field stays a normal editable input the user can override at any time.
export function suggestAirflowConfigName(connectionName: string | undefined, pipelineDisplay: string | undefined): string {
  if (connectionName && pipelineDisplay) return `Check ${connectionName}, then trigger ${pipelineDisplay}`
  if (connectionName) return `Check ${connectionName}`
  if (pipelineDisplay) return `Trigger ${pipelineDisplay}`
  return ''
}

/** The Airflow DAG definition the Config API would commit — a sensor gating a TriggerDagRunOperator. */
export function buildAirflowDagConfig(config: AirflowTriggerConfig, checkConnection: ConnectionConfig | undefined, targetPipeline: PipelineConfig | undefined) {
  const sensorType = checkConnection ? sensorTypeForConnection(checkConnection.type) : 'gcs_object_sensor'
  const needsColumn = checkConnection ? requiresCheckColumn(checkConnection.type) : false
  return {
    dag_id: config.config_id,
    name: config.name,
    schedule: config.schedule,
    owner: config.owner,
    git_path: config.git_path,
    tasks: {
      check_data_available: {
        operator: SENSOR_OPERATOR_CLASS[sensorType],
        connection_ref: config.check_connection_ref,
        object: config.check_object,
        ...(needsColumn
          ? {
              check_column: config.check_column,
              check_operator: config.check_operator,
              check_value: config.check_value,
              sql: `SELECT 1 FROM ${config.check_object || '<table>'} WHERE ${config.check_column || '<column>'} ${config.check_operator || '>='} ${
                config.check_value === 'current_date' ? 'CURRENT_DATE' : `'${config.check_value || '{{ds}}'}'`
              } LIMIT 1;`,
            }
          : {}),
        poke_interval_seconds: config.poke_interval_seconds,
        timeout_seconds: config.timeout_seconds,
        mode: 'reschedule',
      },
      trigger_pipeline: {
        operator: 'TriggerDagRunOperator',
        depends_on: 'check_data_available',
        trigger_dag_id: targetPipeline?.pipeline_id ?? config.target_pipeline_id,
        wait_for_completion: false,
      },
    },
  }
}
