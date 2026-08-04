interface AccordionToggleProps {
  label: string
  expanded: boolean
  onToggle: () => void
}

export default function AccordionToggle({ label, expanded, onToggle }: AccordionToggleProps) {
  return (
    <button type="button" className="accordion-toggle" onClick={onToggle} aria-expanded={expanded}>
      <span className={`accordion-arrow${expanded ? ' open' : ''}`}>▸</span>
      {label}
    </button>
  )
}
