import { useState } from 'react'
import HelpTip from './HelpTip'

// A small, self-contained walkthrough using its own mock state — deliberately NOT wired into
// the real Job History / DQ Framework data, so it can safely illustrate the "adopting a check
// reduces future failures" idea without touching (or being confused with) real app state.
// The scenario is a genuine DQ check (zero-byte file detection — already in the case-study
// catalog), not an infra/API error — infra failures (rate limits, connection drops, timeouts)
// are a different category, already covered by Job History's logs + AI analysis, not this.
const BEFORE_SUCCESS_PROBABILITY = 0.15
const AFTER_SUCCESS_PROBABILITY = 0.9
const PIPELINE_LABEL = 'Orders Feed (GCS) (demo)'
const RULE_NAME = 'Zero-byte file detection (skip-not-fail)'
const FAILURE_MESSAGE = 'Zero-byte file landed at gs://.../orders/dt={{ds}}/part-0.parquet — downstream parse step crashed on empty input'
const FIX_SUCCESS_MESSAGE = 'Zero-byte file detected and skipped cleanly — downstream steps ran on the next valid file, no crash'
const FIX_STILL_FAILS_MESSAGE = 'Unrelated to the zero-byte check: a large file transfer timed out mid-write — will retry'
const MAX_LOG_ROWS = 6

interface Attempt {
  id: number
  adoptedAtRunTime: boolean
  status: 'pass' | 'fail'
  message: string
}

export default function FrameworkLoopDemo() {
  const [adopted, setAdopted] = useState(false)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [nextId, setNextId] = useState(1)

  function rerun() {
    const successProbability = adopted ? AFTER_SUCCESS_PROBABILITY : BEFORE_SUCCESS_PROBABILITY
    const succeeds = Math.random() < successProbability
    const message = succeeds ? (adopted ? FIX_SUCCESS_MESSAGE : 'Succeeded — a valid file happened to land this time') : adopted ? FIX_STILL_FAILS_MESSAGE : FAILURE_MESSAGE
    const status: 'pass' | 'fail' = succeeds ? 'pass' : 'fail'
    setAttempts((prev) => [{ id: nextId, adoptedAtRunTime: adopted, status, message }, ...prev].slice(0, MAX_LOG_ROWS))
    setNextId((n) => n + 1)
  }

  function adoptRule() {
    setAdopted(true)
  }

  function resetDemo() {
    setAdopted(false)
    setAttempts([])
    setNextId(1)
  }

  return (
    <section>
      <h2 className="home-section-title">
        See the framework close the loop
        <HelpTip text="This walkthrough uses its own mock data, separate from your real Job History and DQ Framework — it's here to illustrate the idea: once a DQ check is adopted as a framework rule, future runs of the pipeline it protects fail far less often." />
      </h2>
      <p className="home-section-body">
        <strong>{PIPELINE_LABEL}</strong> keeps failing when a zero-byte file lands — there's no check yet to catch it before it
        crashes the parse step. Rerun it a few times to see the failure rate, adopt the fix, then rerun again.
      </p>

      <div className="rule-grid">
        <div className="transform-card">
          <div className="transform-card-head">
            <strong>{RULE_NAME}</strong>
            <span className={`status-badge ${adopted ? 'status-success' : 'status-warning'}`}>
              {adopted ? 'In framework' : 'Not in framework'}
            </span>
          </div>
          <p className="hint">
            {adopted
              ? 'Reruns now check for a zero-byte file first and skip it cleanly instead of crashing — a landed empty file rarely causes a hard failure anymore.'
              : 'Without this rule, a zero-byte file gets passed straight to the parse step, which crashes on empty input most of the time.'}
          </p>
          {!adopted && (
            <button type="button" className="btn primary small" onClick={adoptRule}>
              Add to framework
            </button>
          )}
        </div>

        <div className="transform-card">
          <div className="transform-card-head">
            <strong>Run it</strong>
          </div>
          <div className="row-actions">
            <button type="button" className="btn primary small" onClick={rerun}>
              Rerun {PIPELINE_LABEL}
            </button>
            <button type="button" className="btn small ghost" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
          {attempts.length === 0 ? (
            <p className="hint" style={{ marginTop: 12 }}>
              No runs yet — click "Rerun" to try it.
            </p>
          ) : (
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rule status at run time</th>
                  <th>Result</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="hint mono">{a.id}</td>
                    <td className="hint">{a.adoptedAtRunTime ? 'In framework' : 'Not in framework'}</td>
                    <td>
                      <span className={`status-badge ${a.status === 'pass' ? 'status-success' : 'status-failed'}`}>
                        {a.status === 'pass' ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="hint">{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
