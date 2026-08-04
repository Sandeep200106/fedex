import type { RagChunk } from './vectorStore'
import { TRANSFORM_FUNCTIONS } from '../data/transformFunctions'
import { CONNECTION_FIELD_CONFIG, CONNECTION_TYPES } from '../data/templates'

const STATIC_CHUNKS: RagChunk[] = [
  {
    id: 'product-overview',
    title: 'What is Pipeline Builder',
    text: 'Pipeline Builder is a self-service data pipeline platform built for Prodapt\'s data engineering teams. It turns the usual multi-day process of standing up a new pipeline — picking a connector, writing connection JSON by hand, wiring up an Airflow DAG, and hoping the schema matches — into a guided wizard. The Home tab has an "About the product" section describing the main capabilities: the template-driven wizard, reusable connections managed in their own tab, automatic schema discovery, data quality monitoring, the AI assistant with failure analysis, and the mock GitHub-to-Airflow deploy flow.',
  },
  {
    id: 'architecture',
    title: 'How the platform fits together',
    text: 'The platform is a chain: Pipeline Builder UI, then Config API, then GitHub, then Airflow, then Data Services. "Data Services" is not one system — it refers to whichever GCP service actually executes the pipeline\'s data movement job: Dataflow, Dataproc, or Cloud Data Fusion. You build a pipeline in the UI and generate its JSON files: one connection file for the source, one connection file for the target, and one pipeline config file (which includes which of the three GCP data services it runs on). The Config API commits those files to a GitHub repository. Airflow watches that repository, schedules a DAG per pipeline, and hands the actual job off to the chosen GCP data service. Airflow reports run status and logs back up the chain, which is what the Job History tab shows. Everything in this UI today is a mock — there is no backend yet, so commit and run actions simulate what would happen.',
  },
  {
    id: 'data-services',
    title: 'Data Services: Dataflow, Dataproc, and Cloud Data Fusion',
    text: 'Data Services is the last stage of the pipeline chain, and it is a choice between three GCP services, picked per pipeline on the Details step (labeled "Data service — Runs on"): Dataflow is fully managed stream and batch processing (Apache Beam), the usual fit for CDC/streaming and low-latency incremental loads; Dataproc is managed Spark/Hadoop clusters, a good fit for heavier batch jobs and large one-off migrations; Cloud Data Fusion is visual, code-free ETL/ELT built on CDAP, a good fit for simple, low-volume ingestion. Each pipeline template comes with a sensible default (for example, the Kafka CDC template defaults to Dataflow, the S3 migration template defaults to Dataproc, and the REST API template defaults to Cloud Data Fusion), but the choice can be changed for any individual pipeline on the Details step.',
  },
  {
    id: 'wizard-template',
    title: 'Wizard step: Template',
    text: 'The Template step is where you pick a prebuilt pipeline template such as PostgreSQL to GCS, MySQL to GCS, Oracle to GCS, SQL Server to GCS, S3 to GCS, Kafka to GCS, REST API to GCS, or PostgreSQL table to BigQuery table. Each template fixes both the required source connection type and the required target connection type for the next two steps, and sets a default GCP data service (Dataflow, Dataproc, or Cloud Data Fusion) shown as a badge on the template card — go back to this step to switch templates if you need a different type.',
  },
  {
    id: 'connections-tab',
    title: 'Connections tab',
    text: 'The Connections tab is where connection details are entered once and reused, instead of typing them into every pipeline. It has a list of saved connections on the left and a form on the right to add a new one or edit an existing one. Each connection has a name, connection ID, type, environment, credentials (auth method plus a secret reference — never a raw secret), owner, and tags. The exact fields shown depend on the connection type: a relational database (PostgreSQL, MySQL, Oracle, SQL Server) asks for host, port, and database name (Oracle asks for a service name or SID instead of a plain database name); BigQuery asks for a project ID and a dataset instead of host/port; a file store like Amazon S3 or Google Cloud Storage asks for a bucket name and an optional prefix/path instead of host and port; Kafka asks for a broker list and a topic; REST API asks for a base URL and an optional resource path. Connections saved here persist in the browser and are available the next time the app is opened.',
  },
  {
    id: 'wizard-connection-picker',
    title: 'Wizard step: Source and Target connection picker',
    text: 'The Source and Target steps in the pipeline wizard do not ask you to fill in connection details directly — they show a picker limited to saved connections of the type the chosen template requires (for example, an Oracle template only lists saved Oracle connections). If no connection of that type exists yet, the picker shows a button to add one, which jumps to the Connections tab with that type pre-selected. Once a connection is picked, a read-only summary (host or bucket, owner, auth) is shown for confidence before moving on.',
  },
  {
    id: 'wizard-mapping',
    title: 'Wizard step: Mapping',
    text: 'The Mapping step is where you specify the source object (a table, a topic, or a file path pattern) and the target object, then map columns from source to target. Column lists are fetched automatically once you type an object name — this simulates schema introspection against the real source or target. For file targets (S3, GCS) there is no pre-existing schema, so you choose a file format (Parquet, CSV, JSON, Avro, or ORC) and a Load mode, and the column mapping section is skipped entirely — there is nothing to map columns onto for a raw file dump. Database and warehouse targets (PostgreSQL, MySQL, Oracle, SQL Server, BigQuery) also show a Load mode, and additionally show the column mapping section since they have addressable columns. Load mode options are insert, update & merge, or truncate & insert regardless of target type.',
  },
  {
    id: 'wizard-mapping-dnd',
    title: 'Drag-and-drop column mapping and type mismatch warnings',
    text: 'When both the source and target have a real, introspectable schema (for example the PostgreSQL to BigQuery template), the Mapping step replaces the plain column-mapping table with two side-by-side panels: source columns on the left as draggable pills showing name and type, target columns on the right as drop targets showing their own name and type. Drag a source column pill onto a target column to map it, or use the small dropdown on an unmapped target row as a non-drag alternative. Once mapped, the target row shows which source column feeds it. If the source and target column types are not compatible (comparing normalized categories, so PostgreSQL "decimal(12,2)" and BigQuery "NUMERIC" are treated as the same category and do not warn, but a genuine mismatch like text mapped onto a numeric column does), the row is flagged in amber with a type-mismatch warning — this is meant to catch schema incompatibilities before the pipeline ships, not to block the mapping outright. For targets with no fixed schema yet (file targets like S3/GCS), there is no column mapping section at all — the Mapping step only asks for the file format and load mode, and the wizard moves straight to Details once those are filled in.',
  },
  {
    id: 'wizard-mapping-automap',
    title: 'Auto-map with AI',
    text: 'Above the drag-and-drop column mapping panels there is an "Auto-map with AI" button. Clicking it sends the source and target column names and types to the configured LLM and asks it to propose mappings based on column name similarity (type is a secondary signal). The AI is told to only return pairs it is reasonably confident about and to leave the rest unmapped rather than guess. If no LLM is configured, or the call fails, it falls back to a simple built-in matcher that pairs columns with the same name (ignoring case and punctuation) — for example "id" to "id" or "created_at" to "created_at" — and leaves anything less obvious for the human to map. Either way, auto-mapping only fills in target columns that are not already mapped — it will not overwrite a mapping you made by hand — and every AI-suggested mapping is still shown in the same editable panels afterward, including type-mismatch warnings, so a person reviews and can correct anything before moving on.',
  },
  {
    id: 'wizard-extraction-mode',
    title: 'Extraction modes explained',
    text: 'Extraction mode controls how data is pulled from the source. Full re-reads the entire source every run. Incremental uses a cursor column (usually an updated_at timestamp or an incrementing ID) to pull only new or changed rows since the last run. CDC (change data capture) streams row-level insert/update/delete events, typically from a database transaction log or a Kafka topic.',
  },
  {
    id: 'wizard-load-mode',
    title: 'Load modes explained',
    text: 'Load mode controls how data lands in the target. Insert adds new rows without touching existing ones. Update & merge upserts by key — it updates rows that already exist and inserts the rest. Truncate & insert clears the entire target and reloads it fresh on every run. All target types, including file targets like S3 or GCS, show a Load mode — for a file target it controls whether each run adds new objects (insert), reconciles by key (update & merge), or clears and rewrites the destination prefix (truncate & insert).',
  },
  {
    id: 'wizard-details',
    title: 'Wizard step: Details (transformations, schedule, and data service)',
    text: 'The Details step names the pipeline and lets you add transformations. A filter transformation drops rows that do not match a condition. A dedupe transformation removes duplicate rows by one or more key columns. A transform transformation applies a function (TRIM, UPPER, LOWER, ROUND, CAST, RENAME, REPLACE, or COALESCE) to a specific column. This step also sets the Airflow schedule as a cron expression plus a timezone, for example "0 3 * * *" in Asia/Kolkata means every day at 3 AM, and a "Data service — Runs on" dropdown to pick which GCP service (Dataflow, Dataproc, or Cloud Data Fusion) actually executes the pipeline, pre-filled from the template but changeable per pipeline.',
  },
  {
    id: 'wizard-review',
    title: 'Wizard step: Review and generate',
    text: 'The Review step shows the exact JSON that would be generated for the source connection, the target connection, and the pipeline config. You can download the files individually or all at once. The Deploy section simulates the rest of the chain: Commit to GitHub fakes a commit (a random short SHA after a brief delay), and Run pipeline (dummy execution) is only enabled after committing — it adds a run to the Job History tab as Running, then flips it to Success a few seconds later. No real source or target is touched by either action.',
  },
  {
    id: 'job-history',
    title: 'Job History tab',
    text: 'The Job History tab lists pipeline runs across all pipelines, with filters for pipeline and status. Each run shows its status (success, failed, running, queued, or up_for_retry), trigger type (scheduled or manual), start time, and duration. Clicking View logs expands a log excerpt inline. For failed runs there is an Analyze with AI button that sends the log excerpt to an LLM (or a built-in mock analyzer if no API is configured) to explain the exact issue and give resolution steps in plain language, aimed at non-technical users.',
  },
  {
    id: 'dq-overview',
    title: 'Data Quality tab overview',
    text: 'The Data Quality tab applies to pipelines that read or write files (GCS targets), where a simple row count check is not available. Two checks exist: file presence, which confirms the expected file exists at all, and file size check, which compares today\'s file size to the average size over a lookback window (7 days by default) and flags a warning if the deviation exceeds a configurable threshold percentage. Each pipeline also has its own schedule (cron expression plus timezone) for when the checks run, and a Run check now button to trigger an immediate check outside the schedule. Execution history shows every past run of the checks with its status and message.',
  },
  {
    id: 'dq-onboarding',
    title: 'Onboarding a new file to monitor',
    text: 'To start monitoring a file that is not already in the list, click "+ Onboard new file" on the Data Quality tab. This opens editable Pipeline name and File path fields plus the same File presence check, File size check, and Schedule settings used for existing pipelines — fill them in and click Save rule to add it to the Pipeline dropdown. A newly onboarded file has no history yet, so its status shows as Pending ("Not checked yet") instead of pass/warning/fail, and the size trend chart and size history table are empty. Clicking Run check now on a pending pipeline simulates the very first inspection (there is no real backend yet, so a plausible file existence and size are generated) and records it as the first history entry and execution; from that point on it behaves like any other monitored pipeline.',
  },
  {
    id: 'dq-file-presence',
    title: 'File presence check',
    text: 'The file presence check fails immediately if the expected file for today is not found at the configured path. This catches upstream jobs that silently did not produce output at all, which a size comparison alone would miss.',
  },
  {
    id: 'dq-file-size',
    title: 'File size check and the 7-day average',
    text: 'The file size check computes the average file size over the lookback window (excluding today), then compares today\'s size against that average. If the absolute percentage deviation is greater than the configured threshold, the check is flagged as a warning — this often means an upstream job under-produced or over-produced data. The chart on the Data Quality tab plots the last several days as bars: prior days in a neutral color, today colored by its result (green for pass, amber for warning, red for fail), with a dashed line marking the average.',
  },
  {
    id: 'assistant-overview',
    title: 'Assistant chat widget',
    text: 'The Assistant is a chat widget in the bottom-right corner of every tab, not a separate tab of its own — click the round chat bubble to open it. It is a retrieval-augmented (RAG) chatbot: your question is matched against a local, in-browser search index built from this documentation (a local TF-IDF vector store, not an external service like Pinecone), the most relevant chunks are retrieved, and those chunks are sent to a language model along with your question to produce an answer. The assistant is pre-configured — there is nothing to set up in the UI, you just ask a question. If the language model call cannot complete for any reason, the assistant falls back to showing the retrieved documentation directly instead of a generated answer.',
  },
  {
    id: 'faq-type-locked',
    title: 'FAQ: Why does the Source/Target step only show some of my connections?',
    text: 'Once you pick a template, the source and target types are fully determined by that template (for example, "Oracle to GCS" means source type Oracle and target type Google Cloud Storage). The Source and Target steps only list saved connections that match the type the template requires — that is why a connection you saved does not show up if it is the wrong type for the current template. Go back to the Template step and pick a different template, or add a matching connection in the Connections tab.',
  },
  {
    id: 'faq-security',
    title: 'FAQ: How does the Assistant\'s language model access work, and is it safe?',
    text: 'The Assistant calls a language model API directly from the browser using a pre-configured key — there is no settings screen and nothing to type in. This keeps the UI simple, but it is a UI-only demo with no backend, so the key is bundled into the app and visible to anyone inspecting this browser session. That is acceptable for an internal/local demo but is not a safe pattern once this app is deployed anywhere less trusted — at that point the call should move behind a real backend so the key is never sent to the browser at all.',
  },
]

