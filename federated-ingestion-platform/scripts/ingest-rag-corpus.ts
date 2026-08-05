// One-off (re-runnable) data loader — pushes RAG_CORPUS into the Pinecone index used by the
// Assistant chat widget. Run this after editing src/rag/corpus.ts so the index stays in sync;
// nothing in the running app calls this automatically.
//
// Usage: PINECONE_API_KEY=... PINECONE_INDEX_HOST=... npx tsx scripts/ingest-rag-corpus.ts
import { RAG_CORPUS } from '../src/rag/corpus'

const apiKey = process.env.PINECONE_API_KEY
const indexHost = process.env.PINECONE_INDEX_HOST
const namespace = process.env.PINECONE_NAMESPACE || 'rag-docs'

if (!apiKey || !indexHost) {
  console.error('Set PINECONE_API_KEY and PINECONE_INDEX_HOST env vars before running this script.')
  process.exit(1)
}

async function main() {
  // Purge the namespace first — otherwise a chunk removed/renamed in corpus.ts since the last
  // run (e.g. the old per-transform-function/per-connection-type chunks) would linger in the
  // index forever as an orphaned, never-updated vector instead of actually going away.
  const deleteResponse = await fetch(`https://${indexHost}/vectors/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': apiKey!,
      'X-Pinecone-Api-Version': '2025-04',
    },
    body: JSON.stringify({ deleteAll: true, namespace }),
  })
  if (!deleteResponse.ok) {
    const body = await deleteResponse.text()
    const namespaceMissing = deleteResponse.status === 404 && /namespace not found/i.test(body)
    if (!namespaceMissing) {
      throw new Error(`Delete-all failed: ${deleteResponse.status} ${deleteResponse.statusText}\n${body}`)
    }
    // Nothing to delete — Pinecone drops a namespace entirely once it's emptied out.
  }

  const ndjson = RAG_CORPUS.map((chunk) => JSON.stringify({ _id: chunk.id, title: chunk.title, text: chunk.text })).join('\n')

  const response = await fetch(`https://${indexHost}/records/namespaces/${namespace}/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Api-Key': apiKey!,
      'X-Pinecone-Api-Version': '2025-04',
    },
    body: ndjson,
  })

  if (!response.ok) {
    throw new Error(`Upsert failed: ${response.status} ${response.statusText}\n${await response.text()}`)
  }

  console.log(`Upserted ${RAG_CORPUS.length} chunks into ${indexHost} (namespace "${namespace}").`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
