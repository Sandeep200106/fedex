import type { RagChunk } from './vectorStore'
import type { ColumnInfo, DedupDetail, QualityRuleType, RuleFailureDetail, SchemaDriftChangeType, SchemaDriftDetail } from '../types'
import { QUALITY_RULE_LABELS } from '../data/qualityRules'

export interface LlmSettings {
  endpoint: string
  apiKey: string
  model: string
}

/**
 * The LLM is pre-configured for this app — there is no settings UI. Values
 * come from .env.local (VITE_LLM_*), which is gitignored (see *.local in
 * .gitignore). Note this still ships the key inside the browser bundle at
 * build time, which is fine for local/internal use but is not a safe
 * pattern once this app is deployed anywhere less trusted — at that point
 * this call needs to move behind a real backend so the key is never sent
 * to the browser at all.
 */
export function getLlmSettings(): LlmSettings {
  return {
    endpoint: import.meta.env.VITE_LLM_BASE_URL ?? '',
    apiKey: import.meta.env.VITE_LLM_API_KEY ?? '',
    model: import.meta.env.VITE_LLM_MODEL ?? '',
  }
}

export function isLlmConfigured(settings: LlmSettings): boolean {
  return Boolean(settings.endpoint.trim() && settings.apiKey.trim())
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Calls an OpenAI-chat-completions-shaped endpoint directly from the browser.
 * This is fine for local testing but is not a safe production pattern — the
 * API key is visible to anyone inspecting network requests from this page.
 * Once a real backend exists, this call should move server-side.
 */
export async function callLlm(settings: LlmSettings, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(settings.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({ model: settings.model, messages, temperature: 0.2 }),
  })

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('Unexpected response shape from LLM endpoint')
  }
  return content
}

export function buildRagPrompt(question: string, chunks: RagChunk[], userLocation?: string): ChatMessage[] {
  const context = chunks.map((c) => `### ${c.title}\n${c.text}`).join('\n\n')
  const locationLine = userLocation ? `The user is currently on: ${userLocation}.\n\n` : ''
  return [
    {
      role: 'system',
      content:
        'You are an assistant embedded in a data pipeline builder UI, helping users who may be stuck or confused about how the platform works, including recent pipeline/data-quality failures. Answer the user\'s question using ONLY the provided context. If the context includes a recent failed run or data quality failure relevant to the question, use it to give a specific, actionable answer instead of a generic one. If the context does not cover it, say so plainly instead of guessing. Keep answers concise and practical.',
    },
    {
      role: 'user',
      content: `${locationLine}Context:\n${context}\n\nQuestion: ${question}`,
    },
  ]
}

export function mockAnswerFromChunks(chunks: RagChunk[]): string {
  if (chunks.length === 0) {
    return "I couldn't find anything relevant in the docs for that — try rephrasing your question."
  }
  const body = chunks.map((c) => `**${c.title}**\n${c.text}`).join('\n\n')
  return `The assistant's LLM call didn't go through, so here's the most relevant documentation I found instead:\n\n${body}`
}

export interface LogAnalysis {
  issue: string
  resolution: string
}

const LOG_PATTERNS: { match: RegExp; issue: string; resolution: string }[] = [
  {
    match: /429|too many requests|rate.?limit/i,
    issue: 'The source system rejected requests because too many were sent too quickly (rate limiting).',
    resolution: 'Reduce how often this pipeline polls the source, or add a delay/backoff between requests. If the source offers a higher rate-limit tier, consider requesting one.',
  },
  {
    match: /connection was closed|connection reset|could not connect|timed out|timeout/i,
    issue: 'The pipeline lost its network connection to the source or target partway through the run.',
    resolution: 'Check that the source/target is reachable and not undergoing maintenance. If this happens intermittently, it may be a transient network blip — retrying the run often resolves it. If it happens consistently, check firewall rules and connection credentials.',
  },
  {
    match: /rebalance|consumer group/i,
    issue: 'The Kafka consumer group was reassigning partitions (a "rebalance") while the pipeline was trying to read, so the read timed out.',
    resolution: 'This is usually transient — the pipeline is already configured to retry automatically. If it keeps happening, another consumer may be joining/leaving the group repeatedly; check for other services sharing the same consumer group.',
  },
  {
    match: /permission denied|forbidden|403|unauthorized|401/i,
    issue: 'The pipeline\'s credentials do not have permission to access the source or target.',
    resolution: 'Double check the secret reference and auth method on the connection, and confirm the underlying credential has not expired or been revoked.',
  },
  {
    match: /not found|404|no such file|does not exist/i,
    issue: 'The pipeline looked for a specific file, table, or resource that was not there.',
    resolution: 'Confirm the upstream job that produces this data actually ran and finished successfully before this pipeline\'s schedule, and that the path/table name is still correct.',
  },
]

