import { mock } from "bun:test"

// Capture what the synthesis service sends to Claude so we can assert on it
let lastMessagePayload: unknown = null

const mockMessagesCreate = mock((payload: unknown) => {
  lastMessagePayload = payload
  return Promise.resolve({
    content: [
      {
        type: "text",
        text: "Based on the provided documents, the answer is X. [1] Additional detail from source. [2]",
      },
    ],
    usage: { input_tokens: 120, output_tokens: 40 },
  })
})

mock.module("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockMessagesCreate }
  },
}))

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { synthesize } from "../../../services/synthesis"
import { seedDb, clearDb } from "../../helpers/setup"
import {
  chunkOrgAInternal,
  chunkOrgAExternal,
  chunkOrgARestricted,
} from "../../helpers/fixtures"

type ChunkInput = {
  id: string
  content: string
  org_id: string
  document_id: string
  source_type: string
  access_tier: string
  chunk_index: number
}

const buildChunk = (overrides: Partial<ChunkInput> = {}): ChunkInput => ({
  id: chunkOrgAInternal.id,
  content: chunkOrgAInternal.content,
  org_id: chunkOrgAInternal.org_id,
  document_id: chunkOrgAInternal.document_id,
  source_type: chunkOrgAInternal.source_type,
  access_tier: chunkOrgAInternal.access_tier,
  chunk_index: chunkOrgAInternal.chunk_index,
  ...overrides,
})

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })
beforeEach(() => { mockMessagesCreate.mockClear(); lastMessagePayload = null })

// ─── Response shape ───────────────────────────────────────────────────────────

describe("synthesize — response shape", () => {
  test("successful synthesis returns { success, data: { answer, citations, confidence, missing } }", async () => {
    const result = await synthesize({
      query: "What is the HR policy?",
      chunks: [buildChunk()],
    })

    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty("answer")
    expect(result.data).toHaveProperty("citations")
    expect(result.data).toHaveProperty("confidence")
    expect(result.data).toHaveProperty("missing")
  })

  test("answer is a non-empty string", async () => {
    const result = await synthesize({
      query: "What is the HR policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    expect(typeof result.data.answer).toBe("string")
    expect(result.data.answer.trim().length).toBeGreaterThan(0)
  })

  test("citations is an array", async () => {
    const result = await synthesize({
      query: "What is the HR policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data.citations)).toBe(true)
  })

  test("confidence is a float between 0 and 1", async () => {
    const result = await synthesize({
      query: "What is the HR policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  test("missing is an array (empty if all query aspects were answered)", async () => {
    const result = await synthesize({
      query: "What is the HR policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data.missing)).toBe(true)
  })
})

// ─── RAG-only enforcement ─────────────────────────────────────────────────────

describe("synthesize — RAG only, no freeform generation", () => {
  test("all provided chunk content is included in the Claude prompt", async () => {
    const chunk1 = buildChunk({ id: "c1", content: "Policy section A: employees get 20 days leave." })
    const chunk2 = buildChunk({ id: "c2", content: "Policy section B: overtime rates apply on weekends." })

    await synthesize({ query: "leave policy", chunks: [chunk1, chunk2] })

    const payload = lastMessagePayload as { messages?: Array<{ content: string }> }
    const promptText = JSON.stringify(payload)
    expect(promptText).toContain(chunk1.content)
    expect(promptText).toContain(chunk2.content)
  })

  test("chunk IDs are included in the prompt so Claude can produce grounded citations", async () => {
    const chunk = buildChunk({ id: "chunk-citation-test" })
    await synthesize({ query: "test query", chunks: [chunk] })

    const promptText = JSON.stringify(lastMessagePayload)
    expect(promptText).toContain("chunk-citation-test")
  })

  test("synthesize with empty chunks array returns I-don't-know — does not call Claude", async () => {
    const result = await synthesize({ query: "any query", chunks: [] })

    expect(result.success).toBe(true)
    expect(result.data.answer).toMatch(/don't know|not in the knowledge base/i)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  test("citations in the result reference only chunk IDs that were provided", async () => {
    const providedChunks = [
      buildChunk({ id: "provided-chunk-1" }),
      buildChunk({ id: "provided-chunk-2" }),
    ]

    mockMessagesCreate.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "Answer based on docs [1][2]" }],
        usage: { input_tokens: 80, output_tokens: 20 },
      })
    )

    const result = await synthesize({ query: "query", chunks: providedChunks })
    expect(result.success).toBe(true)

    const providedIds = new Set(providedChunks.map(c => c.id))
    result.data.citations.forEach((citation: { chunk_id: string }) => {
      expect(providedIds.has(citation.chunk_id)).toBe(true)
    })
  })

  test("answer does not include phrases indicating freeform generation", async () => {
    mockMessagesCreate.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "Based on the provided documents: X is the case. [1]" }],
        usage: { input_tokens: 60, output_tokens: 20 },
      })
    )

    const result = await synthesize({
      query: "test",
      chunks: [buildChunk()],
    })

    expect(result.success).toBe(true)
    // Answer should not contain patterns suggesting freeform: "I think", "in general", "typically"
    expect(result.data.answer).not.toMatch(/\bI think\b|\bin general\b|\btypically\b|\bmy knowledge\b/i)
  })
})

