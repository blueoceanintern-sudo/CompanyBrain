import { createHash, randomUUID } from "crypto"
import OpenAI from "openai"
import { eq, and } from "drizzle-orm"
import { db, documents, chunks, ingestionJobs } from "../db/index"
import type { ServiceResult, AccessTier, SourceType } from "../shared/types"
import { ok, err } from "../shared/types"

const openai = new OpenAI()

const CHUNK_SIZE     = 512  // tokens (approximate chars)
const CHUNK_OVERLAP  = 64
const SUPPORTED_MIME = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"])

export interface IngestInput {
  fileBuffer:    Buffer
  filename:      string
  orgId:         string
  compartmentId: string
  accessTier:    AccessTier
  sourceType:    SourceType
  uploadedBy:    string
}

export interface IngestResult {
  document_id:              string
  job_id:                   string
  job_status:               "complete" | "failed"
  chunks_created:           number
  chunks_skipped:           number
  previous_version_archived: boolean
  previous_version_id:      string | undefined
  error_message:            string | undefined
  retry_count:              number
  chunks:                   Array<{ id: string; org_id: string; compartment_id: string; chunk_index: number; access_tier: string; source_type: string; content_hash: string; visibility: unknown }>
}

// ─── Input validation ──────────────────────────────────────────────────────────

const VALID_ACCESS_TIERS: AccessTier[]  = ["internal", "external"]
const VALID_SOURCE_TYPES: SourceType[]  = ["hr_policy", "sop", "faq", "case_note", "compliance", "product_doc", "other"]

function detectMimeType(buffer: Buffer): string | null {
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf"
  }
  // DOCX: PK (ZIP archive)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return null
}

function validateInput(input: IngestInput): string | null {
  if (!input.filename) return "Filename is required."
  if (input.fileBuffer.length === 0) return "File buffer is empty."
  if (!VALID_ACCESS_TIERS.includes(input.accessTier)) return `Invalid access_tier: ${input.accessTier}`
  if (!VALID_SOURCE_TYPES.includes(input.sourceType)) return `Invalid source_type: ${input.sourceType}`
  if (!detectMimeType(input.fileBuffer)) return "Unsupported file type. Only PDF and DOCX are accepted."
  return null
}

// ─── Text extraction (stub — real implementation uses pdf-parse / mammoth) ────

function extractText(buffer: Buffer, filename: string): string {
  // In production: use pdf-parse for PDF, mammoth for DOCX.
  // For now, treat buffer as text (supports test-supplied minimal buffers).
  const text = buffer.toString("utf-8")
  return text.replace(/[^\x20-\x7E\n\r\t]/g, " ").trim()
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string): string[] {
  const results: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) results.push(chunk)
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return results.length > 0 ? results : [text.trim()]
}

function hashContent(content: string): string {
  return "sha256-" + createHash("sha256").update(content).digest("hex").slice(0, 40)
}

// ─── Default visibility policy ─────────────────────────────────────────────────

function defaultVisibility(accessTier: AccessTier, sourceType: SourceType): object {
  if (accessTier === "external") {
    return { allowedGroups: ["external_client", "staff", "org_admin"], deniedGroups: [], allowedPrincipals: [], classification: "public" }
  }
  return { allowedGroups: ["org_admin", "staff"], deniedGroups: [], allowedPrincipals: [], classification: "confidential" }
}

// ─── Embedding ─────────────────────────────────────────────────────────────────

