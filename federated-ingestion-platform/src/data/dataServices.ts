import type { DataServiceEngine, PipelineConfig } from '../types'

export interface DataServiceOption {
  value: DataServiceEngine
  label: string
  description: string
}

export const DATA_SERVICE_OPTIONS: DataServiceOption[] = [
  {
    value: 'dataflow',
    label: 'Dataflow',
    description: 'Fully managed stream and batch processing (Apache Beam) — the usual fit for CDC/streaming and low-latency incremental loads.',
  },
  {
    value: 'dataproc',
    label: 'Dataproc',
    description: 'Managed Spark/Hadoop clusters — a good fit for heavier batch jobs and large one-off migrations.',
  },
  {
    value: 'data_fusion',
    label: 'Cloud Data Fusion',
    description: 'Visual, code-free ETL/ELT built on CDAP — a good fit for simple, low-volume ingestion.',
  },
]

export function dataServiceLabel(value: DataServiceEngine): string {
  return DATA_SERVICE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

// Naming standard applied everywhere a pipeline's name is shown to a user: prefix it with
// the GCP data service that actually runs it, so "Dataflow", "Dataproc", or "Cloud Data
// Fusion" is visible at a glance without a separate column. Computed here (not stored on the
// pipeline) so it can never drift out of sync if the pipeline's data_service later changes.
export function pipelineDisplayName(pipeline: Pick<PipelineConfig, 'name' | 'pipeline_id' | 'data_service'>): string {
  return `${dataServiceLabel(pipeline.data_service)} - ${pipeline.name || pipeline.pipeline_id}`
}
