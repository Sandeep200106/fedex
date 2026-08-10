import type { ConnectionType, DedupDetail, DqCheckStatus, DqExecution, DqFileSample, DqRuleSet, FreshnessDetail, PipelineConfig, RuleFailureDetail, SchemaDriftDetail } from '../types'
import { buildDebugSelectForRule, buildDedupDebugSql, buildFreshnessDebugSql, buildSchemaIntrospectionSql } from './dqSqlGenerator'
import { mutateColumnsForDemo } from './schemaIntrospection'
import { QUALITY_RULE_LABELS } from './qualityRules'

// Anchors the seeded history/execution mock data to whenever the app actually loads, instead
// of a fixed past date that silently goes stale (the Size trend chart labels the last history
// entry "Today" regardless of its date field — see FileSizeChart.tsx — so a hardcoded date
// eventually claims a day from months ago is "Today"). offset 0 = today, negative = past.
function daysAgoIso(offset: number, hh = 0, mm = 0, ss = 0): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, hh, mm, ss))
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function daysAgoDate(offset: number): string {
  return daysAgoIso(offset).slice(0, 10)
}

// Narratively "inherited" from each pipeline's dedupe transformation, since the
// wizard's PipelineConfig and this DQ tab's DqRuleSet are separate, unlinked mock
// datasets in this demo — used only to pre-fill sensible key_columns defaults below.
const MOCK_DEDUP_KEYS_BY_PIPELINE_ID: Record<string, string[]> = {
  pl_orders_feed_gcs: ['order_id'],
  pl_clickstream_gcs: ['event_id'],
  pl_vendor_feed_gcs: ['id'],
  pl_inventory_snapshot_gcs: ['sku', 'warehouse_id'],
  pl_customer_master_bigquery: ['customer_id'],
  pl_mediation_usage_gcs: [],
  pl_billing_orders_cdc_bigquery: ['order_id'],
}

