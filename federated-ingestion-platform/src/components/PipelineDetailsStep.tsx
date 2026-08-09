import type {
  ColumnInfo,
  DataServiceEngine,
  DeliveryPattern,
  PipelineLanguage,
  Schedule,
  ThroughputProfile,
  Transformation,
  TransformationType,
  TransformFunction,
} from '../types'
import { TRANSFORM_FUNCTIONS } from '../data/transformFunctions'
import { DATA_SERVICE_OPTIONS } from '../data/dataServices'
import { deliveryPatternLabel } from '../data/deliveryPatterns'
import { explainLanguageConflict, recommendEngineAndLanguage } from '../data/engineRecommendation'
import { estimateCostTier } from '../data/costEstimate'
import { slugify } from '../utils/slug'
import HelpTip from './HelpTip'

interface PipelineDetailsStepProps {
  name: string
  owner: string
  gitPath: string
  transformations: Transformation[]
  schedule: Schedule
  dataService: DataServiceEngine
  deliveryPattern: DeliveryPattern
  throughput: ThroughputProfile
  language: PipelineLanguage
  sourceColumns: ColumnInfo[]
  onNameChange: (name: string) => void
  onOwnerChange: (owner: string) => void
  onGitPathChange: (gitPath: string) => void
  onTransformationsChange: (next: Transformation[]) => void
  onDataServiceChange: (next: DataServiceEngine) => void
  onLanguageChange: (next: PipelineLanguage) => void
}

const TRANSFORM_TYPES: TransformationType[] = ['filter', 'dedupe', 'transform']
const TRANSFORM_FUNCTION_KEYS = Object.keys(TRANSFORM_FUNCTIONS) as TransformFunction[]
const LANGUAGE_OPTIONS: { value: PipelineLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'scala', label: 'Scala' },
]