export function mockLogAnalysis(logExcerpt: string): LogAnalysis {
  for (const pattern of LOG_PATTERNS) {
    if (pattern.match.test(logExcerpt)) {
      return { issue: pattern.issue, resolution: pattern.resolution }
    }
  }
  return {
    issue: "This log doesn't match a known failure pattern in the built-in analyzer.",
    resolution: 'Share the log excerpt with your data engineering team for a detailed diagnosis.',
  }
}

export function buildLogAnalysisPrompt(pipelineId: string, logExcerpt: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a data pipeline assistant helping a non-technical user understand why a pipeline run failed. Given a log excerpt, respond with exactly two short sections: "Issue:" (what exactly went wrong, in plain language, no jargon) and "Resolution:" (concrete numbered steps to fix it). Do not include anything else.',
    },
    {
      role: 'user',
      content: `Pipeline: ${pipelineId}\n\nLog excerpt:\n${logExcerpt}`,
    },
  ]
}

const RULE_FAILURE_GUIDANCE: Record<QualityRuleType, { issue: string; resolution: string }> = {
  not_null: {
    issue: 'has rows where a required field is missing',
    resolution:
      'Check the upstream source or ETL step feeding this column — a recent schema change, or an optional field being treated as required upstream, is the most common cause. Once backfilled, consider enforcing NOT NULL at the source.',
  },
  range: {
    issue: 'has values outside the expected numeric range',
    resolution:
      'Look for outliers from a unit-conversion bug, a currency/precision mismatch, or test data leaking into production. Confirm the configured min/max still reflect real-world bounds.',
  },
  length: {
    issue: 'has string values outside the expected length range',
    resolution:
      'Check for truncated or concatenated upstream values, a field being repurposed for something longer/shorter than originally designed, or a unit mismatch (e.g. an ID format changing). Confirm the configured min/max length still reflect real-world values.',
  },
  regex: {
    issue: "has values that don't match the expected format",
    resolution:
      'Inspect a sample of the offending rows with the debug query below — this usually points to a source system allowing free-text entry where a structured format (e.g. email) is expected.',
  },
  allowed_values: {
    issue: 'has values outside the configured allow-list',
    resolution:
      'A new category or status value was likely introduced upstream. Decide whether to add it to the allow-list or treat it as a genuine data error, then update the rule.',
  },
  unique: {
    issue: 'has duplicate values for a field that should be unique',
    resolution:
      'This usually means an upstream job re-ran without deduping, or the natural key stopped being unique after a source system change. Check the load job for double-writes before deduping the table.',
  },
}

/** Falls back to a rule-type-pattern-matched explanation when no LLM is configured. */
export function mockDqFailureAnalysis(pipelineLabel: string, ruleFailures: RuleFailureDetail[]): LogAnalysis {
  if (ruleFailures.length === 0) {
    return { issue: 'No rule failures to analyze.', resolution: 'Nothing to do — all configured rules passed.' }
  }
  const issue = ruleFailures
    .map(
      (f) =>
        `'${pipelineLabel}' ${RULE_FAILURE_GUIDANCE[f.rule].issue} in '${f.field}' (${f.violation_count} row${f.violation_count === 1 ? '' : 's'}, ${QUALITY_RULE_LABELS[f.rule].toLowerCase()}).`,
    )
    .join(' ')
  const resolution = Array.from(new Set(ruleFailures.map((f) => RULE_FAILURE_GUIDANCE[f.rule].resolution))).join(' ')
  return { issue, resolution }
}

