import { useMemo, useState } from 'react'
import { LocalVectorStore, type RagChunk } from '../rag/vectorStore'
import { RAG_CORPUS } from '../rag/corpus'
import { buildRagPrompt, callLlm, getLlmSettings, isLlmConfigured, mockAnswerFromChunks } from '../rag/llmClient'
import { IconAssistant } from './icons'
import type { DqExecution, DqRuleSet, JobRun } from '../types'
import { formatDateTime } from '../utils/format'

interface ChatWidgetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLocation?: string
  jobRuns?: JobRun[]
  dqExecutions?: DqExecution[]
  dqRuleSets?: DqRuleSet[]
}

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  sources?: RagChunk[]
  isMock?: boolean
}

const BASE_SUGGESTED_QUESTIONS = [
  'Why is the connection Type field locked after I pick a template?',
  'What is the difference between update & merge and truncate & insert load mode?',
  'How does the file size data quality check work?',
]

const FAILING_RUN_STATES = new Set(['failed', 'up_for_retry'])
const FAILING_DQ_STATES = new Set(['fail', 'warning'])
const RECENT_FAILURE_LIMIT = 5

function buildFailureChunks(jobRuns: JobRun[], dqExecutions: DqExecution[], dqRuleSets: DqRuleSet[]): RagChunk[] {
  const runChunks = jobRuns
    .filter((r) => FAILING_RUN_STATES.has(r.state))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
    .slice(0, RECENT_FAILURE_LIMIT)
    .map((r) => ({
      id: `live-run-${r.run_id}`,
      title: `Recent job failure: ${r.pipeline_id} (${formatDateTime(r.start_date)})`,
      text: `Pipeline "${r.pipeline_id}" run ${r.run_id} is currently in state "${r.state}" (${r.trigger_type} trigger, started ${formatDateTime(r.start_date)}). Log excerpt:\n${r.log_excerpt}`,
    }))

  const dqChunks = dqExecutions
    .filter((e) => FAILING_DQ_STATES.has(e.status))
    .sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1))
    .slice(0, RECENT_FAILURE_LIMIT)
    .map((e) => {
      const label = dqRuleSets.find((r) => r.pipeline_id === e.pipeline_id)?.pipeline_label ?? e.pipeline_id
      const failureDetail = (e.rule_failures ?? [])
        .map((f) => `${f.field} (${f.rule}, ${f.violation_count} violating row${f.violation_count === 1 ? '' : 's'})`)
        .join('; ')
      return {
        id: `live-dq-${e.id}`,
        title: `Recent data quality ${e.status}: ${label} (${formatDateTime(e.executed_at)})`,
        text: `Data quality check for "${label}" is in status "${e.status}" as of ${formatDateTime(e.executed_at)}: ${e.message}${failureDetail ? `. Failing rules: ${failureDetail}` : ''}`,
      }
    })

  return [...runChunks, ...dqChunks]
}

export default function ChatWidget({ open, onOpenChange, currentLocation, jobRuns = [], dqExecutions = [], dqRuleSets = [] }: ChatWidgetProps) {
  const failureChunks = useMemo(
    () => buildFailureChunks(jobRuns, dqExecutions, dqRuleSets),
    [jobRuns, dqExecutions, dqRuleSets],
  )
  const store = useMemo(() => new LocalVectorStore([...RAG_CORPUS, ...failureChunks]), [failureChunks])
  const settings = useMemo(() => getLlmSettings(), [])
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: 'assistant',
      content:
        "Hi! Ask me anything about how this platform works — pipeline steps, connection types, data quality checks, or the mock deploy flow. I can also see recent job and data quality failures, so ask if you're stuck on one.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const suggestedQuestions = useMemo(() => {
    const questions = [...BASE_SUGGESTED_QUESTIONS]
    if (failureChunks.length > 0) questions.unshift('Why did my most recent pipeline run fail?')
    return questions
  }, [failureChunks])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    const results = store.search(question, 3)
    const chunks = results.map((r) => r.chunk)

    if (isLlmConfigured(settings)) {
      try {
        const answer = await callLlm(settings, buildRagPrompt(question, chunks, currentLocation))
        setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources: chunks }])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: mockAnswerFromChunks(chunks), sources: chunks, isMock: true },
        ])
      }
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', content: mockAnswerFromChunks(chunks), sources: chunks, isMock: true }])
    }
    setLoading(false)
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-widget-panel">
          <div className="chat-widget-head">
            <div>
              <strong>Assistant</strong>
              <span className="chat-widget-subtitle">
                {currentLocation ? `Grounded in this app's docs — you're on the ${currentLocation}` : "Ask a question, grounded in this app's own docs"}
              </span>
            </div>
            <button type="button" className="chat-widget-close" onClick={() => onOpenChange(false)} aria-label="Close chat">
              ×
            </button>
          </div>

          <div className="chat-window chat-widget-window">
            {messages.map((m, i) => (
              <div className={`chat-bubble ${m.role}`} key={i}>
                <div className="chat-bubble-content">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                  <details className="chat-sources">
                    <summary>{m.isMock ? 'Retrieved docs' : `Sources (${m.sources.length})`}</summary>
                    <ul>
                      {m.sources.map((s) => (
                        <li key={s.id}>{s.title}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble assistant">
                <div className="chat-bubble-content hint">Searching docs and generating an answer…</div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="chip-row chat-widget-suggestions">
              {suggestedQuestions.map((q) => (
                <button type="button" className="chip" key={q} onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="row-actions chat-widget-input-row">
            <input
              style={{ flex: 1 }}
              value={input}
              placeholder="Ask a question…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ask(input)
              }}
            />
            <button type="button" className="btn primary" onClick={() => ask(input)} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat-widget-launcher"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <span className="chat-widget-launcher-close">×</span> : <IconAssistant />}
      </button>
    </div>
  )
}