function buildTransformFunctionChunks(): RagChunk[] {
  return Object.entries(TRANSFORM_FUNCTIONS).map(([fn, spec]) => ({
    id: `transform-fn-${fn}`,
    title: `Transform function: ${fn}`,
    text: `${spec.label}. Used as a "transform" type transformation applied to one column.${spec.argLabels.length ? ` It takes these parameters: ${spec.argLabels.join(', ')}.` : ' It takes no extra parameters.'}`,
  }))
}

function buildConnectionTypeChunks(): RagChunk[] {
  return CONNECTION_TYPES.map(({ value, label }) => {
    const fields = CONNECTION_FIELD_CONFIG[value]
    const parts: string[] = []
    if (fields.host.show) parts.push(`${fields.host.label}${fields.host.required ? '' : ' (optional)'}`)
    if (fields.port.show) parts.push(`Port${fields.port.required ? '' : ' (optional)'}`)
    if (fields.database.show) parts.push(`${fields.database.label}${fields.database.required ? '' : ' (optional)'}`)
    return {
      id: `connection-type-${value}`,
      title: `Connection type: ${label}`,
      text: `A ${label} connection asks for: ${parts.join(', ')}, plus owner, auth method, secret reference, and tags.`,
    }
  })
}

export const RAG_CORPUS: RagChunk[] = [...STATIC_CHUNKS, ...buildTransformFunctionChunks(), ...buildConnectionTypeChunks()]
