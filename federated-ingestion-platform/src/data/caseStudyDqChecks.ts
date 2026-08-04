// Sourced from the FedEx ingestion-pattern case studies workbook (6 patterns / 10 flows).
// Each entry is a distinct, concrete DQ check attributed to exactly one owning pattern/flow —
// the same underlying pillar (uniqueness, completeness, validity, ...) recurs across several
// patterns in the source doc, but only the first/most-canonical concrete mechanism is listed
// here so no check is ever duplicated across rows.
export type CaseStudyDqCheckStatus = 'implemented' | 'gap'

export interface CaseStudyDqCheck {
  pattern: string
  flow: string
  check: string
  riskDescription: string
  status: CaseStudyDqCheckStatus
  mechanism: string
}

export const CASE_STUDY_DQ_CHECKS: CaseStudyDqCheck[] = [
  {
    pattern: 'Real-time / near-real-time',
    flow: 'Kafka — network outage data',
    check: 'Duplicate-event dedup on redelivery',
    riskDescription: 'At-least-once delivery re-sends events on ack-timeout/negative-ack, inflating affected-device counts.',
    status: 'implemented',
    mechanism: "'unique' quality rule (per-field dedup, keyed on event/order ID)",
  },
  {
    pattern: 'Real-time / near-real-time',
    flow: 'Pulsar — alarm/telemetry data',
    check: 'Per-key ordering under key_shared subscriptions',
    riskDescription: 'Ordering is only guaranteed per key — cross-key events can arrive out of order.',
    status: 'gap',
    mechanism: 'Yet to implement — would need a sequence/offset-based ordering check.',
  },
  {
    pattern: 'Real-time / near-real-time',
    flow: 'Pulsar — alarm/telemetry data',
    check: 'Consumer-lag / backlog-quota completeness monitor',
    riskDescription: 'A stalled consumer can breach the namespace backlog quota, silently evicting unacknowledged messages.',
    status: 'gap',
    mechanism: 'Yet to implement — would need a streaming-lag/backlog-age threshold alert.',
  },
  {
    pattern: 'Real-time / near-real-time',
    flow: 'Kafka + Pulsar',
    check: 'Producer schema-compatibility gate',
    riskDescription: 'A producer evolving its schema without coordination can silently break the consumer, routing changes to a dead-letter path.',
    status: 'implemented',
    mechanism: 'Schema drift detection (additive vs. breaking-change classification)',
  },
  {
    pattern: 'Batch (RDBMS)',
    flow: 'Teradata → BigQuery migration',
    check: 'Column-level required + format/length validation',
    riskDescription: "Pelican's schema-match check didn't catch missing or malformed values at the column level.",
    status: 'implemented',
    mechanism: "'not_null' + 'regex'/'range' quality rules, metadata-driven per column",
  },
  {
    pattern: 'Batch (RDBMS)',
    flow: 'Teradata → BigQuery migration',
    check: 'Duplicate-row detection from job re-runs',
    riskDescription: 'A re-run job can re-insert the same source data, inflating row counts.',
    status: 'implemented',
    mechanism: "'unique' quality rule — a distinct rule instance from the Kafka flow's, scoped to this table/field",
  },
  {
    pattern: 'Batch (RDBMS)',
    flow: 'Sqoop/Hive-staged',
    check: 'Split-by skew / partition double-load check',
    riskDescription: "An uneven Sqoop split-by column can miss or duplicate rows, and an Oozie retry can double-load a partition if it doesn't check prior partition state.",
    status: 'gap',
    mechanism: 'Yet to implement — would need a partition-state check before retry.',
  },
  {
    pattern: 'Batch (RDBMS)',
    flow: 'Sqoop/Hive-staged',
    check: 'Upstream dependency / concentration-risk monitor',
    riskDescription: 'OMAGOA is a single named server running all Sqoop scripts — if it stalls, every table on this pattern stalls at once.',
    status: 'gap',
    mechanism: 'Operational/infra monitoring, out of scope for column-level rules in this demo.',
  },
  {
    pattern: 'Batch (RDBMS)',
    flow: 'Direct NiFi',
    check: 'High-water-mark late-arrival reconciliation',
    riskDescription: 'A non-monotonic watermark column silently skips backdated/corrected records.',
    status: 'gap',
    mechanism: 'Yet to implement — would need a periodic wide-window reconciliation pull.',
  },
  {
    pattern: 'API (Pull / Push)',
    flow: 'Third-party network performance APIs (Ookla)',
    check: 'Vendor schema-drift detection',
    riskDescription: 'A vendor can add, rename, or renest a JSON field without notice.',
    status: 'implemented',
    mechanism: 'Schema drift detection (same mechanism as the streaming/CDC patterns, applied on landing)',
  },
  {
    pattern: 'API (Pull / Push)',
    flow: 'Third-party network performance APIs (Ookla)',
    check: 'Pulled-record-count vs. API-reported-total completeness gate',
    riskDescription: 'An expiring OAuth token mid-pagination can silently end a pull early — the job still shows green.',
    status: 'gap',
    mechanism: 'Yet to implement — would need a source-vs-landed count comparison before publishing.',
  },
  {
    pattern: 'API (Pull / Push)',
    flow: 'Third-party network performance APIs (Ookla)',
    check: 'JSON structural validity (encoding, precision, timestamp format)',
    riskDescription: 'Non-UTF-8 bytes, float-parsed large integer IDs, and inconsistent timestamp formats can corrupt records without a parse failure.',
    status: 'gap',
    mechanism: 'Yet to implement — would need format-aware parsing validation ahead of the existing column rules.',
  },
  {
    pattern: 'API (Pull / Push)',
    flow: 'Third-party network performance APIs (Ookla)',
    check: 'Rate-limit backoff & retry policy',
    riskDescription: 'Vendor rate limits (HTTP 429) can stall or truncate a pull if retries are naive — an immediate retry just gets rate-limited again, and repeated 429s can look like a stuck job rather than a load problem.',
    status: 'gap',
    mechanism: 'Yet to implement — would need exponential backoff with jitter honoring Retry-After, plus a circuit breaker/alert if backoff duration keeps climbing (a signal the vendor limit itself has tightened, not just a transient spike).',
  },
  {
    pattern: 'Flat Files (SFTP / scheduled drops)',
    flow: 'CSV & Parquet mediation files',
    check: 'Control/trailer count + checksum + sequence-gap detection',
    riskDescription: 'A partner-side rename failure can leave a gap (file N missing) that flow-health monitoring alone never surfaces.',
    status: 'gap',
    mechanism: 'Yet to implement — would need a per-source sequence-number tracker plus received-vs-expected reconciliation.',
  },
  {
    pattern: 'Flat Files (SFTP / scheduled drops)',
    flow: 'CSV & Parquet mediation files',
    check: 'Duplicate-file protection via filename+hash ledger',
    riskDescription: "A re-delivered file can be re-processed whole, distinct from a single duplicate row — file-level, not row-level.",
    status: 'gap',
    mechanism: "Yet to implement — distinct from the row-level 'unique' rule; would need a filename+hash ledger.",
  },
  {
    pattern: 'Flat Files (SFTP / scheduled drops)',
    flow: 'Event-driven Hadoop → GCS (DPF)',
    check: 'Zero-byte / truncated file detection, skip-not-fail',
    riskDescription: 'A 0-byte placeholder file can still fire the arrival trigger and get processed as if it had real content.',
    status: 'implemented',
    mechanism: 'File size check — a landed 0-byte file is already treated as a hard failure independent of the size-deviation threshold',
  },
  {
    pattern: 'Object Storage',
    flow: 'Network Change Management (NCM) data',
    check: 'Hourly expected-vs-received object-count completeness',
    riskDescription: "A silently-failed hourly pull backfills on the next cycle — 'the flow ran green' and 'the data landed' are different guarantees.",
    status: 'gap',
    mechanism: 'Yet to implement — would need a per-cycle expected-vs-received object-count check.',
  },
  {
    pattern: 'Object Storage',
    flow: 'Network Change Management (NCM) data',
    check: 'Volume-trend anomaly vs. real-outage signal',
    riskDescription: 'A usage drop can be a real outage or an upstream data problem — the two look identical from the ingestion layer.',
    status: 'gap',
    mechanism: 'Partial fit: the file-size trailing-average check tracks byte-size trend, not object-count trend — would need an object-count-specific variant.',
  },
  {
    pattern: 'CDC (Change Data Capture)',
    flow: 'Billing / order OLTP replication',
    check: 'Source/target row-count + checksum reconciliation',
    riskDescription: 'Replication-lag metrics only prove the pipe is moving, not that every row landed.',
    status: 'gap',
    mechanism: 'Partially built: row-count reconciliation exists (simulateRowCountReconciliation) but only runs once at deploy time in the wizard, not as a recurring DQ-tab check.',
  },
  {
    pattern: 'CDC (Change Data Capture)',
    flow: 'Billing / order OLTP replication',
    check: 'Hard-delete capture',
    riskDescription: 'Timestamp-based incremental pulls never see a hard delete — only log-based CDC captures it.',
    status: 'gap',
    mechanism: 'Yet to implement — no delete-detection mechanism modeled.',
  },
  {
    pattern: 'CDC (Change Data Capture)',
    flow: 'Billing / order OLTP replication',
    check: 'DDL schema-drift with dead-letter alerting',
    riskDescription: 'A breaking DDL change (e.g. a new NOT NULL column) can silently route every changed row to an unalerted dead-letter queue.',
    status: 'implemented',
    mechanism: 'Schema drift detection — column removal/type changes are already classified as a hard failure, additive changes as a warning',
  },
]
