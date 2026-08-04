export interface ArchNode {
  code: string
  label: string
  sublabel?: string
  color: string
  detail: string
}

export const LIFECYCLE_NODES: ArchNode[] = [
  {
    code: 'CON',
    label: 'Connect',
    sublabel: 'Runs on: UI + Config API',
    color: 'var(--color-teal)',
    detail:
      'Set up each source and target connection once in the Connections tab — host, credentials, and auth for the system — then pick it by name during the wizard\'s Source and Target steps instead of re-entering details every time. The UI collects the details; the Config API stores and validates them.',
  },
  {
    code: 'TPL',
    label: 'Template',
    sublabel: 'Runs on: UI',
    color: 'var(--color-teal)',
    detail:
      'Pick a prebuilt pipeline template, such as PostgreSQL to GCS or PostgreSQL table to BigQuery table. Each template fixes the required source and target connection types for the next steps, and sets a default GCP data service (Dataflow, Dataproc, or Cloud Data Fusion). Template selection happens entirely in the UI.',
  },
  {
    code: 'MAP',
    label: 'Map',
    sublabel: 'Runs on: UI + Config API',
    color: 'var(--color-teal)',
    detail:
      'Specify the source object and target object, then map columns between them — columns are fetched automatically once schemas exist on both sides, and mismatched types are flagged in amber. File targets (S3, GCS) skip column mapping and ask for a file format and load mode instead. The Config API is what discovers the schemas the UI renders here.',
  },
  {
    code: 'SCH',
    label: 'Schedule',
    sublabel: 'Runs on: UI + Config API',
    color: 'var(--color-teal)',
    detail:
      'Add optional transformations — filter, dedupe, or a per-column function like TRIM, UPPER, or CAST — then set the Airflow schedule as a cron expression plus timezone, and choose which GCP data service (Dataflow, Dataproc, or Cloud Data Fusion) runs the pipeline. The Config API stores this config until it\'s shipped in the Deploy step.',
  },
  {
    code: 'DEP',
    label: 'Deploy',
    sublabel: 'Runs on: UI + Config API + GitHub + Airflow',
    color: 'var(--color-amber)',
    detail:
      'Review the exact pipeline JSON that would be generated, commit it to GitHub as the source of truth for the DAG, and trigger a run. The Config API turns the wizard\'s config into that JSON and commits it to GitHub — committing is what Airflow picks up to schedule or run the pipeline on demand.',
  },
  {
    code: 'MON',
    label: 'Monitor',
    sublabel: 'Runs on: Airflow + Data Services + Config API + UI',
    color: 'var(--color-navy)',
    detail:
      'Track every run\'s status and logs in Job History, and keep an eye on file presence and file-size checks in Data Quality. Airflow orchestrates each run on the GCP Data Service the pipeline is configured to use (Dataflow, Dataproc, or Cloud Data Fusion); the Config API relays that status and log data back to the UI as it happens.',
  },
]