export function buildDqFailureAnalysisPrompt(pipelineLabel: string, ruleFailures: RuleFailureDetail[]): ChatMessage[] {
  const details = ruleFailures
    .map((f) => `- Column '${f.field}', rule '${f.rule}', ${f.violation_count} violating row(s). Debug query:\n${f.debug_sql}`)
    .join('\n\n')
  return [
    {
      role: 'system',
      content:
        'You are a data quality assistant helping a data engineer understand why a table\'s quality checks failed. Given the failing rules, violation counts, and the debug query used to pull the offending records, respond with exactly two short sections: "Issue:" (what is wrong with the data, in plain language) and "Resolution:" (concrete, numbered next steps to investigate or fix it). Do not include anything else.',
    },
    {
      role: 'user',
      content: `Pipeline: ${pipelineLabel}\n\nFailing rules:\n${details}`,
    },
  ]
}

const SCHEMA_DRIFT_GUIDANCE: Record<SchemaDriftChangeType, { issue: string; resolution: string }> = {
  column_added: {
    issue: 'a new column showed up that was not present in the captured baseline schema',
    resolution:
      'Usually additive and backward-compatible, but confirm the source team intended the change and decide whether downstream mapping/rules should start using the new column.',
  },
  column_removed: {
    issue: 'a column present in the baseline schema is now missing',
    resolution:
      'This breaks any column mapping or quality rule that referenced it. Check with the source team before this reaches downstream consumers, and update the pipeline mapping to match.',
  },
  type_changed: {
    issue: "a column's data type changed from what the baseline schema recorded",
    resolution:
      'A type change can silently corrupt downstream calculations or fail casts. Confirm the new type with the source team and update the column mapping/target schema before trusting new data.',
  },
}

/** Falls back to a change-type-pattern-matched explanation when no LLM is configured. */
export function mockSchemaDriftAnalysis(pipelineLabel: string, details: SchemaDriftDetail[]): LogAnalysis {
  if (details.length === 0) {
    return { issue: 'No schema drift to analyze.', resolution: 'Nothing to do — the schema matches the captured baseline.' }
  }
  const issue = details
    .map((d) => `'${pipelineLabel}' has ${SCHEMA_DRIFT_GUIDANCE[d.change_type].issue} ('${d.column}').`)
    .join(' ')
  const resolution = Array.from(new Set(details.map((d) => SCHEMA_DRIFT_GUIDANCE[d.change_type].resolution))).join(' ')
  return { issue, resolution }
}

export function buildSchemaDriftAnalysisPrompt(pipelineLabel: string, details: SchemaDriftDetail[]): ChatMessage[] {
  const summary = details
    .map((d) => `- Column '${d.column}', change '${d.change_type}'${d.previous_type ? `, was '${d.previous_type}'` : ''}${d.new_type ? `, now '${d.new_type}'` : ''}. What production would query instead of this mock diff:\n${d.introspection_sql}`)
    .join('\n\n')
  return [
    {
      role: 'system',
      content:
        'You are a data quality assistant helping a data engineer understand a schema drift finding on a pipeline\'s source. Given the columns that changed and how, respond with exactly two short sections: "Issue:" (what changed in the schema, in plain language) and "Resolution:" (concrete, numbered next steps to confirm and fix it). Do not include anything else.',
    },
    {
      role: 'user',
      content: `Pipeline: ${pipelineLabel}\n\nSchema changes:\n${summary}`,
    },
  ]
}

