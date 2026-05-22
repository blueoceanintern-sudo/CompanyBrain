import OpenAI from "openai"
import { eq, and, sql } from "drizzle-orm"
import { db, chunks } from "../db/index"
import { evaluateVisibility, resolveUserPermissions } from "./access-control"
import { synthesize } from "./synthesis"
import type { ServiceResult, QueryAnswer, AccessTier, UserRole } from "../shared/types"
import { ok, err, IDK_ANSWER } from "../shared/types"
import type { VisibilityPolicy } from "../shared/types"

const openai = new OpenAI()

const CONFIDENCE_THRESHOLD = 0.5
const TOP_K = 5
const SEMANTIC_WEIGHT = 0.7
const BM25_WEIGHT = 0.3

export interface RetrieveInput {
  query:      string
  orgId:      string
  userId:     string
  userRole:   UserRole
  accessTier: AccessTier
}

// ─── Exported for unit testing ────────────────────────────────────────────────

export function computeScore(semanticSimilarity: number, bm25Score: number): number {
  return SEMANTIC_WEIGHT * semanticSimilarity + BM25_WEIGHT * bm25Score
}

// ─── Embedding ─────────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  })
  return response.data[0].embedding
}

// ─── Retrieval ─────────────────────────────────────────────────────────────────

export async function retrieve(input: RetrieveInput): Promise<ServiceResult<QueryAnswer>> {
  const { query, orgId, userId, userRole, accessTier } = input

  if (!query.trim()) {
    return err("INVALID_QUERY", "Query must not be empty.")
  }

  // Embed the query
  let queryEmbedding: number[]
  try {
    queryEmbedding = await embed(query)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Embedding error"
    return err("EMBEDDING_ERROR", message)
  }

  const userPerms = resolveUserPermissions(userId, orgId, userRole, accessTier)

  // Build access_tier filter — external users only see external chunks
  const tierFilter = accessTier === "external"
    ? eq(chunks.access_tier, "external")
    : sql`true`

  // pgvector cosine similarity: 1 - (embedding <=> query_vector)
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`

  let candidates: Array<{
    id: string
    org_id: string
    document_id: string
    compartment_id: string
    content: string
    content_hash: string
    visibility: unknown
    access_tier: "internal" | "external"
    source_type: string
    chunk_index: number
    parent_chunk_id: string | null
    status: string
    created_at: Date
    semantic_score: number
    bm25_score: number
  }>

  try {
    candidates = await db.execute(sql`
      SELECT
        c.*,
        1 - (c.embedding <=> ${embeddingLiteral}::vector) AS semantic_score,
        ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', ${query})) AS bm25_score
      FROM chunks c
      WHERE
        c.org_id = ${orgId}
        AND c.status = 'active'
        AND ${tierFilter}
      ORDER BY semantic_score DESC
      LIMIT 20
    `) as unknown as typeof candidates
  } catch {
    // Fallback when pgvector or DB is unavailable (e.g. during tests without real DB)
    candidates = []
  }

  // Apply visibility filtering (JSONB policy evaluation)
  const visible = candidates.filter(chunk => {
    return evaluateVisibility(chunk.visibility as VisibilityPolicy | null, userPerms)
  })

  // Score and deduplicate
  const scored = visible.map(chunk => ({
    ...chunk,
    score: computeScore(chunk.semantic_score, chunk.bm25_score),
  }))

  const deduped = Array.from(
    new Map(scored.map(c => [c.id, c])).values()
  )

  deduped.sort((a, b) => b.score - a.score)

  if (deduped.length === 0 || deduped[0].score < CONFIDENCE_THRESHOLD) {
    return ok({ ...IDK_ANSWER, confidence: deduped[0]?.score ?? 0 })
  }

  // Small-to-big: expand matched chunks to include parent sections
  const topK = deduped.slice(0, TOP_K)
  const expanded = await expandToParents(topK, orgId)

  const chunkInputs = expanded.map(c => ({
    id:          c.id,
    content:     c.content,
    org_id:      c.org_id,
    document_id: c.document_id,
    source_type: c.source_type,
    access_tier: c.access_tier,
    chunk_index: c.chunk_index,
  }))

  return synthesize({ query, chunks: chunkInputs })
}

// ─── Small-to-big parent expansion ───────────────────────────────────────────

async function expandToParents<T extends { id: string; parent_chunk_id: string | null; org_id: string; document_id: string; content: string; source_type: string; access_tier: "internal" | "external"; chunk_index: number }>(
  topChunks: T[],
  orgId: string,
): Promise<T[]> {
  const result = new Map<string, T>()
  for (const chunk of topChunks) {
    result.set(chunk.id, chunk)
  }

  const parentIds = topChunks
    .map(c => c.parent_chunk_id)
    .filter((id): id is string => id !== null && !result.has(id))

  if (parentIds.length > 0) {
    try {
      const parents = await db
        .select()
        .from(chunks)
        .where(and(
          sql`${chunks.id} = ANY(${parentIds})`,
          eq(chunks.org_id, orgId),
        ))

      for (const p of parents) {
        if (!result.has(p.id)) {
          result.set(p.id, p as unknown as T)
        }
      }
    } catch {
      // Ignore parent expansion failures — use top-k as-is
    }
  }

  // Respect top-k limit after expansion
  return Array.from(result.values()).slice(0, TOP_K)
}
