import type { AirflowTriggerConfig } from '../types'

const STORAGE_KEY = 'pipeline-builder-airflow-triggers'

export const DEFAULT_AIRFLOW_TRIGGERS: AirflowTriggerConfig[] = [
  {
    config_id: 'Check vendor orders file, then trigger merge',
    name: 'Check vendor orders file, then trigger merge',
    check_connection_ref: 'conn_mediation_sftp_prod',
    check_object: '/inbound/vendor/orders_dt={{ds}}.csv',
    poke_interval_seconds: 300,
    timeout_seconds: 21600,
    target_pipeline_id: 'pl_vendor_orders_api',
    schedule: { type: 'cron', expression: '30 * * * *', timezone: 'Asia/Kolkata' },
    owner: 'data-engineering',
    git_path: 'airflow/sense_vendor_orders_file_landed.json',
  },
  {
    config_id: 'Check inventory extract, then trigger full load',
    name: 'Check inventory extract, then trigger full load',
    check_connection_ref: 'conn_inventory_mysql_prod',
    check_object: 'inventory.stock_levels',
    check_column: 'updated_dt',
    check_operator: '>=',
    check_value: 'current_date',
    poke_interval_seconds: 600,
    timeout_seconds: 14400,
    target_pipeline_id: 'pl_inventory_full_load',
    schedule: { type: 'cron', expression: '0 2 * * *', timezone: 'Asia/Kolkata' },
    owner: 'data-engineering',
    git_path: 'airflow/sense_inventory_extract_ready.json',
  },
]

// Bump whenever DEFAULT_AIRFLOW_TRIGGERS entries are renamed, added, removed, or otherwise
// edited, so a browser whose saved version is behind gets healed on next load — same pattern
// as CONNECTIONS_VERSION in connectionsStore.ts.
const TRIGGERS_VERSION = 4
const VERSION_KEY = 'pipeline-builder-airflow-triggers-version'

// config_ids that used to be in DEFAULT_AIRFLOW_TRIGGERS and were renamed/replaced (not just
// added to) — listed explicitly so healing can drop the orphaned old copy instead of mistaking
// it for a config the user genuinely added themselves.
const RETIRED_CONFIG_IDS = new Set(['sense_vendor_orders_file_landed', 'sense_inventory_extract_ready'])

function healToCurrentDefaults(stored: AirflowTriggerConfig[]): AirflowTriggerConfig[] {
  const defaultIds = new Set(DEFAULT_AIRFLOW_TRIGGERS.map((c) => c.config_id))
  const userAdded = stored.filter((c) => !defaultIds.has(c.config_id) && !RETIRED_CONFIG_IDS.has(c.config_id))
  return [...DEFAULT_AIRFLOW_TRIGGERS, ...userAdded]
}

export function loadAirflowTriggers(): AirflowTriggerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_AIRFLOW_TRIGGERS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AIRFLOW_TRIGGERS

    const storedVersion = Number(localStorage.getItem(VERSION_KEY) ?? '0')
    return storedVersion < TRIGGERS_VERSION ? healToCurrentDefaults(parsed) : parsed
  } catch {
    return DEFAULT_AIRFLOW_TRIGGERS
  }
}

export function saveAirflowTriggers(configs: AirflowTriggerConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  localStorage.setItem(VERSION_KEY, String(TRIGGERS_VERSION))
}
