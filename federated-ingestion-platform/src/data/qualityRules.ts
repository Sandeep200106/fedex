import type { QualityRule, QualityRuleType } from '../types'
import { normalizeType } from './schemaIntrospection'

export const QUALITY_RULE_TYPES: QualityRuleType[] = ['not_null', 'range', 'length', 'regex', 'allowed_values', 'unique']

export const QUALITY_RULE_LABELS: Record<QualityRuleType, string> = {
  not_null: 'Null check',
  range: 'Range',
  length: 'Length check',
  regex: 'Regex pattern',
  allowed_values: 'Allowed values',
  unique: 'Unique',
}

export function emptyQualityRule(field = ''): QualityRule {
  return { field, rule: 'not_null' }
}

const RULES_BY_COLUMN_CATEGORY: Record<string, QualityRuleType[]> = {
  text: ['not_null', 'unique', 'length', 'regex', 'allowed_values'],
  number: ['not_null', 'unique', 'range'],
  boolean: ['not_null', 'allowed_values'],
  date: ['not_null', 'unique', 'range'],
  datetime: ['not_null', 'unique', 'range'],
}

export function applicableRuleTypes(columnType: string): QualityRuleType[] {
  return RULES_BY_COLUMN_CATEGORY[normalizeType(columnType)] ?? QUALITY_RULE_TYPES
}

// Source/file-level DQ mechanisms that aren't per-column rule types (file presence, file
// size, schema drift, dedup) — named here so the Home dashboard's check count is derived,
// not a hardcoded number that drifts out of sync as mechanisms are added.
export const NON_COLUMN_DQ_MECHANISMS = ['File presence', 'File size', 'Schema drift', 'Dedup / golden-record'] as const

export const DQ_CHECK_MECHANISM_COUNT = QUALITY_RULE_TYPES.length + NON_COLUMN_DQ_MECHANISMS.length

export function explainRule(rule: QualityRule): string {
  const field = rule.field || '(unnamed field)'
  switch (rule.rule) {
    case 'not_null':
      return `'${field}' must not contain null or missing values`
    case 'range':
      return `'${field}' must be between ${rule.min ?? '—'} and ${rule.max ?? '—'}`
    case 'length':
      return `'${field}' length must be between ${rule.min ?? '—'} and ${rule.max ?? '—'} characters`
    case 'regex':
      return `'${field}' must match the pattern ${rule.pattern || '—'}`
    case 'allowed_values':
      return `'${field}' must be one of: ${(rule.values ?? []).join(', ') || '—'}`
    case 'unique':
      return `'${field}' must be unique across all records`
    default:
      return ''
  }
}
