import { createHash } from 'crypto'
import { db } from '@company-brain/db'
import { chunks, documents } from '@company-brain/db'
import { eq, and, sql } from 'drizzle-orm'
import type {
  IngestParams,
  ServiceResult,
} from '@company-brain/shared'
import { CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS } from '@company-brain/shared'
import { getEmbeddingProvider, AiProviderError } from '@company-brain/ai-provider'

// Mirrors friendlyServiceError in services/retrieval: an embedding failure is
// classified by AiProviderError.code rather than surfaced as a raw provider
// message. Non-AI failures (PDF/Word parsing, DB) keep their own message, which
// is genuinely useful to the admin who uploaded the document.
function ingestionError(err: unknown): { code: string; message: string } {
  if (err instanceof AiProviderError) {
    switch (err.code) {
      case 'AUTH':
        return { code: 'EMBEDDING_ERROR', message: 'Embeddings are not configured. Please contact your administrator.' }
      case 'RATE_LIMIT':
        return { code: 'EMBEDDING_ERROR', message: 'The embedding service is rate limited. Please retry shortly.' }
      case 'TIMEOUT':
        return { code: 'EMBEDDING_ERROR', message: 'The embedding service timed out. Please retry.' }
      default:
        return { code: 'EMBEDDING_ERROR', message: 'The embedding service is temporarily unavailable. Please retry.' }
    }
  }
  const message = err instanceof Error ? err.message : 'Unknown ingestion error'
  return { code: 'INGESTION_ERROR', message }
}

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text
  }

if (lower.endsWith('.docx')) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

if (lower.endsWith('.doc')) {
  throw new Error('Legacy .doc files are not supported; please convert to .docx')
}

  // Plain text fallback
  return buffer.toString('utf-8')
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const result: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_SIZE_CHARS && current.length > 0) {
      result.push(current.trim())
      // Keep overlap from end of previous chunk
      const overlap = current.slice(-CHUNK_OVERLAP_CHARS)
      current = overlap + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current.trim().length > 0) {
    result.push(current.trim())
  }

  return result
}

// ─── Stitching (inverse of chunkText, for document preview) ───────────────────

// Consecutive chunks share up to CHUNK_OVERLAP_CHARS of text (plus the '\n\n'
// joiner), but trimming during chunking can shave its edges — so find the
// longest suffix of the stitched text that prefixes the next chunk instead of
// assuming a fixed width. Below 20 chars a match is likely coincidence; fall
// back to a paragraph join, which at worst duplicates a short overlap.
export function stitchChunks(contents: string[]): string {
  let doc = ''
  for (const chunk of contents) {
    if (!doc) {
      doc = chunk
      continue
    }
    let merged = false
    const maxOverlap = Math.min(CHUNK_OVERLAP_CHARS + 2, doc.length, chunk.length)
    for (let k = maxOverlap; k >= 20; k--) {
      if (doc.endsWith(chunk.slice(0, k))) {
        doc += chunk.slice(k)
        merged = true
        break
      }
    }
    if (!merged) doc += '\n\n' + chunk
  }
  return doc
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await getEmbeddingProvider().embed({ input: texts })
  return result.embeddings
}

// ─── Main ingest function ─────────────────────────────────────────────────────

export async function ingestDocument(
  params: IngestParams
): Promise<ServiceResult<{ chunksCreated: number }>> {
  const {
    orgId,
    documentId,
    compartmentId,
    accessTier,
    sourceType,
    visibility,
    fileBuffer,
    filename,
  } = params

  try {
    // 1. Extract text
    const rawText = await extractText(fileBuffer, filename)
    if (!rawText.trim()) {
      return { success: false, error: { code: 'EMPTY_DOCUMENT', message: 'Document produced no extractable text' } }
    }

    // 2. Chunk
    const textChunks = chunkText(rawText)

    // 3. Dedup: skip chunks whose content hash already exists for this org
    const newChunks: Array<{ content: string; hash: string; index: number }> = []
    for (let i = 0; i < textChunks.length; i++) {
      const content = textChunks[i]
      if (!content) continue
      const hash = createHash('sha256').update(content).digest('hex')
      const existing = await db
        .select({ id: chunks.id })
        .from(chunks)
        .where(and(eq(chunks.orgId, orgId), eq(chunks.contentHash, hash)))
        .limit(1)

      if (existing.length === 0) {
        newChunks.push({ content, hash, index: i })
      }
    }

    if (newChunks.length === 0) {
      await db.update(documents).set({ status: 'complete' }).where(eq(documents.id, documentId))
      return { success: true, data: { chunksCreated: 0 } }
    }

    // 4. Embed in batches of 20
    const BATCH_SIZE = 20
    const allEmbeddings: number[][] = []
    for (let i = 0; i < newChunks.length; i += BATCH_SIZE) {
      const batch = newChunks.slice(i, i + BATCH_SIZE)
      const embeddings = await embedBatch(batch.map((c) => c.content))
      allEmbeddings.push(...embeddings)
    }

    // 5. Store chunks
    const insertValues = newChunks.map((c, i) => ({
      orgId,
      documentId,
      compartmentId,
      content: c.content,
      embedding: allEmbeddings[i] ?? [],
      contentHash: c.hash,
      visibility: sql`${JSON.stringify(visibility)}::jsonb`,
      accessTier,
      sourceType,
      chunkIndex: c.index,
      status: 'active' as const,
    }))

    await db.insert(chunks).values(insertValues)

    // 6. Mark document as complete
    await db
      .update(documents)
      .set({ status: 'complete', updatedAt: new Date() })
      .where(eq(documents.id, documentId))

    return { success: true, data: { chunksCreated: newChunks.length } }
  } catch (err) {
    console.error(`[ingestion] document ${documentId} failed:`, err)
    await db
      .update(documents)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(documents.id, documentId))

    return { success: false, error: ingestionError(err) }
  }
}
