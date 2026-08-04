import type { ColumnInfo, ConnectionType, SchemaDriftChangeType } from '../types'

const COLUMN_SETS: Record<string, ColumnInfo[]> = {
  order: [
    { name: 'order_id', type: 'string' },
    { name: 'cust_id', type: 'string' },
    { name: 'amount', type: 'decimal(12,2)' },
    { name: 'status', type: 'string' },
    { name: 'created_dt', type: 'timestamp' },
    { name: 'updated_dt', type: 'timestamp' },
  ],
  invent: [
    { name: 'sku', type: 'string' },
    { name: 'warehouse_id', type: 'string' },
    { name: 'quantity_on_hand', type: 'integer' },
    { name: 'reorder_point', type: 'integer' },
    { name: 'updated_dt', type: 'timestamp' },
  ],
  customer: [
    { name: 'customer_id', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'full_name', type: 'string' },
    { name: 'country', type: 'string' },
    { name: 'created_dt', type: 'timestamp' },
  ],
  event: [
    { name: 'event_id', type: 'string' },
    { name: 'session_id', type: 'string' },
    { name: 'event_type', type: 'string' },
    { name: 'payload', type: 'string' },
    { name: 'event_ts', type: 'timestamp' },
  ],
}

const FALLBACK_COLUMNS: ColumnInfo[] = [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'created_dt', type: 'timestamp' },
  { name: 'updated_dt', type: 'timestamp' },
]

// Object storage / topic targets in our templates are landing zones with no
// pre-existing schema to introspect, so target column selection falls back to
// free text for these types instead of a dropdown.
export const TARGET_SCHEMA_EXISTS: Record<ConnectionType, boolean> = {
  postgresql: true,
  mysql: true,
  oracle: true,
  sqlserver: true,
  bigquery: true,
  kafka: true,
  s3: false,
  gcs: false,
  rest_api: false,
  sftp: false,
}

function pickColumnSet(object: string): ColumnInfo[] {
  const key = object.toLowerCase()
  const match = Object.keys(COLUMN_SETS).find((k) => key.includes(k))
  return match ? COLUMN_SETS[match] : FALLBACK_COLUMNS
}

// BigQuery reports its own type names rather than the generic ones used
// elsewhere in this mock — on purpose, so column mapping has to reconcile
// two different type vocabularies for the same underlying kind of data,
// same as it would against a real BigQuery schema.
const BIGQUERY_TYPE_MAP: Record<string, string> = {
  string: 'STRING',
  'decimal(12,2)': 'NUMERIC',
  integer: 'INT64',
  timestamp: 'TIMESTAMP',
  boolean: 'BOOL',
  date: 'DATE',
}

function toConnectionTypeFlavor(columns: ColumnInfo[], connectionType?: ConnectionType): ColumnInfo[] {
  if (connectionType !== 'bigquery') return columns
  return columns.map((c) => ({ ...c, type: BIGQUERY_TYPE_MAP[c.type] ?? c.type.toUpperCase() }))
}

export function fetchColumns(object: string, connectionType?: ConnectionType): Promise<ColumnInfo[]> {
  const trimmed = object.trim()
  if (!trimmed) return Promise.resolve([])
  const columns = toConnectionTypeFlavor(pickColumnSet(trimmed), connectionType)
  return new Promise((resolve) => {
    setTimeout(() => resolve(columns), 450)
  })
}

// Synchronous twin of fetchColumns, for callers (schema-drift baseline capture in
// runDqCheckNow) that can't await a Promise mid-simulation.
export function fetchColumnsSync(object: string, connectionType?: ConnectionType): ColumnInfo[] {
  const trimmed = object.trim()
  if (!trimmed) return []
  return toConnectionTypeFlavor(pickColumnSet(trimmed), connectionType)
}

