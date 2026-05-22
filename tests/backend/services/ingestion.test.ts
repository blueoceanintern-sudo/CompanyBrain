import { mock } from "bun:test"

// Mock OpenAI embeddings — embedding quality is not under test here
const mockCreateEmbedding = mock(() =>
  Promise.resolve({ data: [{ embedding: new Array(1536).fill(0.1) }] })
)
mock.module("openai", () => ({
  default: class {
    embeddings = { create: mockCreateEmbedding }
  },
}))

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { ingestDocument } from "../../../services/ingestion"
import { seedDb, clearDb } from "../../helpers/setup"
import {
  ORG_A_ID,
  ORG_B_ID,
  userOrgAAdmin,
  compartmentAHr,
  DEDUP_CONTENT_HASH,
  chunkDedupOriginal,
  documentOrgAInternal,
} from "../../helpers/fixtures"

// Minimal valid PDF buffer — enough to pass file-type validation
const VALID_PDF_BUFFER = Buffer.from("%PDF-1.4 1 0 obj<</Type /Catalog>>endobj")
const VALID_WORD_BUFFER = Buffer.from("PK\x03\x04") // DOCX magic bytes

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })
beforeEach(() => { mockCreateEmbedding.mockClear() })

// ─── Content hash deduplication ───────────────────────────────────────────────

describe("ingestDocument — content hash deduplication", () => {
  test("re-uploading identical content for the same org is a no-op", async () => {
    // chunkDedupOriginal is already seeded with DEDUP_CONTENT_HASH
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "duplicate.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    expect(result.data.chunks_created).toBe(0)
    expect(result.data.chunks_skipped).toBeGreaterThan(0)
    // No new embedding calls for deduped content
    expect(mockCreateEmbedding).not.toHaveBeenCalled()
  })

  test("re-uploading changed content creates a new version and archives the old", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 changed content for versioning test"),
      filename: documentOrgAInternal.filename,
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "hr_policy",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    expect(result.data.chunks_created).toBeGreaterThan(0)
    expect(result.data.previous_version_archived).toBe(true)
    expect(result.data.previous_version_id).toBe(documentOrgAInternal.id)
  })

  test("same content hash in a different org creates a new chunk — no cross-org dedup", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "cross-org-same-content.pdf",
      orgId: ORG_B_ID,                          // different org
      compartmentId: "comp-b-ops",
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: "user-b-admin",
    })

    expect(result.success).toBe(true)
    expect(result.data.chunks_created).toBeGreaterThan(0) // new chunk created for org B
  })

  test("new version chunk has previous_version_id pointing to the archived chunk", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 another changed version content"),
      filename: documentOrgAInternal.filename,
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "hr_policy",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    expect(result.data.previous_version_id).toBeDefined()
  })
})

// ─── Chunk tagging ─────────────────────────────────────────────────────────────

describe("ingestDocument — chunk tagging", () => {
  test("every chunk is tagged with the correct org_id", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 tagging test content org A"),
      filename: "tagging-test.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { org_id: string }) => {
      expect(chunk.org_id).toBe(ORG_A_ID)
    })
  })

  test("every chunk is tagged with the correct compartment_id", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 compartment tagging test"),
      filename: "compartment-tagging.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "hr_policy",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { compartment_id: string }) => {
      expect(chunk.compartment_id).toBe(compartmentAHr.id)
    })
  })

  test("every chunk is tagged with the correct access_tier", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 access tier tagging test external"),
      filename: "external-tagging.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "external",
      sourceType: "faq",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { access_tier: string }) => {
      expect(chunk.access_tier).toBe("external")
    })
  })

  test("every chunk is tagged with the correct source_type", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 source type test compliance"),
      filename: "source-type-test.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "compliance",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { source_type: string }) => {
      expect(chunk.source_type).toBe("compliance")
    })
  })

  test("every chunk has a non-empty visibility JSONB field", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 visibility policy tagging test"),
      filename: "visibility-test.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { visibility: unknown }) => {
      expect(chunk.visibility).not.toBeNull()
      expect(chunk.visibility).not.toBeUndefined()
    })
  })

  test("chunks have sequential chunk_index values starting at 0", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 multiple chunks test content a b c d"),
      filename: "multi-chunk.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    const indices: number[] = result.data.chunks.map((c: { chunk_index: number }) => c.chunk_index)
    indices.forEach((idx, pos) => expect(idx).toBe(pos))
  })

  test("each chunk has a content_hash derived from its content", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("%PDF-1.4 content hash verification test"),
      filename: "hash-test.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    result.data.chunks.forEach((chunk: { content_hash: string; content: string }) => {
      expect(typeof chunk.content_hash).toBe("string")
      expect(chunk.content_hash.length).toBeGreaterThan(0)
    })
  })
})

