import type { CostTier, DataServiceEngine, DeliveryPattern, Schedule, ThroughputProfile } from '../types'
import { HIGH_THROUGHPUT_GB_PER_HOUR, HIGH_THROUGHPUT_ROWS_PER_SEC, isHighThroughput } from './engineRecommendation'

// Simplified for demo purposes — a real estimate needs actual GCP billing data
// (SKU, region, committed-use discounts), not a weighted guess from pipeline config.
export interface CostEstimate {
  tier: CostTier
  reasoning: string
}

export interface CostEstimateInput {
  data_service: DataServiceEngine
  delivery_pattern: DeliveryPattern
  expected_throughput: ThroughputProfile
  schedule: Schedule
}

function isFrequentSchedule(cronExpression: string): boolean {
  const minuteField = cronExpression.trim().split(/\s+/)[0] ?? ''
  return minuteField === '*' || minuteField.startsWith('*/') || minuteField.includes(',')
}

export function estimateCostTier(pipeline: CostEstimateInput): CostEstimate {
  let weight = 0
  const reasons: { weight: number; text: string }[] = []

  if (pipeline.data_service === 'dataflow') {
    weight += 2
    reasons.push({ weight: 2, text: 'Dataflow workers bill continuously while the job is up' })
  } else if (pipeline.data_service === 'dataproc') {
    weight += 2
    reasons.push({ weight: 2, text: 'Dataproc clusters bill for the cluster lifetime, not just active processing' })
  } else {
    reasons.push({ weight: 1, text: 'Cloud Data Fusion has the lowest baseline cost of the three engines' })
  }

  if (pipeline.delivery_pattern === 'streaming') {
    weight += 3
    reasons.push({ weight: 3, text: 'streaming runs continuously rather than on a schedule, which is usually the single biggest cost driver' })
  } else if (pipeline.delivery_pattern === 'micro_batch') {
    weight += 1
    reasons.push({ weight: 1, text: 'micro-batch runs far more often than a daily/hourly batch job' })
  }

  if (isHighThroughput(pipeline.expected_throughput)) {
    weight += 2
    const unitLabel = pipeline.expected_throughput.unit === 'rows_per_sec' ? `rows/sec (≥ ${HIGH_THROUGHPUT_ROWS_PER_SEC})` : `GB/hour (≥ ${HIGH_THROUGHPUT_GB_PER_HOUR})`
    reasons.push({ weight: 2, text: `throughput of ${pipeline.expected_throughput.value} ${unitLabel} needs more compute capacity` })
  }

  if (isFrequentSchedule(pipeline.schedule.expression)) {
    weight += 1
    reasons.push({ weight: 1, text: `the cron schedule (${pipeline.schedule.expression || 'unset'}) triggers frequently` })
  }

  const tier: CostTier = weight >= 5 ? 'high' : weight >= 2 ? 'medium' : 'low'
  const dominant = reasons.reduce((max, r) => (r.weight > max.weight ? r : max), reasons[0])
  const tierLabel = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low'

  return {
    tier,
    reasoning: `Cost: ${tierLabel} — ${dominant?.text ?? 'no cost-driving factors configured yet'}.`,
  }
}
