import type { DataServiceEngine, DeliveryPattern, PipelineLanguage, ThroughputProfile } from '../types'

// Simplified for demo purposes — a real sizing exercise needs load testing against the
// actual source/target, not a static threshold. These numbers exist to make the tradeoff
// tangible in conversation, not to be defensible capacity-planning figures.
export const HIGH_THROUGHPUT_ROWS_PER_SEC = 5000
export const HIGH_THROUGHPUT_GB_PER_HOUR = 50
export const TIGHT_SLA_MINUTES = 15

export function isHighThroughput(profile: ThroughputProfile): boolean {
  if (profile.value === '' || profile.value <= 0) return false
  if (profile.unit === 'rows_per_sec') return profile.value >= HIGH_THROUGHPUT_ROWS_PER_SEC
  return profile.value >= HIGH_THROUGHPUT_GB_PER_HOUR
}

export function hasTightSla(profile: ThroughputProfile): boolean {
  return profile.sla_minutes !== '' && profile.sla_minutes > 0 && profile.sla_minutes <= TIGHT_SLA_MINUTES
}

export interface EngineRecommendation {
  engine: DataServiceEngine
  language: PipelineLanguage
  reasoning: string
}

export function recommendEngineAndLanguage(profile: ThroughputProfile, pattern: DeliveryPattern): EngineRecommendation {
  const highThroughput = isHighThroughput(profile)
  const tightSla = hasTightSla(profile)

  if (pattern === 'streaming' || tightSla) {
    return {
      engine: 'dataflow',
      language: 'java',
      reasoning: tightSla
        ? `A ${profile.sla_minutes}-minute SLA leaves no room for a JVM cold start or a Python per-record interpreter loop at this volume — Dataflow on Java/Scala keeps workers warm and processes in parallel.`
        : 'Streaming delivery means the job runs continuously rather than exiting each tick — Dataflow (Apache Beam) is built for that, and Java/Scala avoid the per-record overhead Python adds at sustained throughput.',
    }
  }

  if (highThroughput) {
    return {
      engine: 'dataproc',
      language: 'scala',
      reasoning:
        profile.unit === 'gb_per_hour'
          ? `${profile.value} GB/hour is squarely batch-Spark territory — Dataproc parallelizes across a cluster, and Scala/Java avoid Python's row-by-row overhead at this volume.`
          : `${profile.value} rows/sec sustained is high enough that a single Python process becomes the bottleneck — Dataproc (Spark) with Scala/Java scales across a cluster instead.`,
    }
  }

  return {
    engine: pattern === 'batch' ? 'data_fusion' : 'dataflow',
    language: 'python',
    reasoning:
      'Below the high-throughput/tight-SLA thresholds, this is comfortably within what a single Python process (or a code-free Data Fusion pipeline) can handle — no need for JVM tooling overhead.',
  }
}

export function explainLanguageConflict(
  selectedLanguage: PipelineLanguage,
  recommended: EngineRecommendation,
  profile: ThroughputProfile,
): string | null {
  if (selectedLanguage === recommended.language) return null
  if (recommended.language === 'python') return null // downgrading from JVM to Python is never flagged as risky

  const reason = hasTightSla(profile)
    ? `the ${profile.sla_minutes}-minute SLA`
    : isHighThroughput(profile)
      ? 'the configured throughput'
      : 'streaming delivery'

  return (
    `This pipeline is set to ${selectedLanguage === 'python' ? 'Python' : selectedLanguage}, but ${reason} points to ${recommended.language}. ` +
    `Python's per-record overhead makes this SLA/throughput hard to hit in practice — and unlike swapping a config value, moving from Python to ${recommended.language} later means rewriting the pipeline logic, since Beam/Spark SDKs aren't portable across languages. ` +
    `Decide the language now, before this goes to production, not after a capacity incident.`
  )
}