/** Falls back to a fixed explanation when no LLM is configured — dedup findings don't vary in kind the way rule/drift failures do. */
export function mockDedupAnalysis(pipelineLabel: string, details: DedupDetail[]): LogAnalysis {
  if (details.length === 0) {
    return { issue: 'No duplicate golden-record keys to analyze.', resolution: 'Nothing to do — no duplicates found on this run.' }
  }
  const total = details.reduce((sum, d) => sum + d.duplicate_row_count, 0)
  return {
    issue: `'${pipelineLabel}' has ${total} row(s) sharing a golden-record key on (${details[0].key_values.join(', ')}) that should be unique.`,
    resolution:
      'Usually means an upstream job re-ran without deduping, or the key stopped being unique after a source change. Check the load job for double-writes before deduping the target, and confirm the key columns still uniquely identify a record.',
  }
}

export function buildDedupAnalysisPrompt(pipelineLabel: string, details: DedupDetail[]): ChatMessage[] {
  const summary = details
    .map((d) => `- Key (${d.key_values.join(', ')}), ${d.duplicate_row_count} duplicate row(s). Debug query:\n${d.debug_sql}`)
    .join('\n\n')
  return [
    {
      role: 'system',
      content:
        'You are a data quality assistant helping a data engineer understand why a golden-record dedup check found duplicates. Given the key columns, duplicate row count, and the debug query used to pull the offending records, respond with exactly two short sections: "Issue:" (what is wrong with the data, in plain language) and "Resolution:" (concrete, numbered next steps to investigate or fix it). Do not include anything else.',
    },
    {
      role: 'user',
      content: `Pipeline: ${pipelineLabel}\n\nDuplicate findings:\n${summary}`,
    },
  ]
}

const FILE_CHECK_PATTERNS: { match: RegExp; issue: string; resolution: string }[] = [
  {
    match: /file not found|does not exist|no such file/i,
    issue: 'The expected file for this run was not found at the scheduled path.',
    resolution:
      '1. Confirm the upstream job that produces this file actually ran and finished before this check\'s schedule.\n2. Check the exact path/partition (e.g. the resolved date) for a typo or an off-by-one-day mismatch.\n3. If the upstream job is simply running late, consider shifting this check\'s schedule later or adding a short retry/backoff before failing.',
  },
  {
    match: /zero-byte|empty file|size_bytes.*0|landed but is empty/i,
    issue: 'The file landed on schedule but is empty (0 bytes).',
    resolution:
      "1. Check the upstream job's logs for a silent failure that still wrote an empty output file instead of erroring.\n2. Confirm the source had data for this run's window — an empty source dataset would also produce this.\n3. Re-run the upstream job once the root cause is fixed; this check will pass once a non-empty file lands.",
  },
  {
    match: /size deviates/i,
    issue: "Today's file size deviates from the recent average by more than the configured threshold.",
    resolution:
      '1. Compare the deviation direction — a large increase often means a duplicate/replay load, a large decrease often means a partial or truncated extract.\n2. Check the upstream source for a known event (backfill, promotion, outage) that would explain a real change in volume.\n3. If this is expected and recurring, consider raising the deviation threshold or lookback window instead of treating every run as an alert.',
  },
]

/** Falls back to a message-pattern-matched explanation when no LLM is configured — for file presence/size failures that have no structured detail object to reason over. */
export function mockFileCheckAnalysis(message: string): LogAnalysis {
  for (const pattern of FILE_CHECK_PATTERNS) {
    if (pattern.match.test(message)) {
      return { issue: pattern.issue, resolution: pattern.resolution }
    }
  }
  return {
    issue: "This failure message doesn't match a known pattern in the built-in analyzer.",
    resolution: 'Share the failure message with your data engineering team for a detailed diagnosis.',
  }
}

export function buildFileCheckAnalysisPrompt(pipelineLabel: string, message: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a data quality assistant helping a data engineer resolve a file presence or file-size check failure that has no structured debug data attached — only a status message. Given the pipeline name and the failure message, respond with exactly two short sections: "Issue:" (what went wrong, in plain language) and "Resolution:" (concrete, numbered next steps to investigate or fix it). Do not include anything else.',
    },
    {
      role: 'user',
      content: `Pipeline: ${pipelineLabel}\n\nFailure message: ${message}`,
    },
  ]
}

export interface RuleSuggestion {
  ruleName: string
  appliesTo: string
  detectionLogic: string
  documentation: string
}