// File objects have no table name to key off of — derive an equivalent lookup key
// from the path itself (e.g. gs://bucket/orders/dt={{ds}}/part-0.parquet -> "orders")
// so schema introspection works the same way for file and table sources.
export function deriveFileObjectKey(filePath: string): string {
  const withoutScheme = filePath.replace(/^[a-z0-9]+:\/\//i, '')
  const segments = withoutScheme.split('/').filter(Boolean)
  const middle = segments.slice(1, -1)
  const candidate = middle.find((seg) => !seg.includes('{') && !/^dt=/i.test(seg))
  return candidate ?? segments[0] ?? ''
}

const SURPRISE_COLUMN_POOL: ColumnInfo[] = [
  { name: 'loyalty_tier', type: 'string' },
  { name: '_ingested_at', type: 'timestamp' },
  { name: 'internal_flag', type: 'boolean' },
  { name: 'region_code', type: 'string' },
]

const TYPE_DRIFT_MAP: Record<string, string> = {
  integer: 'string',
  string: 'integer',
  'decimal(12,2)': 'decimal(18,4)',
  timestamp: 'string',
  boolean: 'string',
  date: 'timestamp',
}

export interface SchemaDriftMutation {
  column: string
  change_type: SchemaDriftChangeType
  previous_type?: string
  new_type?: string
}

export interface SchemaDriftSimulation {
  columns: ColumnInfo[]
  mutations: SchemaDriftMutation[]
}

/**
 * There is no real "yesterday vs today" schema to diff in this demo, so this
 * mutates a stable, previously-captured baseline into a plausible "today" —
 * ~25% of the time nothing changes; otherwise one column is added, removed, or
 * retyped, mirroring the handful of ways a real source schema actually drifts.
 */
export function mutateColumnsForDemo(baseline: ColumnInfo[], options: { includeTypeChanges: boolean } = { includeTypeChanges: true }): SchemaDriftSimulation {
  if (baseline.length === 0 || Math.random() < 0.25) {
    return { columns: baseline, mutations: [] }
  }

  const kinds: SchemaDriftChangeType[] = options.includeTypeChanges
    ? ['column_added', 'column_removed', 'type_changed']
    : ['column_added', 'column_removed']
  const kind = kinds[Math.floor(Math.random() * kinds.length)]

  if (kind === 'column_added') {
    const existingNames = new Set(baseline.map((c) => c.name))
    const candidate = SURPRISE_COLUMN_POOL.find((c) => !existingNames.has(c.name)) ?? SURPRISE_COLUMN_POOL[0]
    return {
      columns: [...baseline, candidate],
      mutations: [{ column: candidate.name, change_type: 'column_added', new_type: candidate.type }],
    }
  }

  if (kind === 'column_removed' && baseline.length > 1) {
    const index = Math.floor(Math.random() * baseline.length)
    const removed = baseline[index]
    return {
      columns: baseline.filter((_, i) => i !== index),
      mutations: [{ column: removed.name, change_type: 'column_removed', previous_type: removed.type }],
    }
  }

  const index = Math.floor(Math.random() * baseline.length)
  const target = baseline[index]
  const rawType = target.type.split('(')[0].toLowerCase()
  const newType = TYPE_DRIFT_MAP[target.type] ?? TYPE_DRIFT_MAP[rawType] ?? 'string'
  if (newType === target.type) return { columns: baseline, mutations: [] }
  return {
    columns: baseline.map((c, i) => (i === index ? { ...c, type: newType } : c)),
    mutations: [{ column: target.name, change_type: 'type_changed', previous_type: target.type, new_type: newType }],
  }
}

// Normalizes type names from different systems (e.g. Postgres "decimal(12,2)"
// vs BigQuery "NUMERIC") into a common category so column mapping can flag
// genuine mismatches without flagging every cross-system pairing as one.
const TYPE_GROUPS: Record<string, string> = {
  string: 'text',
  varchar: 'text',
  text: 'text',
  integer: 'number',
  int: 'number',
  int64: 'number',
  bigint: 'number',
  decimal: 'number',
  numeric: 'number',
  float: 'number',
  float64: 'number',
  boolean: 'boolean',
  bool: 'boolean',
  timestamp: 'datetime',
  datetime: 'datetime',
  date: 'date',
}

export function normalizeType(type: string): string {
  const key = type.split('(')[0].trim().toLowerCase()
  return TYPE_GROUPS[key] ?? key
}

export function typesCompatible(a: string, b: string): boolean {
  return normalizeType(a) === normalizeType(b)
}

// Only monotonically increasing / point-in-time columns make sense to track a
// high-water mark against — dates, timestamps, and integer sequence/ID columns.
// Free-text, boolean, and decimal columns are excluded even though decimals
// normalize into the same "number" group as integers.
const INCREMENTAL_KEY_RAW_TYPES = new Set(['timestamp', 'datetime', 'date', 'integer', 'int', 'int64', 'bigint'])

export function isIncrementalKeyCandidate(type: string): boolean {
  const key = type.split('(')[0].trim().toLowerCase()
  return INCREMENTAL_KEY_RAW_TYPES.has(key)
}