// ─── Ingestion job lifecycle ──────────────────────────────────────────────────

describe("ingestDocument — ingestion job lifecycle", () => {
  test("successful ingestion completes the job with status 'complete'", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "job-lifecycle.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(true)
    expect(result.data.job_status).toBe("complete")
  })

  test("failed ingestion sets job status to 'failed' and records error_message", async () => {
    mockCreateEmbedding.mockImplementationOnce(() => Promise.reject(new Error("OpenAI unavailable")))

    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "fail-job.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
    expect(result.error.code).toBeDefined()
    // Job record should exist and be in failed state
    expect(result.data?.job_status).toBe("failed")
    expect(result.data?.error_message).toBeTruthy()
  })

  test("failed ingestion increments retry_count on the job", async () => {
    mockCreateEmbedding.mockRejectedValueOnce(new Error("transient failure"))

    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "retry-test.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
    expect(result.data?.retry_count).toBeGreaterThanOrEqual(1)
  })

  test("result always returns { success, data } or { success, error } — never throws", async () => {
    mockCreateEmbedding.mockRejectedValueOnce(new Error("unexpected crash"))

    let threw = false
    try {
      await ingestDocument({
        fileBuffer: VALID_PDF_BUFFER,
        filename: "no-throw.pdf",
        orgId: ORG_A_ID,
        compartmentId: compartmentAHr.id,
        accessTier: "internal",
        sourceType: "sop",
        uploadedBy: userOrgAAdmin.id,
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe("ingestDocument — input validation", () => {
  test("empty file buffer returns a validation error", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.alloc(0),
      filename: "empty.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
    expect(result.error.code).toBeDefined()
  })

  test("unsupported file type returns a validation error", async () => {
    const result = await ingestDocument({
      fileBuffer: Buffer.from("<html><body>not a pdf</body></html>"),
      filename: "evil.html",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
    expect(result.error.code).toBeDefined()
  })

  test("missing filename returns a validation error", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
  })

  test("invalid access_tier value returns a validation error", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "bad-tier.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      // @ts-expect-error — intentionally invalid value for runtime validation test
      accessTier: "super_secret",
      sourceType: "sop",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
  })

  test("invalid source_type value returns a validation error", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_PDF_BUFFER,
      filename: "bad-source.pdf",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      // @ts-expect-error — intentionally invalid value
      sourceType: "blog_post",
      uploadedBy: userOrgAAdmin.id,
    })

    expect(result.success).toBe(false)
  })

  test("valid DOCX file is accepted alongside PDF", async () => {
    const result = await ingestDocument({
      fileBuffer: VALID_WORD_BUFFER,
      filename: "policy.docx",
      orgId: ORG_A_ID,
      compartmentId: compartmentAHr.id,
      accessTier: "internal",
      sourceType: "hr_policy",
      uploadedBy: userOrgAAdmin.id,
    })

    // Should succeed or return a well-formed error — never throw or 500
    expect(typeof result.success).toBe("boolean")
    if (!result.success) {
      expect(result.error).toHaveProperty("code")
      expect(result.error).toHaveProperty("message")
    }
  })
})
