import { Fragment, useState } from 'react'
import type { DqExecution, DqRuleSet } from '../types'
import { buildAllQualityPatterns, pipelineBreakdownFor } from '../data/qualityPatterns'
import type { FrameworkRule } from '../data/dqFramework'
import type { RuleSuggestion } from '../rag/llmClient'
import { formatDateTime, resolveDsPlaceholder } from '../utils/format'
import HelpTip from './HelpTip'

interface QualityPatternsViewProps {
  executions: DqExecution[]
  ruleSets: DqRuleSet[]
  frameworkRules: FrameworkRule[]
  onAdoptIntoFramework: (patternKey: string, suggestion: RuleSuggestion) => void
  onNavigateToPipeline: (pipelineId: string) => void
}

export default function QualityPatternsView({ executions, ruleSets, onNavigateToPipeline }: QualityPatternsViewProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const patterns = buildAllQualityPatterns(executions).filter((pattern) => pattern.occurrences > 0)

  const helpTip = (
    <HelpTip text="Every DQ check type with at least one live failure, one row each, with its real occurrence count. Click the occurrence count to see which pipelines it hit, when it last happened, and an example." />
  )

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-title">
        Live DQ issues
        {helpTip}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Check</th>
            <th>Occurrences</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => {
            const expanded = expandedKey === pattern.key
            const breakdown = pipelineBreakdownFor(pattern, executions)
            return (
              <Fragment key={pattern.key}>
                <tr className={pattern.pipelineIds.length > 1 ? 'run-row' : undefined}>
                  <td>
                    {pattern.label}
                    {pattern.pipelineIds.length > 1 && (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        root cause candidate
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => setExpandedKey(expanded ? null : pattern.key)}
                    >
                      {pattern.occurrences}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="log-row">
                    <td colSpan={2}>
                      <div className="ai-analysis-result" style={{ margin: '0 16px 12px' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Pipeline</th>
                              <th>Occurrences</th>
                              <th>Last seen</th>
                              <th>Example</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.map((row) => (
                              <tr key={row.pipelineId}>
                                <td>
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => onNavigateToPipeline(row.pipelineId)}
                                  >
                                    {ruleSets.find((r) => r.pipeline_id === row.pipelineId)?.pipeline_label ?? row.pipelineId}
                                  </button>
                                </td>
                                <td>{row.occurrences}</td>
                                <td>{formatDateTime(row.lastSeenAt)}</td>
                                <td className="hint" style={{ maxWidth: 320 }}>
                                  {resolveDsPlaceholder(row.exampleMessage, row.lastSeenAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
