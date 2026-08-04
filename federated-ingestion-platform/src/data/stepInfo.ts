import type { ArchNode } from './archNodes'

export const STEP_INFO: Record<string, ArchNode> = {
  template: {
    code: '1',
    label: 'Template',
    color: 'var(--color-teal)',
    detail:
      'Pick a prebuilt pipeline template, such as PostgreSQL to GCS or PostgreSQL table to BigQuery table. Each template fixes the required source and target connection types for the next two steps, and sets a default GCP data service (Dataflow, Dataproc, or Cloud Data Fusion) shown as a badge on the card — come back here to switch templates if you need a different source/target combination.',
  },
  source: {
    code: '2',
    label: 'Source',
    color: 'var(--color-teal)',
    detail:
      'Choose the saved connection this pipeline reads from. Only connections matching the type the template requires are listed — if none exist yet, a button jumps to the Connections tab with that type pre-selected. Once picked, a read-only summary (host or bucket, owner, auth) is shown for confidence before moving on.',
  },
  target: {
    code: '3',
    label: 'Target',
    color: 'var(--color-teal)',
    detail:
      'Choose the saved connection this pipeline writes to, same picker behavior as the Source step but filtered to the target type the template requires.',
  },
  mapping: {
    code: '4',
    label: 'Mapping',
    color: 'var(--color-teal)',
    detail:
      'Specify the source object (table, topic, or file path pattern) and the target object, then map columns from source to target. Columns are fetched automatically once schemas exist on both sides — drag a source column pill onto a target column, and mismatched types are flagged in amber. File targets (S3, GCS) skip column mapping entirely and instead ask for a file format and load mode.',
  },
  details: {
    code: '5',
    label: 'Details',
    color: 'var(--color-teal)',
    detail:
      'Name the pipeline and add optional transformations — filter, dedupe, or a per-column transform function (TRIM, UPPER, CAST, and so on). Also sets which GCP data service (Dataflow, Dataproc, or Cloud Data Fusion) actually runs the pipeline.',
  },
  review: {
    code: '6',
    label: 'Review',
    color: 'var(--color-amber)',
    detail:
      'Shows the exact JSON that would be generated for the source connection, target connection, and pipeline config, downloadable individually or all at once. Commit to GitHub simulates a commit, and Run pipeline (only enabled after committing) adds a mock run to Job History that flips from Running to Success a few seconds later.',
  },
}
