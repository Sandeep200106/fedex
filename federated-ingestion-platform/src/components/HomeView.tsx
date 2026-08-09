import { IconAssistant, IconConnections, IconDeploy, IconQuality, IconSchema, IconWizard } from './icons'
import { CONNECTION_TYPES, PIPELINE_TEMPLATES } from '../data/templates'
import { DQ_CHECK_MECHANISM_COUNT } from '../data/qualityRules'

interface HomeViewProps {
  onStartBuilding: () => void
  onOpenChat: () => void
}

const FEATURES = [
  {
    icon: IconWizard,
    title: 'Template-driven wizard',
    desc: 'Pick a source-to-target template — PostgreSQL, MySQL, Oracle, SQL Server, S3, SFTP, Kafka, or REST API into GCS, or Oracle CDC straight into BigQuery — and the required connection type for each side is set for you, no guesswork.',
  },
  {
    icon: IconConnections,
    title: 'Reusable connections',
    desc: 'Set up each connection once in the Connections tab, then pick it from a list every time you build a pipeline — no re-typing host, credentials, or tags for the same system twice.',
  },
  {
    icon: IconSchema,
    title: 'Schema discovery & drag-to-map columns',
    desc: 'Source and target columns are fetched automatically once both sides have a real schema (like PostgreSQL to BigQuery) — drag a source column onto a target column to map it, and type mismatches are flagged before you ship.',
  },
  {
    icon: IconQuality,
    title: 'Data quality monitoring',
    desc: 'Column-level rules (null, range, regex, allowed values, unique), file presence/size trend checks, schema drift, and dedup/golden-record checks — on a schedule or on demand, with full execution history and a case-study coverage catalog showing what maps to a real ingestion-pattern incident.',
  },
  {
    icon: IconAssistant,
    title: 'AI assistant & failure analysis',
    desc: 'A retrieval-augmented chatbot — click the chat bubble in the bottom-right corner any time — answers questions from this app\'s own docs, and failed runs get a plain-language issue and resolution.',
  },
  {
    icon: IconDeploy,
    title: 'GitHub → Airflow → GCP deploy flow',
    desc: 'Review the exact JSON that would ship, commit it to GitHub, and trigger a run on the GCP data service the pipeline is set to use — Dataflow, Dataproc, or Cloud Data Fusion.',
  },
]

export default function HomeView({ onStartBuilding, onOpenChat }: HomeViewProps) {
  return (
    <div className="panel home-panel">
      <section className="home-hero">
        <h1 className="home-title">Federated Ingestion Platform</h1>
        <p className="home-subtitle">
          A self-service platform for designing, validating, and monitoring data pipelines — no hand-written DAGs, no
          guessing at connection details.
        </p>
        <div className="home-hero-actions">
          <button type="button" className="btn primary" onClick={onStartBuilding}>
            Start building →
          </button>
          <button type="button" className="btn" onClick={onOpenChat}>
            Ask the Assistant
          </button>
        </div>
      </section>

      <section className="stat-row">
        <div className="stat-tile">
          <strong>{PIPELINE_TEMPLATES.length}</strong>
          <span>pipeline templates</span>
        </div>
        <div className="stat-tile">
          <strong>{CONNECTION_TYPES.length}</strong>
          <span>connection types</span>
        </div>
        <div className="stat-tile">
          <strong>{DQ_CHECK_MECHANISM_COUNT}</strong>
          <span>data quality checks</span>
        </div>
        <div className="stat-tile">
          <strong>AI</strong>
          <span>failure analysis</span>
        </div>
      </section>

      <section>
        <h2 className="home-section-title">About the product</h2>
        <p className="home-section-body">
          Federated Ingestion Platform turns the usual multi-day process of standing up a new data pipeline — picking a connector,
          writing connection JSON by hand, wiring up an Airflow DAG, and hoping the schema matches — into a guided
          wizard. Set up each connection once in the Connections tab, then pick a template, choose the source and
          target connections it needs, map your columns, and review the exact JSON before it ships. Everything past
          the wizard (commits, runs, data quality checks, and troubleshooting) is visible in its own tab.
        </p>
        <div className="feature-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">
                  <Icon />
                </div>
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