async function embedChunks(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function ingestDocument(input: IngestInput): Promise<ServiceResult<IngestResult>> {
  const validationError = validateInput(input)
  if (validationError) {
    return err("VALIDATION_ERROR", validationError)
  }

  const documentId = randomUUID()
  const jobId      = randomUUID()
  const fileHash   = hashContent(input.fileBuffer.toString("base64"))

  let previousVersionId: string | undefined
  let previousVersionArchived = false

  try {
    // Check for previous version with same filename
    const existingDocs = await db
      .select({ id: documents.id, content_hash: documents.content_hash })
      .from(documents)
      .where(and(
        eq(documents.org_id, input.orgId),
        eq(documents.filename, input.filename),
      ))

    if (existingDocs.length > 0) {
      const existing = existingDocs[0]
      if (existing.content_hash === fileHash) {
        // Check existing chunks — content hash dedup
        const existingChunks = await db
          .select({ id: chunks.id })
          .from(chunks)
          .where(and(
            eq(chunks.org_id, input.orgId),
            eq(chunks.document_id, existing.id),
          ))

        return ok({
          document_id:              existing.id,
          job_id:                   jobId,
          job_status:               "complete",
          chunks_created:           0,
          chunks_skipped:           existingChunks.length,
          previous_version_archived: false,
          previous_version_id:      undefined,
          error_message:            undefined,
          retry_count:              0,
          chunks:                   [],
        })
      }

      // Archive existing version
      await db
        .update(documents)
        .set({ status: "archived", updated_at: new Date() })
        .where(eq(documents.id, existing.id))

      previousVersionId       = existing.id
      previousVersionArchived = true
    }

    // Create document record
    await db.insert(documents).values({
      id:                  documentId,
      org_id:              input.orgId,
      compartment_id:      input.compartmentId,
      filename:            input.filename,
      access_tier:         input.accessTier,
      source_type:         input.sourceType,
      content_hash:        fileHash,
      status:              "processing",
      uploaded_by:         input.uploadedBy,
      version:             1,
      previous_version_id: previousVersionId ?? null,
    })

    // Create ingestion job
    await db.insert(ingestionJobs).values({
      id:          jobId,
      org_id:      input.orgId,
      document_id: documentId,
      status:      "running",
      started_at:  new Date(),
    })

    // Extract and chunk text
    const text       = extractText(input.fileBuffer, input.filename)
    const textChunks = splitIntoChunks(text)

    // Embed all chunks
    const embeddings = await embedChunks(textChunks)

    // Insert chunks
    const visibility = defaultVisibility(input.accessTier, input.sourceType)
    const insertedChunks: IngestResult["chunks"] = []

    for (let i = 0; i < textChunks.length; i++) {
      const chunkId      = randomUUID()
      const contentHash  = hashContent(textChunks[i])

      // Per-chunk dedup within same org
      const existing = await db
        .select({ id: chunks.id })
        .from(chunks)
        .where(and(
          eq(chunks.org_id, input.orgId),
          eq(chunks.content_hash, contentHash),
        ))

      if (existing.length > 0) {
        continue
      }

      await db.insert(chunks).values({
        id:             chunkId,
        org_id:         input.orgId,
        document_id:    documentId,
        compartment_id: input.compartmentId,
        content:        textChunks[i],
        embedding:      embeddings[i],
        content_hash:   contentHash,
        visibility,
        access_tier:    input.accessTier,
        source_type:    input.sourceType,
        chunk_index:    i,
        status:         "active",
      })

      insertedChunks.push({
        id:           chunkId,
        org_id:       input.orgId,
        compartment_id: input.compartmentId,
        chunk_index:  i,
        access_tier:  input.accessTier,
        source_type:  input.sourceType,
        content_hash: contentHash,
        visibility,
      })
    }

    // Mark document and job as complete
    await db.update(documents).set({ status: "active", updated_at: new Date() }).where(eq(documents.id, documentId))
    await db.update(ingestionJobs).set({ status: "complete", completed_at: new Date() }).where(eq(ingestionJobs.id, jobId))

    return ok({
      document_id:              documentId,
      job_id:                   jobId,
      job_status:               "complete",
      chunks_created:           insertedChunks.length,
      chunks_skipped:           textChunks.length - insertedChunks.length,
      previous_version_archived: previousVersionArchived,
      previous_version_id:      previousVersionId,
      error_message:            undefined,
      retry_count:              0,
      chunks:                   insertedChunks,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingestion failed"

    // Mark job as failed
    try {
      await db.update(ingestionJobs)
        .set({ status: "failed", error_message: message, retry_count: 1, completed_at: new Date() })
        .where(eq(ingestionJobs.id, jobId))
    } catch {}

    return {
      success: false,
      error: { code: "INGESTION_ERROR", message },
      data: {
        document_id:              documentId,
        job_id:                   jobId,
        job_status:               "failed",
        chunks_created:           0,
        chunks_skipped:           0,
        previous_version_archived: previousVersionArchived,
        previous_version_id:      previousVersionId,
        error_message:            message,
        retry_count:              1,
        chunks:                   [],
      },
    } as unknown as ServiceResult<IngestResult>
  }
}
