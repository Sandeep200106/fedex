export interface RagChunk {
  id: string
  title: string
  text: string
}

export interface RagSearchResult {
  chunk: RagChunk
  score: number
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'at', 'by', 'from',
  'into', 'about', 'each', 'you', 'your', 'i', 'we', 'they', 'their', 'do', 'does', 'did', 'not', 'no', 'can',
  'will', 'would', 'should', 'could', 'has', 'have', 'had', 'what', 'which', 'who', 'when', 'where', 'how',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_./-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }
  return tf
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const value of a.values()) normA += value * value
  for (const value of b.values()) normB += value * value
  const smaller = a.size < b.size ? a : b
  const larger = a.size < b.size ? b : a
  for (const [term, value] of smaller) {
    const other = larger.get(term)
    if (other) dot += value * other
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * A small local TF-IDF vector store — no external embedding API required.
 * Good enough for retrieving the right doc chunk out of a few dozen; not a
 * substitute for a real embedding model once one is wired in.
 */
export class LocalVectorStore {
  private chunks: RagChunk[]
  private vectors: Map<string, number>[]
  private idf: Map<string, number>

  constructor(chunks: RagChunk[]) {
    this.chunks = chunks
    const tfPerChunk = chunks.map((c) => termFrequency(tokenize(`${c.title} ${c.text}`)))
    this.idf = LocalVectorStore.buildIdf(tfPerChunk)
    this.vectors = tfPerChunk.map((tf) => LocalVectorStore.weight(tf, this.idf))
  }

  private static buildIdf(tfPerDoc: Map<string, number>[]): Map<string, number> {
    const docCount = tfPerDoc.length
    const containing = new Map<string, number>()
    for (const tf of tfPerDoc) {
      for (const term of tf.keys()) {
        containing.set(term, (containing.get(term) ?? 0) + 1)
      }
    }
    const idf = new Map<string, number>()
    for (const [term, count] of containing) {
      idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1)
    }
    return idf
  }

  private static weight(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
    const weighted = new Map<string, number>()
    for (const [term, freq] of tf) {
      weighted.set(term, freq * (idf.get(term) ?? 1))
    }
    return weighted
  }

  search(query: string, topK = 3): RagSearchResult[] {
    const queryTf = termFrequency(tokenize(query))
    const queryVector = LocalVectorStore.weight(queryTf, this.idf)
    const scored = this.chunks.map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryVector, this.vectors[i]),
    }))
    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}
