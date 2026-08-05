import type { JobRun } from '../types'

const RERUN_SUCCESS_PROBABILITY = 0.75
const DQ_UNFIXED_SUCCESS_PROBABILITY = 0.2
const DQ_FIXED_SUCCESS_PROBABILITY = 0.9

function logTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * No real Airflow API to trigger a clear-and-rerun against in this demo, so this simulates
 * what re-running a failed task would report back. Two different stories, depending on why
 * the original run failed:
 *  - Infra errors (no dq_pattern_key) — a generic transient-condition retry, unrelated to the
 *    DQ framework, at a flat success rate.
 *  - DQ-caused failures (dq_pattern_key set) — success depends on whether that exact pattern
 *    has actually been adopted into the DQ framework (see dqFramework.ts / isPatternAdopted),
 *    so adopting a check for real changes what a rerun of the pipeline it protects reports.
 */
export function simulateRerun(run: JobRun, dqPatternAdopted: boolean): JobRun {
  const isDqCaused = Boolean(run.dq_pattern_key)
  const successProbability = isDqCaused ? (dqPatternAdopted ? DQ_FIXED_SUCCESS_PROBABILITY : DQ_UNFIXED_SUCCESS_PROBABILITY) : RERUN_SUCCESS_PROBABILITY
  const succeeds = Math.random() < successProbability
  const startDate = new Date()
  const durationSeconds = Math.round(20 + Math.random() * 120)
  const endDate = new Date(startDate.getTime() + durationSeconds * 1000)

  const logExcerpt = isDqCaused
    ? succeeds
      ? `[${logTimestamp(endDate)}] INFO - DQ gate passed — the expected file had landed before this run started.\n[${logTimestamp(endDate)}] INFO - Task exited with return code 0`
      : `[${logTimestamp(endDate)}] ERROR - DQ gate failed: expected file still not found at the scheduled path.\n[${logTimestamp(endDate)}] ERROR - Task failed with exception`
    : succeeds
      ? `[${logTimestamp(endDate)}] INFO - Manual re-run succeeded after the prior failure.\n[${logTimestamp(endDate)}] INFO - Task exited with return code 0`
      : `[${logTimestamp(endDate)}] ERROR - Manual re-run hit the same underlying error as the prior run.\n[${logTimestamp(endDate)}] ERROR - Task failed with exception`

  return {
    run_id: `manual__${startDate.toISOString()}`,
    pipeline_id: run.pipeline_id,
    dag_id: run.dag_id,
    state: succeeds ? 'success' : 'failed',
    trigger_type: 'manual',
    execution_date: run.execution_date,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    duration_seconds: durationSeconds,
    log_excerpt: logExcerpt,
    dq_pattern_key: run.dq_pattern_key,
  }
}

