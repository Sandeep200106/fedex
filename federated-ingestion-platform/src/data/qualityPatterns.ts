import type { DqExecution, DqRuleSet } from '../types'
import { QUALITY_RULE_LABELS, QUALITY_RULE_TYPES } from './qualityRules'

export type QualityPatternCategory = 'missing_file' | 'zero_byte' | 'size_deviation' | 'rule_violation' | 'schema_drift' | 'dedup' | 'other'

export interface QualityPattern {
  key: string
  label: string
  category: QualityPatternCategory
  occurrences: number
  pipelineIds: string[]
  lastSeenAt: string
  exampleMessage: string
}

interface Classification {
  key: string
  label: string
  category: QualityPatternCategory
}

/**
 * Turns one execution's failure/warning into one or more pattern
 * classifications. A table check with several failing rules produces one
 * classification per rule, so e.g. a 'unique' violation on two different
 * tables still rolls up into a single "Unique violation" pattern.
 *
 * Classifications accumulate across every structured detail an execution
 * carries (rule failures, schema drift, dedup) rather than stopping at the
 * first match — a single execution can legitimately fail more than one check
 * at once, and early-returning after just rule_failures would silently hide
 * schema-drift/dedup patterns whenever a rule failure also happened to be
 * present on the same run.
 */
function classify(exec: DqExecution): Classification[] {
  if (exec.status === 'pass' || exec.status === 'pending') return []

  const classifications: Classification[] = []

  if (exec.rule_failures && exec.rule_failures.length > 0) {
    classifications.push(
      ...exec.rule_failures.map((f) => ({
        key: `rule:${f.rule}`,
        label: `${QUALITY_RULE_LABELS[f.rule]} violation`,
        category: 'rule_violation' as const,
      })),
    )
  }

  if (exec.schema_drift_details && exec.schema_drift_details.length > 0) {
    classifications.push({ key: 'schema_drift', label: 'Schema drift', category: 'schema_drift' })
  }

  if (exec.dedup_details && exec.dedup_details.length > 0) {
    classifications.push({ key: 'dedup', label: 'Duplicate golden-record keys', category: 'dedup' })
  }

  if (classifications.length > 0) return classifications

  if (/file not found/i.test(exec.message)) {
    return [{ key: 'missing_file', label: 'Missing file at scheduled time', category: 'missing_file' }]
  }
  if (/zero-byte/i.test(exec.message)) {
    return [{ key: 'zero_byte', label: 'Zero-byte file landed', category: 'zero_byte' }]
  }
  if (/size deviates/i.test(exec.message)) {
    return [{ key: 'size_deviation', label: 'File size deviation', category: 'size_deviation' }]
  }
  return [{ key: 'other', label: 'Uncategorized failure', category: 'other' }]
}

/**
 * Groups every non-passing execution across ALL monitored pipelines by
 * failure type. This is the "pattern view": the same error type recurring
 * across several pipelines/tables surfaces as one row with a pipeline count,
 * instead of N separate per-table alerts that hide the shared root cause.
 */
export function buildQualityPatterns(executions: DqExecution[]): QualityPattern[] {
  const byKey = new Map<string, QualityPattern>()

  for (const exec of executions) {
    for (const c of classify(exec)) {
      const existing = byKey.get(c.key)
      if (existing) {
        existing.occurrences += 1
        if (!existing.pipelineIds.includes(exec.pipeline_id)) existing.pipelineIds.push(exec.pipeline_id)
        if (exec.executed_at > existing.lastSeenAt) {
          existing.lastSeenAt = exec.executed_at
          existing.exampleMessage = exec.message
        }
      } else {
        byKey.set(c.key, {
          key: c.key,
          label: c.label,
          category: c.category,
          occurrences: 1,
          pipelineIds: [exec.pipeline_id],
          lastSeenAt: exec.executed_at,
          exampleMessage: exec.message,
        })
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (b.pipelineIds.length !== a.pipelineIds.length) return b.pipelineIds.length - a.pipelineIds.length
    return b.occurrences - a.occurrences
  })
}

export function pipelineLabelsFor(pattern: QualityPattern, ruleSets: DqRuleSet[]): string[] {
  return pattern.pipelineIds.map((id) => ruleSets.find((r) => r.pipeline_id === id)?.pipeline_label ?? id)
}

export interface PatternPipelineDetail {
  pipelineId: string
  occurrences: number
  lastSeenAt: string
  exampleMessage: string
}

/**
 * Per-pipeline breakdown of a single check type: how many times it fired on each
 * affected pipeline, plus that pipeline's own last-seen time and example message
 * (as opposed to QualityPattern's single most-recent-overall example).
 */
export function pipelineBreakdownFor(pattern: QualityPattern, executions: DqExecution[]): PatternPipelineDetail[] {
  const byPipeline = new Map<string, PatternPipelineDetail>()

  for (const exec of executions) {
    if (!classify(exec).some((c) => c.key === pattern.key)) continue
    const existing = byPipeline.get(exec.pipeline_id)
    if (existing) {
      existing.occurrences += 1
      if (exec.executed_at > existing.lastSeenAt) {
        existing.lastSeenAt = exec.executed_at
        existing.exampleMessage = exec.message
      }
    } else {
      byPipeline.set(exec.pipeline_id, {
        pipelineId: exec.pipeline_id,
        occurrences: 1,
        lastSeenAt: exec.executed_at,
        exampleMessage: exec.message,
      })
    }
  }

  return Array.from(byPipeline.values()).sort((a, b) => (b.lastSeenAt > a.lastSeenAt ? 1 : -1))
}

// The full catalog of DQ check types this framework knows how to detect — one entry per
// `classify()` key above, kept in sync with it by construction rather than a second
// hand-maintained list. Used so "all DQ check types" can be shown even when a type has
// never actually failed (occurrences: 0), not just the ones live executions have hit.
const CANONICAL_CHECK_TYPES: Classification[] = [
  ...QUALITY_RULE_TYPES.map((rule) => ({
    key: `rule:${rule}`,
    label: `${QUALITY_RULE_LABELS[rule]} violation`,
    category: 'rule_violation' as const,
  })),
  { key: 'missing_file', label: 'Missing file at scheduled time', category: 'missing_file' },
  { key: 'zero_byte', label: 'Zero-byte file landed', category: 'zero_byte' },
  { key: 'size_deviation', label: 'File size deviation', category: 'size_deviation' },
  { key: 'schema_drift', label: 'Schema drift', category: 'schema_drift' },
  { key: 'dedup', label: 'Duplicate golden-record keys', category: 'dedup' },
]

/**
 * Every DQ check type this framework can detect, not just the ones that have actually
 * failed. Types with live occurrences keep their real counts/pipelines/last-seen/example
 * (same rows buildQualityPatterns returns, same order); types that have never fired are
 * appended after, with occurrences: 0 and no pipelines/example, so the box reads as a
 * complete reference of what's monitored rather than only what's currently on fire.
 */
export function buildAllQualityPatterns(executions: DqExecution[]): QualityPattern[] {
  const live = buildQualityPatterns(executions)
  const liveByKey = new Map(live.map((p) => [p.key, p]))

  const neverOccurred = CANONICAL_CHECK_TYPES.filter((c) => !liveByKey.has(c.key)).map(
    (c): QualityPattern => ({
      key: c.key,
      label: c.label,
      category: c.category,
      occurrences: 0,
      pipelineIds: [],
      lastSeenAt: '',
      exampleMessage: '',
    }),
  )

  return [...live, ...neverOccurred]
}
