import type { ConnectionType, DedupConfig, DqRuleSet, QualityRule } from '../types'

// This UI has no live database connection — the generated statements below are
// what would actually run against the warehouse to evaluate the configured
// rules, shown here as a preview so the DQ config is verifiable before wiring
// up a real execution engine.

function tableRef(ruleSet: DqRuleSet, connectionType?: ConnectionType): string {
  const object = [ruleSet.table_schema, ruleSet.table_name].filter(Boolean).join('.')
  return connectionType === 'bigquery' ? `\`${object}\`` : object
}

function regexNotMatchExpr(field: string, pattern: string, connectionType?: ConnectionType): string {
  const escaped = pattern.replace(/'/g, "\\'")
  if (connectionType === 'bigquery') return `NOT REGEXP_CONTAINS(${field}, r'${escaped}')`
  return `${field} !~ '${escaped}'`
}

// The boolean condition that identifies a VIOLATING row for a given rule —
// shared between the aggregate count query (wrapped in SUM(CASE WHEN ...))
// and the debug query (used directly in a WHERE clause).
function violationCondition(rule: QualityRule, connectionType?: ConnectionType): string | null {
  switch (rule.rule) {
    case 'not_null':
      return `${rule.field} IS NULL`
    case 'range':
      return `${rule.field} < ${rule.min ?? 'NULL'} OR ${rule.field} > ${rule.max ?? 'NULL'}`
    case 'length':
      return `LENGTH(${rule.field}) < ${rule.min ?? 'NULL'} OR LENGTH(${rule.field}) > ${rule.max ?? 'NULL'}`
    case 'regex':
      return rule.pattern ? regexNotMatchExpr(rule.field, rule.pattern, connectionType) : null
    case 'allowed_values': {
      const values = (rule.values ?? []).map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
      return `${rule.field} NOT IN (${values || 'NULL'})`
    }
    default:
      return null
  }
}

function aggregateExpr(rule: QualityRule, connectionType?: ConnectionType): { expr: string; alias: string } | null {
  const condition = violationCondition(rule, connectionType)
  if (!condition) return null
  const suffix =
    rule.rule === 'not_null'
      ? 'null_count'
      : rule.rule === 'range'
        ? 'out_of_range_count'
        : rule.rule === 'length'
          ? 'out_of_length_count'
          : rule.rule === 'regex'
            ? 'pattern_mismatch_count'
            : 'disallowed_value_count'
  return { expr: `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`, alias: `${rule.field}_${suffix}` }
}

export function buildDqSelectSql(ruleSet: DqRuleSet, connectionType?: ConnectionType): string {
  if (ruleSet.source_kind !== 'table' || ruleSet.quality_rules.length === 0) return ''

  const table = tableRef(ruleSet, connectionType)
  const aggRules = ruleSet.quality_rules.filter((r) => r.rule !== 'unique')
  const uniqueRules = ruleSet.quality_rules.filter((r) => r.rule === 'unique')
  const statements: string[] = []

  if (aggRules.length > 0) {
    const columns = aggRules
      .map((r) => aggregateExpr(r, connectionType))
      .filter((x): x is { expr: string; alias: string } => x !== null)
      .map(({ expr, alias }) => `  ${expr} AS ${alias}`)
      .join(',\n')

    statements.push(
      [
        '-- Null / range / pattern / allowed-value checks in a single pass',
        'SELECT',
        '  COUNT(*) AS total_rows,',
        columns,
        `FROM ${table};`,
      ].join('\n'),
    )
  }

  uniqueRules.forEach((r) => {
    statements.push(
      [
        `-- Uniqueness check for '${r.field}'`,
        `SELECT ${r.field}, COUNT(*) AS duplicate_count`,
        `FROM ${table}`,
        `GROUP BY ${r.field}`,
        'HAVING COUNT(*) > 1;',
      ].join('\n'),
    )
  })

  return statements.join('\n\n')
}

export function buildCustomChecksSql(ruleSet: DqRuleSet): string {
  if (ruleSet.custom_sql_checks.length === 0) return ''
  return ruleSet.custom_sql_checks.map((c) => `-- Custom check: ${c.label || '(untitled)'}\n${c.sql}`).join('\n\n')
}

/** Full query preview shown to the user: auto-generated rule checks plus any custom checks they've added. */
export function buildFullDqSqlPreview(ruleSet: DqRuleSet, connectionType?: ConnectionType): string {
  return [buildDqSelectSql(ruleSet, connectionType), buildCustomChecksSql(ruleSet)].filter(Boolean).join('\n\n')
}

/**
 * A debug query for a single rule that failed — pulls back the actual
 * offending records (rather than just a count) so a user can see exactly
 * which rows tripped the check.
 */
export function buildDebugSelectForRule(ruleSet: DqRuleSet, rule: QualityRule, connectionType?: ConnectionType): string {
  const table = tableRef(ruleSet, connectionType)

  if (rule.rule === 'unique') {
    return [
      `-- Records with a duplicate '${rule.field}'`,
      `SELECT t.*`,
      `FROM ${table} t`,
      `JOIN (`,
      `  SELECT ${rule.field}`,
      `  FROM ${table}`,
      `  GROUP BY ${rule.field}`,
      '  HAVING COUNT(*) > 1',
      `) dup ON dup.${rule.field} = t.${rule.field}`,
      'LIMIT 100;',
    ].join('\n')
  }

  const condition = violationCondition(rule, connectionType)
  return [`-- Records failing the ${rule.rule} check on '${rule.field}'`, `SELECT *`, `FROM ${table}`, `WHERE ${condition ?? 'FALSE'}`, 'LIMIT 100;'].join(
    '\n',
  )
}

/**
 * Illustrative "what production would query instead of this mock diff" —
 * the demo simulates schema drift client-side (see mutateColumnsForDemo),
 * since there's no live database/storage API to introspect for real.
 */
export function buildSchemaIntrospectionSql(ruleSet: DqRuleSet, connectionType?: ConnectionType): string {
  if (ruleSet.source_kind === 'table') {
    if (connectionType === 'bigquery') {
      return [
        '-- What a real implementation would query instead of this mock diff',
        'SELECT column_name, data_type',
        `FROM \`${ruleSet.table_schema}\`.INFORMATION_SCHEMA.COLUMNS`,
        `WHERE table_name = '${ruleSet.table_name}'`,
        'ORDER BY ordinal_position;',
      ].join('\n')
    }
    return [
      '-- What a real implementation would query instead of this mock diff',
      'SELECT column_name, data_type',
      'FROM information_schema.columns',
      `WHERE table_schema = '${ruleSet.table_schema}' AND table_name = '${ruleSet.table_name}'`,
      'ORDER BY ordinal_position;',
    ].join('\n')
  }

  return [
    '-- What a real implementation would inspect instead of this mock diff:',
    '-- read the Parquet/Avro/CSV footer schema directly from the object',
    '-- (via the GCS/S3 storage API, or an external table definition), e.g.',
    `--   ${ruleSet.file_path}`,
  ].join('\n')
}

/** Debug query for duplicate golden-record keys — generalizes the existing 'unique' rule debug query to a composite key and to file sources. */
export function buildDedupDebugSql(ruleSet: DqRuleSet, dedupConfig: DedupConfig, connectionType?: ConnectionType): string {
  const keys = dedupConfig.key_columns
  if (keys.length === 0) return ''
  const keyList = keys.join(', ')

  if (ruleSet.source_kind === 'table') {
    const table = tableRef(ruleSet, connectionType)
    return [
      `-- Duplicate golden-record keys on (${keyList})`,
      `SELECT ${keyList}, COUNT(*) AS duplicate_count`,
      `FROM ${table}`,
      `GROUP BY ${keyList}`,
      'HAVING COUNT(*) > 1',
      'LIMIT 100;',
    ].join('\n')
  }

  return [
    `-- Duplicate golden-record keys on (${keyList}) within today's landed file`,
    `--   ${ruleSet.file_path}`,
    `SELECT ${keyList}, COUNT(*) AS duplicate_count`,
    'FROM today_landed_file',
    `GROUP BY ${keyList}`,
    'HAVING COUNT(*) > 1',
    'LIMIT 100;',
  ].join('\n')
}