export const MOCK_JOB_RUNS: JobRun[] = [
  {
    run_id: 'scheduled__2026-07-10T02:00:00+00:00',
    pipeline_id: 'pl_inventory_full_load',
    dag_id: 'pl_inventory_full_load',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-10T02:00:00Z',
    start_date: '2026-07-10T02:00:02Z',
    end_date: '2026-07-10T02:11:38Z',
    duration_seconds: 696,
    log_excerpt: '[2026-07-10 02:11:35] INFO - Overwrote ANALYTICS.DIM_INVENTORY with 402,118 rows\n[2026-07-10 02:11:38] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-09T02:00:00+00:00',
    pipeline_id: 'pl_inventory_full_load',
    dag_id: 'pl_inventory_full_load',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-09T02:00:00Z',
    start_date: '2026-07-09T02:00:02Z',
    end_date: '2026-07-09T02:10:59Z',
    duration_seconds: 657,
    log_excerpt: '[2026-07-09 02:10:56] INFO - Overwrote ANALYTICS.DIM_INVENTORY with 399,872 rows\n[2026-07-09 02:10:59] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-10T04:00:00+00:00',
    pipeline_id: 'pl_clickstream_cdc',
    dag_id: 'pl_clickstream_cdc',
    state: 'running',
    trigger_type: 'scheduled',
    execution_date: '2026-07-10T04:00:00Z',
    start_date: '2026-07-10T04:00:01Z',
    end_date: null,
    duration_seconds: null,
    log_excerpt: '[2026-07-10 04:00:05] INFO - Consuming from topic clickstream.events, partition 0-11\n[2026-07-10 04:02:10] INFO - Flushed 512,003 records to s3://data-lake/clickstream/dt=2026-07-10/',
  },
  {
    run_id: 'scheduled__2026-07-09T04:00:00+00:00',
    pipeline_id: 'pl_clickstream_cdc',
    dag_id: 'pl_clickstream_cdc',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-09T04:00:00Z',
    start_date: '2026-07-09T04:00:01Z',
    end_date: '2026-07-09T04:58:22Z',
    duration_seconds: 3501,
    log_excerpt: '[2026-07-09 04:58:19] INFO - Flushed final batch, 8,204,110 records total\n[2026-07-09 04:58:22] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-08T04:00:00+00:00',
    pipeline_id: 'pl_clickstream_cdc',
    dag_id: 'pl_clickstream_cdc',
    state: 'up_for_retry',
    trigger_type: 'scheduled',
    execution_date: '2026-07-08T04:00:00Z',
    start_date: '2026-07-08T04:00:01Z',
    end_date: '2026-07-08T04:03:40Z',
    duration_seconds: 219,
    log_excerpt: '[2026-07-08 04:03:37] WARN - Kafka consumer group rebalance timed out, scheduling retry 1/3\n[2026-07-08 04:03:40] INFO - Task instance marked up_for_retry',
  },
  {
    run_id: 'scheduled__2026-07-10T06:30:00+00:00',
    pipeline_id: 'pl_vendor_orders_api',
    dag_id: 'pl_vendor_orders_api',
    state: 'queued',
    trigger_type: 'scheduled',
    execution_date: '2026-07-10T06:30:00Z',
    start_date: '2026-07-10T06:30:00Z',
    end_date: null,
    duration_seconds: null,
    log_excerpt: '[2026-07-10 06:30:00] INFO - Task instance queued, waiting for worker slot',
  },
  {
    run_id: 'scheduled__2026-07-10T05:30:00+00:00',
    pipeline_id: 'pl_vendor_orders_api',
    dag_id: 'pl_vendor_orders_api',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-10T05:30:00Z',
    start_date: '2026-07-10T05:30:02Z',
    end_date: '2026-07-10T05:31:14Z',
    duration_seconds: 72,
    log_excerpt: '[2026-07-10 05:31:11] INFO - Merged 143 records into vendor.orders\n[2026-07-10 05:31:14] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-10T04:30:00+00:00',
    pipeline_id: 'pl_vendor_orders_api',
    dag_id: 'pl_vendor_orders_api',
    state: 'failed',
    trigger_type: 'scheduled',
    execution_date: '2026-07-10T04:30:00Z',
    start_date: '2026-07-10T04:30:02Z',
    end_date: '2026-07-10T04:30:19Z',
    duration_seconds: 17,
    // A genuine DQ-caused failure (the pre-load file-presence gate), not an infra error — this
    // is the same underlying issue as the "Missing file at scheduled time" pattern already
    // shown in Live DQ issues for the Vendor Feed (GCS) source, same file path and everything.
    log_excerpt:
      '[2026-07-10 04:30:17] ERROR - DQ gate failed: expected file not found at gs://my-gcs-bucket/vendor/dt={{ds}}/orders.csv before this run could proceed\n[2026-07-10 04:30:19] ERROR - Task failed with exception',
    dq_pattern_key: 'missing_file',
  },
  {
    // Same pipeline_id and same timestamp as the DQ execution in dataQuality.ts (dqe_17) on
    // purpose — a dedicated, previously-unused pattern to test the adopt-then-rerun loop end
    // to end without any pre-existing state from earlier testing getting in the way.
    run_id: 'scheduled__2026-07-13T02:15:00+00:00',
    pipeline_id: 'pl_billing_orders_cdc_bigquery',
    dag_id: 'pl_billing_orders_cdc_bigquery',
    state: 'failed',
    trigger_type: 'scheduled',
    execution_date: '2026-07-13T02:15:00Z',
    start_date: '2026-07-13T02:15:03Z',
    end_date: '2026-07-13T02:15:21Z',
    duration_seconds: 18,
    log_excerpt:
      "[2026-07-13 02:15:19] ERROR - DQ gate failed: source column 'legacy_status' was dropped, breaking the CDC schema map\n[2026-07-13 02:15:21] ERROR - Task failed with exception",
    dq_pattern_key: 'schema_drift',
  },
  {
    run_id: 'scheduled__2026-07-12T02:15:00+00:00',
    pipeline_id: 'pl_billing_orders_cdc_bigquery',
    dag_id: 'pl_billing_orders_cdc_bigquery',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-12T02:15:00Z',
    start_date: '2026-07-12T02:15:02Z',
    end_date: '2026-07-12T02:16:47Z',
    duration_seconds: 105,
    log_excerpt: '[2026-07-12 02:16:44] INFO - Replicated 2,318 change events into billing.billing_orders\n[2026-07-12 02:16:47] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-09T05:30:00+00:00',
    pipeline_id: 'pl_vendor_orders_api',
    dag_id: 'pl_vendor_orders_api',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-09T05:30:00Z',
    start_date: '2026-07-09T05:30:02Z',
    end_date: '2026-07-09T05:31:09Z',
    duration_seconds: 67,
    log_excerpt: '[2026-07-09 05:31:06] INFO - Merged 98 records into vendor.orders\n[2026-07-09 05:31:09] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-08T02:00:00+00:00',
    pipeline_id: 'pl_inventory_full_load',
    dag_id: 'pl_inventory_full_load',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-08T02:00:00Z',
    start_date: '2026-07-08T02:00:02Z',
    end_date: '2026-07-08T02:11:20Z',
    duration_seconds: 678,
    log_excerpt: '[2026-07-08 02:11:17] INFO - Overwrote ANALYTICS.DIM_INVENTORY with 398,410 rows\n[2026-07-08 02:11:20] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-07T02:00:00+00:00',
    pipeline_id: 'pl_inventory_full_load',
    dag_id: 'pl_inventory_full_load',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-07T02:00:00Z',
    start_date: '2026-07-07T02:00:02Z',
    end_date: '2026-07-07T02:10:41Z',
    duration_seconds: 639,
    log_excerpt: '[2026-07-07 02:10:38] INFO - Overwrote ANALYTICS.DIM_INVENTORY with 397,055 rows\n[2026-07-07 02:10:41] INFO - Task exited with return code 0',
  },
  {
    run_id: 'scheduled__2026-07-07T04:00:00+00:00',
    pipeline_id: 'pl_clickstream_cdc',
    dag_id: 'pl_clickstream_cdc',
    state: 'success',
    trigger_type: 'scheduled',
    execution_date: '2026-07-07T04:00:00Z',
    start_date: '2026-07-07T04:00:01Z',
    end_date: '2026-07-07T04:52:38Z',
    duration_seconds: 3157,
    log_excerpt: '[2026-07-07 04:52:35] INFO - Flushed final batch, 7,611,542 records total\n[2026-07-07 04:52:38] INFO - Task exited with return code 0',
  },
]
