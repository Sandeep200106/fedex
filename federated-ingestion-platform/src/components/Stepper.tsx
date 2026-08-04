export interface StepDef {
  key: string
  title: string
  desc: string
}

interface StepperProps {
  steps: StepDef[]
  activeIndex: number
  maxReachedIndex: number
  onSelect: (index: number) => void
  onInfo?: (stepKey: string) => void
}

export default function Stepper({ steps, activeIndex, maxReachedIndex, onSelect, onInfo }: StepperProps) {
  return (
    <nav className="stepper">
      {steps.map((step, index) => {
        const isActive = index === activeIndex
        const isDone = index < activeIndex
        const isReachable = index <= maxReachedIndex
        return (
          <div
            key={step.key}
            className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${!isReachable ? 'disabled' : ''}`}
            onClick={() => isReachable && onSelect(index)}
          >
            <span className="step-index">{isDone ? '✓' : index + 1}</span>
            <span className="step-label">
              <span className="step-title">{step.title}</span>
              <span className="step-desc">{step.desc}</span>
            </span>
            {onInfo && (
              <button
                type="button"
                className="step-info-btn"
                aria-label={`About the ${step.title} step`}
                onClick={(e) => {
                  e.stopPropagation()
                  onInfo(step.key)
                }}
              >
                i
              </button>
            )}
          </div>
        )
      })}
    </nav>
  )
}