export const MOCK_DQ_RULE_SETS: DqRuleSet[] = [
  {
    pipeline_id: 'pl_orders_feed_gcs',
    pipeline_label: 'Orders Feed (GCS)',
    source_kind: 'file',
    connection_ref: 'conn_gcs_lake_prod',
    table_schema: '',
    table_name: '',
    file_path: 'gs://my-gcs-bucket/orders/dt={{ds}}/part-0.parquet',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [
      { field: 'amount', rule: 'range', min: 0, max: 100000 },
      { field: 'status', rule: 'allowed_values', values: ['created', 'shipped', 'cancelled'] },
      { field: 'order_id', rule: 'unique' },
    ],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_orders_feed_gcs, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '30 6 * * *', timezone: 'Asia/Kolkata' },
    history: [
      { date: daysAgoDate(-7), file_exists: true, size_bytes: 162_400_000 },
      { date: daysAgoDate(-6), file_exists: true, size_bytes: 158_900_000 },
      { date: daysAgoDate(-5), file_exists: true, size_bytes: 171_200_000 },
      { date: daysAgoDate(-4), file_exists: true, size_bytes: 165_800_000 },
      { date: daysAgoDate(-3), file_exists: true, size_bytes: 160_100_000 },
      { date: daysAgoDate(-2), file_exists: true, size_bytes: 168_300_000 },
      { date: daysAgoDate(-1), file_exists: true, size_bytes: 166_900_000 },
      { date: daysAgoDate(0), file_exists: true, size_bytes: 0 },
    ],
  },
  {
    pipeline_id: 'pl_clickstream_gcs',
    pipeline_label: 'Clickstream Events (GCS)',
    source_kind: 'file',
    connection_ref: 'conn_gcs_lake_prod',
    table_schema: '',
    table_name: '',
    file_path: 'gs://my-gcs-bucket/clickstream/dt={{ds}}/part-*.json',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [{ field: 'event_type', rule: 'allowed_values', values: ['page_view', 'click', 'purchase'] }],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_clickstream_gcs, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '0 4 * * *', timezone: 'Asia/Kolkata' },
    history: [
      { date: daysAgoDate(-6), file_exists: true, size_bytes: 480_000_000 },
      { date: daysAgoDate(-5), file_exists: true, size_bytes: 512_000_000 },
      { date: daysAgoDate(-4), file_exists: true, size_bytes: 495_000_000 },
      { date: daysAgoDate(-3), file_exists: true, size_bytes: 470_000_000 },
      { date: daysAgoDate(-2), file_exists: true, size_bytes: 505_000_000 },
      { date: daysAgoDate(-1), file_exists: true, size_bytes: 488_000_000 },
      { date: daysAgoDate(0), file_exists: true, size_bytes: 861_000_000 },
    ],
  },
  {
    pipeline_id: 'pl_vendor_feed_gcs',
    pipeline_label: 'Vendor Feed (GCS)',
    source_kind: 'file',
    connection_ref: 'conn_gcs_lake_prod',
    table_schema: '',
    table_name: '',
    file_path: 'gs://my-gcs-bucket/vendor/dt={{ds}}/orders.csv',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 25 },
    quality_rules_enabled: false,
    quality_rules: [{ field: 'customer_email', rule: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$' }],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_vendor_feed_gcs, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '30 5 * * *', timezone: 'Asia/Kolkata' },
    history: [
      { date: daysAgoDate(-6), file_exists: true, size_bytes: 21_400_000 },
      { date: daysAgoDate(-5), file_exists: true, size_bytes: 23_100_000 },
      { date: daysAgoDate(-4), file_exists: true, size_bytes: 20_800_000 },
      { date: daysAgoDate(-3), file_exists: true, size_bytes: 22_600_000 },
      { date: daysAgoDate(-2), file_exists: true, size_bytes: 21_900_000 },
      { date: daysAgoDate(-1), file_exists: true, size_bytes: 22_300_000 },
      { date: daysAgoDate(0), file_exists: false, size_bytes: null },
    ],
  },
  {
    pipeline_id: 'pl_inventory_snapshot_gcs',
    pipeline_label: 'Inventory Snapshot (GCS)',
    source_kind: 'file',
    connection_ref: 'conn_gcs_lake_prod',
    table_schema: '',
    table_name: '',
    file_path: 'gs://my-gcs-bucket/inventory/dt={{ds}}/snapshot.parquet',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 15 },
    quality_rules_enabled: false,
    quality_rules: [{ field: 'quantity_on_hand', rule: 'range', min: 0, max: 1000000 }],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_inventory_snapshot_gcs, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '0 3 * * *', timezone: 'Asia/Kolkata' },
    history: [
      { date: daysAgoDate(-6), file_exists: true, size_bytes: 2_140_000_000 },
      { date: daysAgoDate(-5), file_exists: true, size_bytes: 2_180_000_000 },
      { date: daysAgoDate(-4), file_exists: false, size_bytes: null },
      { date: daysAgoDate(-3), file_exists: true, size_bytes: 2_205_000_000 },
      { date: daysAgoDate(-2), file_exists: true, size_bytes: 2_190_000_000 },
      { date: daysAgoDate(-1), file_exists: true, size_bytes: 2_170_000_000 },
      { date: daysAgoDate(0), file_exists: true, size_bytes: 2_212_000_000 },
    ],
  },
  {
    pipeline_id: 'pl_customer_master_bigquery',
    pipeline_label: 'Customer Master (BigQuery)',
    source_kind: 'table',
    connection_ref: 'conn_analytics_bigquery_prod',
    table_schema: 'analytics',
    table_name: 'customer_master',
    file_path: '',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [
      { field: 'customer_id', rule: 'unique' },
      { field: 'email', rule: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      { field: 'country', rule: 'allowed_values', values: ['US', 'CA', 'MX', 'IN', 'GB'] },
    ],
    custom_sql_checks: [
      {
        id: 'csc_freshness',
        label: 'No rows loaded in the last 24h (freshness)',
        sql: 'SELECT COUNT(*) AS rows_loaded_last_24h\nFROM `analytics.customer_master`\nWHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR);',
      },
    ],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_customer_master_bigquery, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '0 5 * * *', timezone: 'Asia/Kolkata' },
    history: [],
  },
  {
    pipeline_id: 'pl_mediation_usage_gcs',
    pipeline_label: 'Mediation Usage Files (SFTP → GCS)',
    source_kind: 'file',
    connection_ref: 'conn_gcs_mediation_prod',
    table_schema: '',
    table_name: '',
    file_path: 'gs://prodapt-mediation-lake/mediation/dt={{ds}}/usage.csv',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_mediation_usage_gcs, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '0 7 * * *', timezone: 'Asia/Kolkata' },
    history: [],
  },
  {
    pipeline_id: 'pl_billing_orders_cdc_bigquery',
    pipeline_label: 'Billing / Order Replication (CDC, BigQuery)',
    source_kind: 'table',
    connection_ref: 'conn_billing_bigquery_prod',
    table_schema: 'billing',
    table_name: 'billing_orders',
    file_path: '',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [{ field: 'order_id', rule: 'not_null' }],
    custom_sql_checks: [
      {
        id: 'csc_reconciliation',
        label: 'Source vs. target row-count reconciliation',
        sql: 'SELECT COUNT(*) AS target_row_count\nFROM `billing.billing_orders`;',
      },
    ],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: MOCK_DEDUP_KEYS_BY_PIPELINE_ID.pl_billing_orders_cdc_bigquery, duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '*/15 * * * *', timezone: 'Asia/Kolkata' },
    history: [],
  },
]

