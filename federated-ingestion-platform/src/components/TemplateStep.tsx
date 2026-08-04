import { CONNECTION_TYPES, PIPELINE_TEMPLATES, loadModeLabel } from '../data/templates'
import { dataServiceLabel } from '../data/dataServices'
import type { ConnectionType } from '../types'

function typeLabel(type: ConnectionType): string {
  return CONNECTION_TYPES.find((c) => c.value === type)?.label ?? type
}

interface TemplateStepProps {
  templateId: string
  onSelect: (templateId: string) => void
}

export default function TemplateStep({ templateId, onSelect }: TemplateStepProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Choose a pipeline template</h2>
        <p>
          Templates define the prebuilt Airflow DAG and job logic that a GCP data service — Dataflow, Dataproc, or Cloud Data Fusion —
          will run. Pick the one that matches your source and target; you can change which service it runs on in the Details step.
        </p>
      </div>
      <div className="template-grid">
        {PIPELINE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-card ${templateId === template.id ? 'selected' : ''}`}
            onClick={() => onSelect(template.id)}
          >
            <strong>{template.label}</strong>
            <span className="desc">{template.description}</span>
            <span className="hint">
              Auto-fills: {typeLabel(template.sourceType)} → {typeLabel(template.targetType)}
            </span>
            <span className="badge-row">
              <span className="badge">{loadModeLabel(template.defaultLoadMode)}</span>
              <span className="badge badge-data-service">{dataServiceLabel(template.defaultDataService)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
