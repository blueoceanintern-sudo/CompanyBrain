import { createHash } from 'crypto'
import OpenAI from 'openai'
import { db } from '@company-brain/db'
import { chunks, documents, ingestionJobs } from '@company-brain/db'
import { eq, and } from 'drizzle-orm'
import type {
  IngestParams,
  ServiceResult,
  VisibilityPolicy,
} from '@company-brain/shared'
import {
  CHUNK_SIZE_CHARS,
  CHUNK_OVERLAP_CHARS,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from '@company-brain/shared'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text
  }

  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
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

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data.map((d) => d.embedding)
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
      visibility,
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
    const message = err instanceof Error ? err.message : 'Unknown ingestion error'
    await db
      .update(documents)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(documents.id, documentId))

    return { success: false, error: { code: 'INGESTION_ERROR', message } }
  }
}