export const MOCK_DQ_EXECUTIONS: DqExecution[] = [
  { id: 'dqe_1', pipeline_id: 'pl_orders_feed_gcs', executed_at: daysAgoIso(-1, 6, 30, 4), trigger: 'scheduled', status: 'pass', message: 'Size is within 20% of the 7-day average.' },
  { id: 'dqe_2', pipeline_id: 'pl_orders_feed_gcs', executed_at: daysAgoIso(-2, 6, 30, 3), trigger: 'scheduled', status: 'pass', message: 'Size is within 20% of the 7-day average.' },
  { id: 'dqe_3', pipeline_id: 'pl_orders_feed_gcs', executed_at: daysAgoIso(-3, 6, 30, 5), trigger: 'scheduled', status: 'pass', message: 'Size is within 20% of the 7-day average.' },
  { id: 'dqe_4', pipeline_id: 'pl_clickstream_gcs', executed_at: daysAgoIso(0, 4, 0, 3), trigger: 'scheduled', status: 'warning', message: 'Size deviates +75.1% from the 7-day average — exceeds the 20% threshold.' },
  { id: 'dqe_5', pipeline_id: 'pl_clickstream_gcs', executed_at: daysAgoIso(-1, 4, 0, 2), trigger: 'scheduled', status: 'pass', message: 'Size is within 20% of the 7-day average.' },
  { id: 'dqe_6', pipeline_id: 'pl_clickstream_gcs', executed_at: daysAgoIso(-2, 4, 0, 4), trigger: 'scheduled', status: 'pass', message: 'Size is within 20% of the 7-day average.' },
  { id: 'dqe_7', pipeline_id: 'pl_vendor_feed_gcs', executed_at: daysAgoIso(0, 5, 30, 11), trigger: 'scheduled', status: 'fail', message: 'File not found at gs://my-gcs-bucket/vendor/dt={{ds}}/orders.csv' },
  { id: 'dqe_8', pipeline_id: 'pl_vendor_feed_gcs', executed_at: daysAgoIso(-1, 5, 30, 2), trigger: 'scheduled', status: 'pass', message: 'Size is within 25% of the 7-day average.' },
  { id: 'dqe_9', pipeline_id: 'pl_vendor_feed_gcs', executed_at: daysAgoIso(-2, 5, 30, 3), trigger: 'scheduled', status: 'pass', message: 'Size is within 25% of the 7-day average.' },
  { id: 'dqe_10', pipeline_id: 'pl_inventory_snapshot_gcs', executed_at: daysAgoIso(0, 3, 0, 6), trigger: 'scheduled', status: 'pass', message: 'Size is within 15% of the 7-day average.' },
  { id: 'dqe_11', pipeline_id: 'pl_inventory_snapshot_gcs', executed_at: daysAgoIso(-1, 3, 0, 4), trigger: 'scheduled', status: 'pass', message: 'Size is within 15% of the 7-day average.' },
  { id: 'dqe_12', pipeline_id: 'pl_inventory_snapshot_gcs', executed_at: daysAgoIso(-4, 3, 0, 8), trigger: 'scheduled', status: 'fail', message: 'File not found at gs://my-gcs-bucket/inventory/dt={{ds}}/snapshot.parquet' },
  // Deliberately no "zero-byte file" execution here — that exact scenario is already cited
  // as an Implemented mechanism in the case-study catalog (Flat Files Flow B), so recording
  // it again here would show the same thing as both "already handled" and "a live failure."
  // Column-rule violations below are new patterns distinct from the case-study catalog
  // (allowed-values/regex/range drift, not one of the 20 named pattern checks) — they
  // exercise the table-kind pipelines' 'Run check now' path (simulateTableRuleCheck),
  // which file-kind pipelines above don't go through.
  {
    id: 'dqe_14',
    pipeline_id: 'pl_customer_master_bigquery',
    executed_at: '2026-07-10T05:00:06Z',
    trigger: 'scheduled',
    status: 'fail',
    message: "1 of 3 rules failed: 'country' allowed values (3 rows).",
    rule_failures: [
      {
        field: 'country',
        rule: 'allowed_values',
        violation_count: 3,
        debug_sql: "-- Records failing the allowed_values check on 'country'\nSELECT *\nFROM `analytics.customer_master`\nWHERE country NOT IN ('US', 'CA', 'MX', 'IN', 'GB')\nLIMIT 100;",
      },
    ],
  },
  {
    id: 'dqe_15',
    pipeline_id: 'pl_customer_master_bigquery',
    executed_at: '2026-07-11T05:00:07Z',
    trigger: 'scheduled',
    status: 'fail',
    message: "2 of 3 rules failed: 'country' allowed values (4 rows); 'email' regex pattern (2 rows).",
    rule_failures: [
      {
        field: 'country',
        rule: 'allowed_values',
        violation_count: 4,
        debug_sql: "-- Records failing the allowed_values check on 'country'\nSELECT *\nFROM `analytics.customer_master`\nWHERE country NOT IN ('US', 'CA', 'MX', 'IN', 'GB')\nLIMIT 100;",
      },
      {
        field: 'email',
        rule: 'regex',
        violation_count: 2,
        debug_sql: "-- Records failing the regex check on 'email'\nSELECT *\nFROM `analytics.customer_master`\nWHERE NOT REGEXP_CONTAINS(email, r'^[^@]+@[^@]+\\.[^@]+$')\nLIMIT 100;",
      },
    ],
  },
  // A dedicated, previously-unused pattern (schema_drift, not yet shown anywhere in Live DQ
  // issues) paired 1:1 with a Job History run on the SAME pipeline_id and the SAME timestamp —
  // so this one is designed to be tested end-to-end: see it here, adopt it, then find the
  // matching failed run in Job History and rerun it.
  {
    id: 'dqe_17',
    pipeline_id: 'pl_billing_orders_cdc_bigquery',
    executed_at: '2026-07-13T02:15:21Z',
    trigger: 'scheduled',
    status: 'fail',
    message: "Schema drift detected: column 'legacy_status' removed (was STRING).",
    schema_drift_details: [
      {
        column: 'legacy_status',
        change_type: 'column_removed',
        previous_type: 'STRING',
        introspection_sql:
          "-- What a real implementation would query instead of this mock diff\nSELECT column_name, data_type\nFROM `billing`.INFORMATION_SCHEMA.COLUMNS\nWHERE table_name = 'billing_orders'\nORDER BY ordinal_position;",
      },
    ],
  },
]

