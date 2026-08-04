import type { FrameworkRule } from '../data/dqFramework'
import HelpTip from './HelpTip'

const STATUS_LABEL: Record<string, string> = {
  implemented: 'Implemented',
  gap: 'Yet to implement',
  drafted: 'Drafted (from live monitoring)',
}

const STATUS_CLASS: Record<string, string> = {
  implemented: 'status-success',
  gap: 'status-warning',
  drafted: 'status-queued',
}

interface CaseStudyDqCoverageViewProps {
  rules: FrameworkRule[]
}

export default function CaseStudyDqCoverageView({ rules }: CaseStudyDqCoverageViewProps) {
  // Case-study patterns keep their original order; anything adopted live is appended as its
  // own group at the end, so newly-adopted rules never reshuffle the established groups above.
  const caseStudyPatterns = Array.from(new Set(rules.filter((r) => r.source === 'case_study').map((r) => r.pattern)))
  const hasLiveRules = rules.some((r) => r.source === 'live_issue')
  const patterns = hasLiveRules ? [...caseStudyPatterns, 'Adopted from live monitoring'] : caseStudyPatterns

  return (
    <div className="transform-card" style={{ marginBottom: 20 }}>
      <div className="transform-card-head">
        <strong>DQ checks per ingestion pattern</strong>
        <HelpTip text="The DQ rule framework: every distinct check called out across the 6 ingestion-pattern case studies (Real-time, Batch RDBMS, API, Flat Files, Object Storage, CDC), one row per check, plus anything adopted from Live DQ issues via 'Add to framework'. Each case-study check is attributed to a single owning pattern — the same DQ pillar (uniqueness, completeness, validity...) recurs across patterns in the source doc, but only the first concrete, distinct mechanism is listed so nothing repeats." />
      </div>

      {patterns.map((pattern) => (
        <div key={pattern} style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            {pattern}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Flow</th>
                <th>Check</th>
                <th>Risk it catches</th>
                <th>Status</th>
                <th>Mechanism</th>
              </tr>
            </thead>
            <tbody>
              {rules
                .filter((r) => r.pattern === pattern)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="hint mono">{r.flow}</td>
                    <td>{r.check}</td>
                    <td className="hint" style={{ maxWidth: 280 }}>
                      {r.riskDescription}
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="hint" style={{ maxWidth: 320 }}>
                      {r.mechanism}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