// ─── Citation enforcement ─────────────────────────────────────────────────────

describe("synthesize — citation enforcement", () => {
  test("every successful answer has at least one citation", async () => {
    const result = await synthesize({
      query: "What is the policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    expect(result.data.citations.length).toBeGreaterThan(0)
  })

  test("each citation has chunk_id, document_id, and source_type", async () => {
    const result = await synthesize({
      query: "What is the policy?",
      chunks: [buildChunk()],
    })
    expect(result.success).toBe(true)
    result.data.citations.forEach((c: { chunk_id: string; document_id: string; source_type: string }) => {
      expect(typeof c.chunk_id).toBe("string")
      expect(typeof c.document_id).toBe("string")
      expect(typeof c.source_type).toBe("string")
    })
  })

  test("unsourced Claude response is caught — result marks citations as empty and flags missing", async () => {
    // Claude returns an answer with no citation markers
    mockMessagesCreate.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "The policy allows 20 days leave." }], // no [1] citation
        usage: { input_tokens: 60, output_tokens: 20 },
      })
    )

    const result = await synthesize({
      query: "leave policy",
      chunks: [buildChunk()],
    })

    expect(result.success).toBe(true)
    // Service must detect unsourced answer and handle it
    // Either: citations empty + missing populated, OR answer replaced with "I don't know"
    const unsourced =
      result.data.citations.length === 0 || result.data.answer.match(/don't know/i)
    expect(unsourced).toBe(true)
  })

  test("multiple chunks each produce a citation entry when referenced", async () => {
    const chunks = [
      buildChunk({ id: "chunk-multi-1", content: "Section 1: leave is 20 days [1]" }),
      buildChunk({ id: "chunk-multi-2", content: "Section 2: overtime applies on weekends [2]" }),
    ]

    mockMessagesCreate.mockImplementationOnce(() =>
      Promise.resolve({
        content: [{ type: "text", text: "Leave is 20 days [1]. Overtime applies on weekends [2]." }],
        usage: { input_tokens: 80, output_tokens: 30 },
      })
    )

    const result = await synthesize({ query: "leave and overtime", chunks })
    expect(result.success).toBe(true)
    expect(result.data.citations.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe("synthesize — error handling", () => {
  test("Claude API error returns { success: false, error } — never throws", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Anthropic API timeout"))

    let threw = false
    let result: { success: boolean; error?: unknown }
    try {
      result = await synthesize({ query: "query", chunks: [buildChunk()] })
    } catch {
      threw = true
      result = { success: false }
    }

    expect(threw).toBe(false)
    expect(result.success).toBe(false)
    expect(result.error).toHaveProperty("code")
    expect(result.error).toHaveProperty("message")
  })

  test("error result never contains a stack trace", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("internal crash"))
    const result = await synthesize({ query: "query", chunks: [buildChunk()] })
    if (!result.success) {
      expect(JSON.stringify(result)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
    }
  })

  test("very long chunk content does not cause a 500 — handled gracefully", async () => {
    const longChunk = buildChunk({ content: "x".repeat(50_000) })
    let threw = false
    try {
      await synthesize({ query: "long content query", chunks: [longChunk] })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  test("chunk content with special characters is handled without error", async () => {
    const specialChunk = buildChunk({
      content: "Policy: employees earn ≥20 days. See §4.2 & §5.1 (cf. Sch. A).",
    })
    let threw = false
    try {
      await synthesize({ query: "special characters", chunks: [specialChunk] })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  test("Claude returning an empty content array is handled — does not crash", async () => {
    mockMessagesCreate.mockResolvedValueOnce({ content: [], usage: { input_tokens: 0, output_tokens: 0 } })
    const result = await synthesize({ query: "test", chunks: [buildChunk()] })
    expect(result.success).toBe(false)
    expect(result.error).toHaveProperty("code")
  })
})