export function buildPatternRuleSuggestionPrompt(
  patternLabel: string,
  exampleMessage: string,
  pipelineLabels: string[],
  occurrences: number,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a data platform assistant helping a data engineering team turn a recurring data quality issue into a standing, documented framework rule instead of a one-off alert. Given a recurring issue pattern, respond with exactly four short sections in this order: "Rule name:", "Applies to:" (what kind of sources this should run against), "Detection logic:" (plain-language description of what to check, 1-3 sentences), and "Documentation:" (a short paragraph suitable for pasting into the team\'s data quality framework docs, explaining what this rule catches and why it matters). Do not include anything else.\n\nRule name style — this MUST match the naming convention already used across every other rule in the framework: a short, lowercase-first descriptive phrase (hyphens allowed for compound modifiers), never PascalCase, camelCase, or Title Case, and never a code-style identifier. Good examples already in the framework: "Duplicate-event dedup on redelivery", "Zero-byte / truncated file detection, skip-not-fail", "Scheduled file presence gate", "Golden-record dedup monitor". Bad examples to avoid: "ScheduledFilePresenceCheck", "Validate Numeric Range", "DedupMonitor".',
    },
    {
      role: 'user',
      content: `Recurring issue: ${patternLabel}\nSeen ${occurrences} time(s) across: ${pipelineLabels.join(', ')}\nExample failure message: "${exampleMessage}"`,
    },
  ]
}

