import type { RagChunk } from './vectorStore'

export interface PineconeSettings {
  apiKey: string
  indexHost: string
  namespace: string
}

/**
 * Same trade-off as the LLM key in llmClient.ts: called directly from the browser with a
 * pre-configured key baked in at build time (VITE_* vars), which is fine for this internal
 * demo but would need to move behind a real backend before this app saw untrusted traffic.
 */
export function getPineconeSettings(): PineconeSettings {
  return {
    apiKey: import.meta.env.VITE_PINECONE_API_KEY ?? '',
    indexHost: import.meta.env.VITE_PINECONE_INDEX_HOST ?? '',
    namespace: import.meta.env.VITE_PINECONE_NAMESPACE || 'rag-docs',
  }
}

export function isPineconeConfigured(settings: PineconeSettings): boolean {
  return Boolean(settings.apiKey.trim() && settings.indexHost.trim())
}

interface PineconeSearchHit {
  _id: string
  _score: number
  fields: { title?: string; text?: string }
}

interface PineconeSearchResponse {
  result?: { hits?: PineconeSearchHit[] }
}

/**
 * Queries the Pinecone index's integrated-embedding search endpoint — Pinecone embeds the
 * query text server-side (same "llama-text-embed-v2" model the corpus was upserted with via
 * scripts/ingest-rag-corpus.ts), so this sends raw text, not a vector, and gets semantically
 * ranked chunks back.
 */
export async function pineconeSearch(settings: PineconeSettings, query: string, topK = 3): Promise<RagChunk[]> {
  const response = await fetch(`https://${settings.indexHost}/records/namespaces/${settings.namespace}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': settings.apiKey,
      'X-Pinecone-Api-Version': '2025-04',
    },
    body: JSON.stringify({ query: { inputs: { text: query }, top_k: topK } }),
  })

  if (!response.ok) {
    throw new Error(`Pinecone search failed: ${response.status} ${response.statusText}`)
  }

  const data: PineconeSearchResponse = await response.json()
  const hits = data.result?.hits ?? []
  return hits.map((h) => ({
    id: h._id,
    title: h.fields.title ?? h._id,
    text: h.fields.text ?? '',
  }))
}
