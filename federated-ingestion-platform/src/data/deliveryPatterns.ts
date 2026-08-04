import type { DeliveryPattern, ExtractionMode } from '../types'

export interface DeliveryPatternOption {
  value: DeliveryPattern
  label: string
  description: string
}

export const DELIVERY_PATTERN_OPTIONS: DeliveryPatternOption[] = [
  {
    value: 'batch',
    label: 'Batch',
    description: 'Runs once per schedule tick and exits — the whole extraction_mode read happens in one bounded execution.',
  },
  {
    value: 'micro_batch',
    label: 'Micro-batch',
    description: 'Runs frequently on a tight schedule (e.g. every 5-15 min) rather than continuously — a middle ground when true streaming infrastructure isn’t justified yet.',
  },
  {
    value: 'streaming',
    label: 'Streaming',
    description: 'Runs continuously, processing events as they arrive rather than waiting for a schedule tick — needed when downstream consumers expect sub-minute latency.',
  },
]

export function deliveryPatternLabel(value: DeliveryPattern): string {
  return DELIVERY_PATTERN_OPTIONS.find((o) => o.value === value)?.label ?? value
}

// full re-reads the whole object each run, so it can never be framed as streaming.
// cdc is a stream of row-level events by construction, so plain batch framing doesn't apply.
export const ALLOWED_DELIVERY_PATTERNS_BY_EXTRACTION_MODE: Record<ExtractionMode, DeliveryPattern[]> = {
  full: ['batch'],
  incremental: ['batch', 'micro_batch'],
  cdc: ['micro_batch', 'streaming'],
}

export function clampDeliveryPattern(pattern: DeliveryPattern, extractionMode: ExtractionMode): DeliveryPattern {
  const allowed = ALLOWED_DELIVERY_PATTERNS_BY_EXTRACTION_MODE[extractionMode]
  return allowed.includes(pattern) ? pattern : allowed[0]
}
