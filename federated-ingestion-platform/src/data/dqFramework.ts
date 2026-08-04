import { CASE_STUDY_DQ_CHECKS } from './caseStudyDqChecks'
import { slugify } from '../utils/slug'

// A single, persisted registry of DQ rules — seeded from the case-study catalog (source:
// 'case_study') and grown over time by whatever gets adopted from Live DQ issues (source:
// 'live_issue'). This is what makes "add to framework" from the live view and "DQ checks per
// ingestion pattern" the SAME list, instead of two disconnected UI surfaces.
export type FrameworkRuleStatus = 'implemented' | 'gap' | 'drafted'
export type FrameworkRuleSource = 'case_study' | 'live_issue'

export interface FrameworkRule {
  id: string
  pattern: string
  flow: string
  check: string
  riskDescription: string
  status: FrameworkRuleStatus
  mechanism: string
  source: FrameworkRuleSource
  addedAt: string
  // Only set for source: 'live_issue' — the QualityPattern.key it was adopted from, so the UI
  // can tell "already adopted" apart from "not yet drafted" without relying on ephemeral
  // component state that resets on reload.
  sourcePatternKey?: string
}

const STORAGE_KEY = 'pipeline-builder-dq-framework'

function seedFromCaseStudy(): FrameworkRule[] {
  return CASE_STUDY_DQ_CHECKS.map((c) => ({
    id: `cs_${slugify(c.pattern)}_${slugify(c.flow)}_${slugify(c.check)}`,
    pattern: c.pattern,
    flow: c.flow,
    check: c.check,
    riskDescription: c.riskDescription,
    status: c.status,
    mechanism: c.mechanism,
    source: 'case_study' as const,
    addedAt: '2026-07-20T00:00:00Z',
  }))
}

// Case-study entries are always recomputed fresh from CASE_STUDY_DQ_CHECKS (so edits to that
// catalog reach every browser immediately, the same class of bug fixed for connections) —
// only entries adopted live are read back from storage and merged in.
export function loadFrameworkRules(): FrameworkRule[] {
  const seeded = seedFromCaseStudy()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seeded
    const parsed = JSON.parse(raw)
    const liveRules: FrameworkRule[] = Array.isArray(parsed) ? parsed.filter((r) => r && r.source === 'live_issue') : []
    return [...seeded, ...liveRules]
  } catch {
    return seeded
  }
}

export function saveFrameworkRules(rules: FrameworkRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.filter((r) => r.source === 'live_issue')))
}

export function frameworkRuleFromSuggestion(params: {
  patternKey: string
  ruleName: string
  appliesTo: string
  detectionLogic: string
  documentation: string
}): FrameworkRule {
  return {
    id: `live_${slugify(params.ruleName)}_${Date.now()}`,
    pattern: 'Adopted from live monitoring',
    flow: params.appliesTo,
    check: params.ruleName,
    riskDescription: params.documentation,
    status: 'drafted',
    mechanism: params.detectionLogic,
    source: 'live_issue',
    addedAt: new Date().toISOString(),
    sourcePatternKey: params.patternKey,
  }
}

export function isPatternAdopted(frameworkRules: FrameworkRule[], patternKey: string): boolean {
  return frameworkRules.some((r) => r.source === 'live_issue' && r.sourcePatternKey === patternKey)
}