export function parseRuleSuggestion(raw: string): RuleSuggestion {
  const grab = (label: string) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n(?:Rule name|Applies to|Detection logic|Documentation):|$)`, 'i')
    const match = raw.match(re)
    return match ? match[1].trim() : ''
  }
  return {
    ruleName: grab('Rule name') || 'Untitled rule',
    appliesTo: grab('Applies to') || '—',
    detectionLogic: grab('Detection logic') || '—',
    documentation: grab('Documentation') || raw.trim(),
  }
}

const MOCK_RULE_TEMPLATES: Record<string, RuleSuggestion> = {
  missing_file: {
    ruleName: 'Scheduled file presence gate',
    appliesTo: 'Any file-based source with a fixed delivery schedule',
    detectionLogic:
      "Fail the run if the expected file for today's partition is absent at the scheduled check time, instead of letting downstream steps run against stale or missing data.",
    documentation:
      'Recurring "file not found" failures across multiple sources indicate upstream delivery timing is not reliable enough to assume-and-proceed. This rule makes file presence a standing, non-negotiable gate for every file-based pipeline, not a per-pipeline judgment call.',
  },
  zero_byte: {
    ruleName: 'Zero-byte file hard-fail',
    appliesTo: 'Any file-based source, regardless of whether size-deviation checks are enabled',
    detectionLogic:
      'Fail immediately if a file exists but its size is exactly 0 bytes — this is a structural failure, not a statistical deviation, so it should not depend on the deviation threshold or lookback window.',
    documentation:
      'A file landing empty is functionally identical to it not landing at all, but was previously only caught as a large negative size-deviation warning. Treating it as its own hard-fail check catches it even on day one, before any size history exists to compare against.',
  },
  size_deviation: {
    ruleName: 'Size-deviation escalation',
    appliesTo: 'File-based sources with size-deviation checks enabled',
    detectionLogic:
      'Escalate a size-deviation warning to a hard fail if the same source deviates on 2+ consecutive scheduled runs, rather than treating every deviation as an independent, equally-low-priority warning.',
    documentation:
      'Isolated size deviations are often benign (a real traffic spike); the same source deviating repeatedly is a much stronger signal of an upstream problem. This rule turns a repeat offender into an escalation instead of relying on someone noticing the pattern manually.',
  },
  rule_violation: {
    ruleName: 'Cross-table rule-violation rollup',
    appliesTo: 'Any table with column-level quality rules configured',
    detectionLogic:
      'When the same rule type fails on the same field name (e.g., a "customer_email" regex failure) across more than one table, flag it as a shared upstream data issue rather than N separate table-level incidents.',
    documentation:
      'The same malformed data (e.g., an upstream export bug) often lands in more than one downstream table. Rolling these up by rule type and field name surfaces the shared root cause instead of requiring someone to manually notice the coincidence across tables.',
  },
  schema_drift: {
    ruleName: 'Baseline schema drift gate',
    appliesTo: 'Any source with a captured schema baseline (table or file)',
    detectionLogic:
      'Compare each run\'s introspected schema against the captured baseline; treat added columns as review-worthy warnings and removed/retyped columns as hard failures, since those break downstream mapping.',
    documentation:
      'Recurring schema drift across sources means upstream teams are changing schemas without notifying data engineering. This rule makes drift detection a standing check per source instead of relying on a mapping error surfacing downstream after the fact.',
  },
  dedup: {
    ruleName: 'Golden-record dedup monitor',
    appliesTo: 'Any target with a defined golden-record key',
    detectionLogic:
      'On a recurring schedule, check the target for rows sharing a golden-record key that should be unique, independent of the one-time source/target row-count check run at deploy time.',
    documentation:
      'Duplication can creep back into a target after go-live even when the pipeline passed its one-time deploy validation — an upstream re-run or a key losing uniqueness are both silent until something downstream double-counts. This rule catches that drift on an ongoing basis.',
  },
  other: {
    ruleName: 'Unclassified-failure triage rule',
    appliesTo: 'Any monitored source',
    detectionLogic:
      "Route failures that don't match an existing known-pattern category into a triage queue instead of a generic alert, so the framework's pattern taxonomy keeps growing as new failure types are seen.",
    documentation:
      'Every framework starts with a known set of failure categories, but production always surfaces new ones. This rule is the safety net: anything unclassified gets flagged for a human to categorize once, after which it becomes a first-class pattern like the others.',
  },
}

/** Falls back to a category-matched rule template when no LLM is configured. */
export function mockPatternRuleSuggestion(category: string): RuleSuggestion {
  return MOCK_RULE_TEMPLATES[category] ?? MOCK_RULE_TEMPLATES.other
}

export interface ColumnMappingSuggestion {
  source: string
  target: string
}

export function buildColumnMappingPrompt(sourceColumns: ColumnInfo[], targetColumns: ColumnInfo[]): ChatMessage[] {
  const sourceList = sourceColumns.map((c) => `- ${c.name} (${c.type})`).join('\n')
  const targetList = targetColumns.map((c) => `- ${c.name} (${c.type})`).join('\n')
  return [
    {
      role: 'system',
      content:
        'You are a data engineering assistant that maps source database columns to target columns based primarily on column name similarity, using data type as a secondary signal. Respond with ONLY a JSON object of the exact form {"mappings":[{"source":"<source_column_name>","target":"<target_column_name>"}]}. Include a pair only when you are reasonably confident it is the same underlying field. Omit columns you are not confident about — do not guess. No explanation, no markdown, no code fences, just the JSON object.',
    },
    {
      role: 'user',
      content: `Source columns:\n${sourceList}\n\nTarget columns:\n${targetList}`,
    },
  ]
}

export function parseColumnMappingResponse(raw: string): ColumnMappingSuggestion[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!parsed || !Array.isArray(parsed.mappings)) throw new Error('Unexpected mapping response shape')
  return parsed.mappings.filter(
    (m: unknown): m is ColumnMappingSuggestion =>
      typeof m === 'object' && m !== null && typeof (m as ColumnMappingSuggestion).source === 'string' && typeof (m as ColumnMappingSuggestion).target === 'string',
  )
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Falls back to exact (case/punctuation-insensitive) name matching when no LLM is configured. */
export function mockAutoMapColumns(sourceColumns: ColumnInfo[], targetColumns: ColumnInfo[]): ColumnMappingSuggestion[] {
  const suggestions: ColumnMappingSuggestion[] = []
  for (const target of targetColumns) {
    const targetKey = normalizeColumnName(target.name)
    const match = sourceColumns.find((s) => normalizeColumnName(s.name) === targetKey)
    if (match) suggestions.push({ source: match.name, target: target.name })
  }
  return suggestions
}