export function computeAverage(history: DqFileSample[], lookbackDays: number): number | null {
  const priorDays = history.slice(0, -1).slice(-lookbackDays)
  const sizes = priorDays.filter((d) => d.file_exists && d.size_bytes !== null).map((d) => d.size_bytes as number)
  if (sizes.length === 0) return null
  return sizes.reduce((a, b) => a + b, 0) / sizes.length
}

export function computeDeviationPct(today: number, avg: number): number {
  if (avg === 0) return 0
  return ((today - avg) / avg) * 100
}

export interface DqEvaluation {
  status: DqCheckStatus
  message: string
  avg: number | null
  deviationPct: number | null
}

export function evaluateToday(rule: DqRuleSet): DqEvaluation {
  if (rule.source_kind === 'table') {
    if (rule.quality_rules.length === 0) {
      return { status: 'pending', message: 'No quality rules configured yet.', avg: null, deviationPct: null }
    }
    const count = rule.quality_rules.length
    return { status: 'pass', message: `${count} quality rule${count === 1 ? '' : 's'} configured on this table.`, avg: null, deviationPct: null }
  }

  const today = rule.history[rule.history.length - 1]

  if (!today) {
    return { status: 'pending', message: 'Not checked yet — run a check to see the first result.', avg: null, deviationPct: null }
  }

  if (rule.file_presence_enabled && !today.file_exists) {
    return { status: 'fail', message: `File not found at ${rule.file_path}`, avg: null, deviationPct: null }
  }

  if (today.file_exists && today.size_bytes === 0) {
    return {
      status: 'fail',
      message: `Zero-byte file at ${rule.file_path} — the file landed but is empty. Treated as a hard failure independent of the size-deviation threshold, since a statistical comparison to history doesn't apply here.`,
      avg: null,
      deviationPct: null,
    }
  }

  if (!rule.file_size_check_enabled || today.size_bytes === null) {
    return { status: 'pass', message: 'File present.', avg: null, deviationPct: null }
  }

  const avg = computeAverage(rule.history, rule.file_size_config.lookback_days)
  if (avg === null) {
    return { status: 'pass', message: 'File present. Not enough history yet to compare size.', avg: null, deviationPct: null }
  }

  const deviationPct = computeDeviationPct(today.size_bytes, avg)
  const { deviation_threshold_pct, lookback_days } = rule.file_size_config

  if (Math.abs(deviationPct) > deviation_threshold_pct) {
    return {
      status: 'warning',
      message: `Size deviates ${deviationPct > 0 ? '+' : ''}${deviationPct.toFixed(1)}% from the ${lookback_days}-day average — exceeds the ${deviation_threshold_pct}% threshold.`,
      avg,
      deviationPct,
    }
  }

  return {
    status: 'pass',
    message: `Size is within ${deviation_threshold_pct}% of the ${lookback_days}-day average.`,
    avg,
    deviationPct,
  }
}

