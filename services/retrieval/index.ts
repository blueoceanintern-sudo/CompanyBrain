import OpenAI from 'openai'
import { db } from '@company-brain/db'
import { chunks, documents, compartments } from '@company-brain/db'
import { eq, and, sql, type SQL } from 'drizzle-orm'
import type { RetrieveParams, ServiceResult, ChunkContext, SourceType, UserRole } from '@company-brain/shared'
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  CONFIDENCE_GATE_THRESHOLD,
  RRF_K,
  TOP_K_CHUNKS,
} from '@company-brain/shared'
import { canAccessChunk } from '@company-brain/access-control'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
}

function friendlyServiceError(raw: string): string {
  if (raw.includes('401') || /api.?key|authentication|unauthorized/i.test(raw))
    return 'The knowledge base search is not configured. Please contact your administrator.'
  if (raw.includes('429') || /rate.?limit/i.test(raw))
    return 'Too many requests. Please wait a moment and try again.'
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(raw))
    return 'Search timed out. Please try again.'
  return 'Search is temporarily unavailable. Please try again.'
}

// ─── Embed a single query ─────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data[0]?.embedding ?? []
}

function parseVisibility(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return (raw as Record<string, unknown>) ?? {}
}

// ─── Restricted-compartment enforcement ───────────────────────────────────────
// A chunk in a restricted compartment is only searchable when the user holds a
// grant — directly or via group membership. Access narrows down the hierarchy:
// a chunk in a sub-compartment also requires access to the parent compartment,
// so a grant on a sub never bypasses a restricted parent. Admins bypass; the
// external plane is gated by subscription instead of grants. Enforced in SQL so
// restricted chunks never leave the database (hard constraint: no path around
// visibility).

function compartmentGrantFilter(
  userId: string,
  userRole: UserRole,
  accessTier: 'internal' | 'external'
): SQL {
  if (accessTier === 'external' || userRole === 'super_admin' || userRole === 'org_admin') {
    return sql``
  }
  return sql` AND EXISTS (
    SELECT 1 FROM compartments cp
    LEFT JOIN compartments pp ON pp.id = cp.parent_compartment_id
    WHERE cp.id = c.compartment_id
      AND (
        NOT cp.restricted
        OR EXISTS (
          SELECT 1 FROM compartment_grants g
          WHERE g.compartment_id = cp.id
            AND (
              g.user_id = ${userId}
              OR g.group_id IN (
                SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
              )
            )
        )
      )
      AND (
        pp.id IS NULL
        OR NOT pp.restricted
        OR EXISTS (
          SELECT 1 FROM compartment_grants g
          WHERE g.compartment_id = pp.id
            AND (
              g.user_id = ${userId}
              OR g.group_id IN (
                SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
              )
            )
        )
      )
  )`
}

// ─── Semantic search via pgvector ─────────────────────────────────────────────

async function semanticSearch(
  orgId: string,
  accessTier: 'internal' | 'external',
  queryEmbedding: number[],
  limit: number,
  compartmentFilter: SQL,
  sourceTypes?: SourceType[]
): Promise<Array<{ id: string; documentId: string; compartmentId: string; content: string; score: number; chunkIndex: number }>> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`
  const sourceFilter = sourceTypes && sourceTypes.length > 0
    ? sql` AND c.source_type::text = ANY(ARRAY[${sql.join(sourceTypes.map((t) => sql`${t}`), sql`, `)}])`
    : sql``

  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.document_id,
      c.compartment_id,
      c.content,
      c.chunk_index,
      c.visibility,
      1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
    FROM chunks c
    WHERE c.org_id = ${orgId}
      AND c.access_tier = ${accessTier}
      AND c.status = 'active'
      ${sourceFilter}
      ${compartmentFilter}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit * 3}
  `)

  return (rows as unknown[]).map((r: unknown) => {
    const row = r as Record<string, unknown>
    return {
      id: row['id'] as string,
      documentId: row['document_id'] as string,
      compartmentId: row['compartment_id'] as string,
      content: row['content'] as string,
      score: Number(row['score']),
      chunkIndex: Number(row['chunk_index']),
      visibility: parseVisibility(row['visibility']),
    }
  })
}