export default function PipelineDetailsStep({
  name,
  owner,
  gitPath,
  transformations,
  schedule,
  dataService,
  deliveryPattern,
  throughput,
  language,
  sourceColumns,
  onNameChange,
  onOwnerChange,
  onGitPathChange,
  onTransformationsChange,
  onDataServiceChange,
  onLanguageChange,
}: PipelineDetailsStepProps) {
  const selectedDataService = DATA_SERVICE_OPTIONS.find((o) => o.value === dataService)
  const recommendation = recommendEngineAndLanguage(throughput, deliveryPattern)
  const languageConflict = explainLanguageConflict(language, recommendation, throughput)
  const costEstimate = estimateCostTier({ data_service: dataService, delivery_pattern: deliveryPattern, expected_throughput: throughput, schedule })
  function addTransformation() {
    onTransformationsChange([...transformations, { type: 'filter', condition: '' }])
  }

  function updateTransformation(index: number, patch: Partial<Transformation>) {
    onTransformationsChange(transformations.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  function changeType(index: number, type: TransformationType) {
    if (type === 'transform') {
      updateTransformation(index, { type, column: '', function: undefined, args: [], condition: undefined, keys: undefined })
    } else if (type === 'filter') {
      updateTransformation(index, { type, condition: '', column: undefined, function: undefined, args: undefined, keys: undefined })
    } else {
      updateTransformation(index, { type, keys: [], column: undefined, function: undefined, args: undefined, condition: undefined })
    }
  }

  function changeFunction(index: number, fn: TransformFunction) {
    const spec = TRANSFORM_FUNCTIONS[fn]
    updateTransformation(index, { function: fn, args: spec.argLabels.map(() => '') })
  }

  function updateArg(index: number, argIndex: number, value: string) {
    const t = transformations[index]
    const args = [...(t.args ?? [])]
    args[argIndex] = value
    updateTransformation(index, { args })
  }

  function removeTransformation(index: number) {
    onTransformationsChange(transformations.filter((_, i) => i !== index))
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Pipeline details &amp; transformations</h2>
        <p>Name the pipeline and add optional transformations.</p>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Pipeline name</label>
          <input
            value={name}
            placeholder="Orders Sync - Daily"
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Owner</label>
          <input value={owner} placeholder="data-engineering" onChange={(e) => onOwnerChange(e.target.value)} />
        </div>
        <div className="field full">
          <label>Git path</label>
          <input
            value={gitPath}
            placeholder={`pipelines/${slugify(name || 'pipeline_name')}.json`}
            onChange={(e) => onGitPathChange(e.target.value)}
          />
          <span className="hint">Defaults from the pipeline name — feel free to override it. Location the Config API will commit this pipeline JSON to in GitHub.</span>
        </div>
      </div>

      <div>
        <div className="row-actions" style={{ justifyContent: 'space-between' }}>
          <div className="section-title">Transformations</div>
          <button type="button" className="btn small" onClick={addTransformation}>
            + Add transformation
          </button>
        </div>

        {transformations.length === 0 && <p className="hint">No transformations added. Raw mapped data will be loaded as-is.</p>}

        {transformations.map((t, i) => (
          <div className="transform-card" key={i}>
            <div className="transform-card-head">
              <select value={t.type} onChange={(e) => changeType(i, e.target.value as TransformationType)}>
                {TRANSFORM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button type="button" className="btn small danger" onClick={() => removeTransformation(i)}>
                Remove
              </button>
            </div>

            {t.type === 'filter' && (
              <div className="field">
                <label>Condition</label>
                <input
                  value={t.condition ?? ''}
                  placeholder="amount > 0"
                  onChange={(e) => updateTransformation(i, { condition: e.target.value })}
                />
              </div>
            )}

            {t.type === 'dedupe' && (
              <div className="field">
                <label>Dedupe keys (comma separated)</label>
                <input
                  value={(t.keys ?? []).join(', ')}
                  placeholder="order_id"
                  onChange={(e) =>
                    updateTransformation(i, {
                      keys: e.target.value
                        .split(',')
                        .map((k) => k.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}

            {t.type === 'transform' && (
              <div className="form-grid">
                <div className="field">
                  <label>Column</label>
                  {sourceColumns.length > 0 ? (
                    <select value={t.column ?? ''} onChange={(e) => updateTransformation(i, { column: e.target.value })}>
                      <option value="">Select a column…</option>
                      {sourceColumns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={t.column ?? ''}
                      placeholder="order_id"
                      onChange={(e) => updateTransformation(i, { column: e.target.value })}
                    />
                  )}
                </div>
                <div className="field">
                  <label>Function</label>
                  <select value={t.function ?? ''} onChange={(e) => changeFunction(i, e.target.value as TransformFunction)}>
                    <option value="">Select a function…</option>
                    {TRANSFORM_FUNCTION_KEYS.map((fn) => (
                      <option key={fn} value={fn}>
                        {TRANSFORM_FUNCTIONS[fn].label}
                      </option>
                    ))}
                  </select>
                </div>
                {t.function &&
                  TRANSFORM_FUNCTIONS[t.function].argLabels.map((argLabel, argIndex) => (
                    <div className="field" key={argLabel}>
                      <label>{argLabel}</label>
                      <input
                        value={t.args?.[argIndex] ?? ''}
                        onChange={(e) => updateArg(i, argIndex, e.target.value)}
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="section-title">
          Data service
          <HelpTip text="The GCP service Airflow hands this pipeline's actual data movement job to. Dataflow suits streaming/CDC, Dataproc suits heavier Spark-based batch jobs, and Cloud Data Fusion suits simple visual ETL." />
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Runs on</label>
            <select value={dataService} onChange={(e) => onDataServiceChange(e.target.value as DataServiceEngine)}>
              {DATA_SERVICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {selectedDataService && <span className="hint">{selectedDataService.description}</span>}
          </div>
          <div className="field">
            <label>
              Language
              <HelpTip text="Java/Scala on Dataflow or Dataproc handle high throughput and tight SLAs far better than Python, which pays a per-record interpreter cost. Cloud Data Fusion is code-free, so language doesn't apply there." />
            </label>
            <select
              value={language}
              disabled={dataService === 'data_fusion'}
              onChange={(e) => onLanguageChange(e.target.value as PipelineLanguage)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {dataService === 'data_fusion' && <span className="hint">Cloud Data Fusion is visual/code-free — language choice doesn't apply.</span>}
          </div>
          <div className="field full">
            <span className="hint">Delivery pattern: {deliveryPatternLabel(deliveryPattern)} (set on the Source step)</span>
          </div>
        </div>

        <div className="dq-banner pass" style={{ marginTop: 10 }}>
          {recommendation.reasoning} Recommended: {DATA_SERVICE_OPTIONS.find((o) => o.value === recommendation.engine)?.label} + {LANGUAGE_OPTIONS.find((o) => o.value === recommendation.language)?.label}.
        </div>

        {languageConflict && dataService !== 'data_fusion' && (
          <div className="warning-banner" style={{ marginTop: 10 }}>
            {languageConflict}
          </div>
        )}

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-badge cost-${costEstimate.tier}`}>{costEstimate.tier}</span>
          <span className="hint">{costEstimate.reasoning}</span>
        </div>
      </div>
    </div>
  )
}