export interface TableCheckResult {
  status: DqCheckStatus
  message: string
  ruleFailures: RuleFailureDetail[]
}

const RULE_FAILURE_PROBABILITY = 0.35

/**
 * There is no live database connection in this demo, so a table check has
 * nothing real to query — this simulates a plausible outcome per configured
 * rule (some pass, some fail with a small violation count) so the rest of the
 * failure-analysis flow (debug SQL, AI analysis) has something to work with.
 */
export function simulateTableRuleCheck(ruleSet: DqRuleSet, connectionType?: ConnectionType): TableCheckResult {
  if (ruleSet.quality_rules.length === 0) {
    return { status: 'pending', message: 'No quality rules configured yet.', ruleFailures: [] }
  }

  const ruleFailures: RuleFailureDetail[] = []
  for (const rule of ruleSet.quality_rules) {
    if (Math.random() < RULE_FAILURE_PROBABILITY) {
      ruleFailures.push({
        field: rule.field,
        rule: rule.rule,
        violation_count: Math.round(1 + Math.random() * 24),
        debug_sql: buildDebugSelectForRule(ruleSet, rule, connectionType),
      })
    }
  }

  const totalRules = ruleSet.quality_rules.length
  if (ruleFailures.length === 0) {
    return {
      status: 'pass',
      message: `All ${totalRules} quality rule${totalRules === 1 ? '' : 's'} passed on this table.`,
      ruleFailures: [],
    }
  }

  const summary = ruleFailures
    .map((f) => `'${f.field}' ${QUALITY_RULE_LABELS[f.rule].toLowerCase()} (${f.violation_count} row${f.violation_count === 1 ? '' : 's'})`)
    .join('; ')

  return {
    status: 'fail',
    message: `${ruleFailures.length} of ${totalRules} rule${totalRules === 1 ? '' : 's'} failed: ${summary}.`,
    ruleFailures,
  }
}

export interface RowCountReconciliation {
  status: DqCheckStatus
  sourceCount: number
  targetCount: number
  deviationPct: number
  message: string
}

const ROW_COUNT_MISMATCH_THRESHOLD_PCT = 0.5

/**
 * No real database to query in this demo, so this simulates the reconciliation a production
 * pipeline would run: compare source vs target row counts and only pass if they match within a
 * small threshold — unless a configured dedupe step legitimately explains a lower target count.
 * Always resolves to a passing result (no randomized drift injected) so the deploy flow doesn't
 * get blocked by a check that's illustrative rather than backed by real data.
 */