// ─── Full-text search via tsvector ────────────────────────────────────────────
// websearch_to_tsquery sanitises arbitrary user input but ANDs plain words,
// which fails natural-language questions ("what are the standard working
// hours?" requires ALL words to appear). OR-ing the terms lets ts_rank reward
// chunks matching more of them instead of excluding partial matches. An
// all-stopword query yields an empty tsquery; nullif turns it into NULL so the
// @@ match is simply false rather than a syntax error.

async function fullTextSearch(
  orgId: string,
  accessTier: 'internal' | 'external',
  query: string,
  limit: number,
  compartmentFilter: SQL,
  sourceTypes?: SourceType[]
): Promise<Array<{ id: string; documentId: string; compartmentId: string; content: string; rank: number; chunkIndex: number }>> {
  const sourceFilter = sourceTypes && sourceTypes.length > 0
    ? sql` AND c.source_type::text = ANY(ARRAY[${sql.join(sourceTypes.map((t) => sql`${t}`), sql`, `)}])`
    : sql``

  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.document_id,
      c.compartment_id,
      c.content,
      c.chunk_index,
      c.visibility,
      ts_rank(to_tsvector('english', c.content), q.tsq) AS rank
    FROM chunks c,
      LATERAL (
        SELECT to_tsquery(
          'english',
          nullif(replace(websearch_to_tsquery('english', ${query})::text, ' & ', ' | '), '')
        ) AS tsq
      ) q
    WHERE c.org_id = ${orgId}
      AND c.access_tier = ${accessTier}
      AND c.status = 'active'
      AND to_tsvector('english', c.content) @@ q.tsq
      ${sourceFilter}
      ${compartmentFilter}
    ORDER BY rank DESC
    LIMIT ${limit * 3}
  `)

  return (rows as unknown[]).map((r: unknown) => {
    const row = r as Record<string, unknown>
    return {
      id: row['id'] as string,
      documentId: row['document_id'] as string,
      compartmentId: row['compartment_id'] as string,
      content: row['content'] as string,
      rank: Number(row['rank']),
      chunkIndex: Number(row['chunk_index']),
      visibility: parseVisibility(row['visibility']),
    }
  })
}

// ─── Small-to-big: expand to parent section ───────────────────────────────────

async function expandToParent(chunkId: string): Promise<string | null> {
  const rows = await db.execute(sql`
    SELECT c2.content
    FROM chunks c1
    JOIN chunks c2 ON c2.id = c1.parent_chunk_id
    WHERE c1.id = ${chunkId}
    LIMIT 1
  `)
  const first = (rows as unknown[])[0]
  if (!first) return null
  return (first as Record<string, unknown>)['content'] as string
}

// ─── Get document filename for citations ─────────────────────────────────────

async function getDocumentFilename(documentId: string): Promise<string> {
  const rows = await db
    .select({ filename: documents.filename })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
  return rows[0]?.filename ?? 'Unknown document'
}

async function getCompartmentName(compartmentId: string): Promise<string> {
  const rows = await db
    .select({ name: compartments.name })
    .from(compartments)
    .where(eq(compartments.id, compartmentId))
    .limit(1)
  return rows[0]?.name ?? 'Unknown compartment'
}

// ─── Main retrieve function ───────────────────────────────────────────────────

export async function retrieveChunks(
  params: RetrieveParams
): Promise<ServiceResult<{ chunks: ChunkContext[]; confidence: number }>> {
  const { orgId, userId, query, accessTier, userRole, topK = TOP_K_CHUNKS, sourceTypes } = params

  try {
    const queryEmbedding = await embedQuery(query)
    const compartmentFilter = compartmentGrantFilter(userId, userRole, accessTier)

    // Run semantic + full-text search in parallel
    const [semanticResults, ftsResults] = await Promise.all([
      semanticSearch(orgId, accessTier, queryEmbedding, topK, compartmentFilter, sourceTypes),
      fullTextSearch(orgId, accessTier, query, topK, compartmentFilter, sourceTypes),
    ])

    // Fuse the two ranked lists with Reciprocal Rank Fusion. RRF works on
    // ranks, not raw scores, so cosine similarity and ts_rank never need to be
    // put on a common scale — a chunk found by only one search can still win.
    const merged = new Map<
      string,
      { id: string; documentId: string; compartmentId: string; content: string; chunkIndex: number; semanticScore: number; bm25Score: number; rrfScore: number; visibility: unknown }
    >()

    semanticResults.forEach((r, rank) => {
      merged.set(r.id, {
        id: r.id,
        documentId: r.documentId,
        compartmentId: r.compartmentId,
        content: r.content,
        chunkIndex: r.chunkIndex,
        semanticScore: r.score,
        bm25Score: 0,
        rrfScore: 1 / (RRF_K + rank + 1),
        visibility: (r as Record<string, unknown>)['visibility'],
      })
    })

    ftsResults.forEach((r, rank) => {
      const contribution = 1 / (RRF_K + rank + 1)
      const existing = merged.get(r.id)
      if (existing) {
        existing.bm25Score = r.rank
        existing.rrfScore += contribution
      } else {
        merged.set(r.id, {
          id: r.id,
          documentId: r.documentId,
          compartmentId: r.compartmentId,
          content: r.content,
          chunkIndex: r.chunkIndex,
          semanticScore: 0,
          bm25Score: r.rank,
          rrfScore: contribution,
          visibility: (r as Record<string, unknown>)['visibility'],
        })
      }
    })

    // Filter by access control, rank by fused score, take top K
    const scored: ChunkContext[] = []
    for (const item of merged.values()) {
      const canAccess = canAccessChunk({
        visibility: item.visibility as Parameters<typeof canAccessChunk>[0]['visibility'],
        userRole,
        userId,
      })
      if (!canAccess) continue

      scored.push({
        chunkId: item.id,
        documentId: item.documentId,
        compartmentId: item.compartmentId,
        filename: '',
        content: item.content,
        semanticScore: item.semanticScore,
        bm25Score: item.bm25Score,
        finalScore: item.rrfScore,
        chunkIndex: item.chunkIndex,
      })
    }

    scored.sort((a, b) => b.finalScore - a.finalScore)
    const topChunks = scored.slice(0, topK)

    // Confidence gate on the best cosine similarity among the candidates. RRF
    // scores are rank-based and identical across queries, so they carry no
    // signal about whether anything was actually relevant — cosine does.
    const confidence = topChunks.reduce((max, c) => Math.max(max, c.semanticScore), 0)

    if (confidence < CONFIDENCE_GATE_THRESHOLD || topChunks.length === 0) {
      return { success: true, data: { chunks: [], confidence } }
    }

    // Small-to-big: expand content to parent section where available
    const enriched = await Promise.all(
      topChunks.map(async (chunk) => {
        const [parentContent, filename, compartmentName] = await Promise.all([
          expandToParent(chunk.chunkId),
          getDocumentFilename(chunk.documentId),
          getCompartmentName(chunk.compartmentId),
        ])
        return {
          ...chunk,
          content: parentContent ?? chunk.content,
          filename,
          compartmentId: compartmentName,
        }
      })
    )

    return { success: true, data: { chunks: enriched, confidence } }
  } catch (err) {
    console.error('[retrieval]', err)
    const raw = err instanceof Error ? err.message : ''
    const message = friendlyServiceError(raw)
    return { success: false, error: { code: 'RETRIEVAL_ERROR', message } }
  }
}