export function simulateRowCountReconciliation(pipeline: PipelineConfig): RowCountReconciliation {
  const sourceCount = Math.round(5_000 + Math.random() * 495_000)
  const dedupeConfigured = pipeline.transformations.some((t) => t.type === 'dedupe')

  const targetCount = dedupeConfigured ? Math.round(sourceCount * (1 - Math.random() * 0.05)) : sourceCount

  const deviationPct = sourceCount === 0 ? 0 : ((targetCount - sourceCount) / sourceCount) * 100
  const withinThreshold = Math.abs(deviationPct) <= ROW_COUNT_MISMATCH_THRESHOLD_PCT
  const dedupeExplainsGap = dedupeConfigured && targetCount <= sourceCount

  if (withinThreshold || dedupeExplainsGap) {
    return {
      status: 'pass',
      sourceCount,
      targetCount,
      deviationPct,
      message: !withinThreshold
        ? `Target has ${Math.abs(deviationPct).toFixed(2)}% fewer rows than source, consistent with the configured dedupe step.`
        : `Source and target row counts match within ${ROW_COUNT_MISMATCH_THRESHOLD_PCT}%.`,
    }
  }

  return {
    status: 'fail',
    sourceCount,
    targetCount,
    deviationPct,
    message: `Target row count deviates ${deviationPct > 0 ? '+' : ''}${deviationPct.toFixed(2)}% from source — exceeds the ${ROW_COUNT_MISMATCH_THRESHOLD_PCT}% threshold. Investigate before deploying.`,
  }
}

export function emptyDqRuleSet(): DqRuleSet {
  return {
    pipeline_id: '',
    pipeline_label: '',
    source_kind: 'file',
    connection_ref: '',
    table_schema: '',
    table_name: '',
    file_path: '',
    file_presence_enabled: false,
    file_size_check_enabled: false,
    file_size_config: { lookback_days: 7, deviation_threshold_pct: 20 },
    quality_rules_enabled: false,
    quality_rules: [],
    custom_sql_checks: [],
    schema_drift_check_enabled: false,
    schema_drift_config: { compare_types: true },
    schema_baseline: [],
    dedup_check_enabled: false,
    dedup_config: { key_columns: [], duplicate_tolerance_pct: 0 },
    freshness_check_enabled: false,
    freshness_config: { timestamp_column: '', max_age_hours: 24 },
    schedule: { type: 'cron', expression: '0 6 * * *', timezone: 'Asia/Kolkata' },
    history: [],
  }
}

/**
 * Onboarding a file has no real backend to inspect yet, so the first check
 * simulates what that inspection would find: the file almost always exists,
 * with a plausible-but-arbitrary size, since there is no real average to
 * anchor to on day one.
 */
export function simulateFirstCheck(): DqFileSample {
  const exists = Math.random() > 0.05
  const sizeBytes = exists ? Math.round(50_000_000 + Math.random() * 500_000_000) : null
  const today = new Date().toISOString().slice(0, 10)
  return { date: today, file_exists: exists, size_bytes: sizeBytes }
}

const STATUS_RANK: Record<DqCheckStatus, number> = { pending: 0, pass: 1, warning: 2, fail: 3 }

/** Combines two check results into one execution's overall status — the worse of the two wins. */
export function worseStatus(a: DqCheckStatus, b: DqCheckStatus): DqCheckStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a
}

export interface SchemaDriftCheckResult {
  status: DqCheckStatus
  message: string
  details: SchemaDriftDetail[]
}

function describeDrift(m: { column: string; change_type: SchemaDriftDetail['change_type']; previous_type?: string; new_type?: string }): string {
  if (m.change_type === 'column_added') return `column '${m.column}' added (${m.new_type})`
  if (m.change_type === 'column_removed') return `column '${m.column}' removed (was ${m.previous_type})`
  return `column '${m.column}' type changed from ${m.previous_type} to ${m.new_type}`
}

/**
 * No live database/storage API to introspect in this demo, so this mutates the
 * captured baseline into a plausible "today" schema (see mutateColumnsForDemo)
 * and classifies severity the same way the file checks do: additive changes are
 * review-worthy but not fatal, while removed/retyped columns break downstream
 * mapping and are treated as a hard failure.
 */
export function simulateSchemaDriftCheck(ruleSet: DqRuleSet, connectionType?: ConnectionType): SchemaDriftCheckResult {
  if (ruleSet.schema_baseline.length === 0) {
    return { status: 'pending', message: 'No schema baseline captured yet.', details: [] }
  }

  const { mutations } = mutateColumnsForDemo(ruleSet.schema_baseline, { includeTypeChanges: ruleSet.schema_drift_config.compare_types })
  if (mutations.length === 0) {
    return { status: 'pass', message: 'No schema drift detected against the captured baseline.', details: [] }
  }

  const introspection_sql = buildSchemaIntrospectionSql(ruleSet, connectionType)
  const details: SchemaDriftDetail[] = mutations.map((m) => ({ ...m, introspection_sql }))
  const hasBreakingChange = details.some((d) => d.change_type !== 'column_added')
  const summary = mutations.map(describeDrift).join('; ')

  return {
    status: hasBreakingChange ? 'fail' : 'warning',
    message: `Schema drift detected: ${summary}.`,
    details,
  }
}

export interface DedupCheckResult {
  status: DqCheckStatus
  message: string
  details: DedupDetail[]
}

/**
 * No real target table to query in this demo, so this simulates the recurring
 * duplicate-key monitor: most runs find nothing, occasionally a batch of
 * duplicate golden-record keys shows up (as if an upstream job re-ran without
 * deduping, or the key stopped being unique after a source change).
 */
export function simulateDedupCheck(ruleSet: DqRuleSet, connectionType?: ConnectionType): DedupCheckResult {
  const keys = ruleSet.dedup_config.key_columns
  if (keys.length === 0) {
    return { status: 'pending', message: 'No key columns configured for the dedup check yet.', details: [] }
  }

  if (Math.random() > 0.3) {
    return { status: 'pass', message: `No duplicate golden-record keys found on (${keys.join(', ')}).`, details: [] }
  }

  const totalRows = Math.round(5_000 + Math.random() * 495_000)
  const duplicateGroups = Math.round(1 + Math.random() * 20)
  const duplicateRows = duplicateGroups + Math.round(Math.random() * duplicateGroups * 2)
  const duplicatePct = (duplicateRows / totalRows) * 100
  const exceedsTolerance = duplicatePct > ruleSet.dedup_config.duplicate_tolerance_pct
  const base = `Found ${duplicateGroups} duplicate group${duplicateGroups === 1 ? '' : 's'} (${duplicateRows} rows, ${duplicatePct.toFixed(2)}% of target) on key [${keys.join(', ')}]`

  if (!exceedsTolerance) {
    return {
      status: 'pass',
      message: `${base} — within the ${ruleSet.dedup_config.duplicate_tolerance_pct}% tolerance configured.`,
      details: [],
    }
  }

  return {
    status: 'fail',
    message: `${base} — exceeds the ${ruleSet.dedup_config.duplicate_tolerance_pct}% tolerance configured. Usually means an upstream job re-ran without deduping, or the golden-record key stopped being unique after a source change.`,
    details: [{ key_values: keys, duplicate_row_count: duplicateRows, debug_sql: buildDedupDebugSql(ruleSet, ruleSet.dedup_config, connectionType) }],
  }
}

export interface FreshnessCheckResult {
  status: DqCheckStatus
  message: string
  details?: FreshnessDetail
}

/**
 * No live source to query in this demo, so this simulates a staleness monitor: most runs find
 * data landed recently, occasionally the most recent row is older than the configured threshold
 * (as if an upstream job silently stopped running instead of erroring outright, which a
 * presence/size check alone wouldn't catch if the file or table itself is still there).
 */
export function simulateFreshnessCheck(ruleSet: DqRuleSet, connectionType?: ConnectionType): FreshnessCheckResult {
  const { timestamp_column, max_age_hours } = ruleSet.freshness_config
  if (!timestamp_column) {
    return { status: 'pending', message: 'No timestamp column configured for the freshness check yet.' }
  }

  const isStale = Math.random() < 0.25
  const ageHours = isStale
    ? Math.round(max_age_hours * (1.1 + Math.random()))
    : Math.round(Math.random() * max_age_hours * 0.6)
  if (!isStale) {
    return {
      status: 'pass',
      message: `Most recent row is ${ageHours}h old on '${timestamp_column}' — within the ${max_age_hours}h threshold.`,
    }
  }

  const lastSeenAt = new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString()
  const debug_sql = buildFreshnessDebugSql(ruleSet, ruleSet.freshness_config, connectionType)
  const details: FreshnessDetail = { timestamp_column, last_seen_at: lastSeenAt, age_hours: ageHours, max_age_hours, debug_sql }

  return {
    status: 'fail',
    message: `Most recent row is ${ageHours}h old on '${timestamp_column}' — exceeds the ${max_age_hours}h threshold. Usually means the upstream job silently stopped running rather than erroring outright.`,
    details,
  }
}
