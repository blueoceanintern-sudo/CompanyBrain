import { mock } from "bun:test"

// External dependencies mocked before module under test is imported
const mockSynthesize = mock(() =>
  Promise.resolve({
    success: true as const,
    data: { answer: "mocked synthesis answer", citations: [], confidence: 0.85, missing: [] },
  })
)
mock.module("../../../services/synthesis", () => ({ synthesize: mockSynthesize }))

const mockCreateEmbedding = mock(() =>
  Promise.resolve({ data: [{ embedding: new Array(1536).fill(0.5) }] })
)
mock.module("openai", () => ({
  default: class {
    embeddings = { create: mockCreateEmbedding }
  },
}))

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { retrieve, computeScore } from "../../../services/retrieval"
import { seedDb, clearDb } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgAExternal,
  chunkOrgAInternal,
  chunkOrgAExternal,
  chunkOrgARestricted,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })
beforeEach(() => { mockSynthesize.mockClear(); mockCreateEmbedding.mockClear() })

// ─── Scoring formula ──────────────────────────────────────────────────────────

describe("computeScore — deterministic formula", () => {
  test("applies 0.7 semantic + 0.3 bm25 weighting", () => {
    expect(computeScore(1.0, 1.0)).toBeCloseTo(1.0)
    expect(computeScore(1.0, 0.0)).toBeCloseTo(0.7)
    expect(computeScore(0.0, 1.0)).toBeCloseTo(0.3)
    expect(computeScore(0.0, 0.0)).toBeCloseTo(0.0)
  })

  test("produces the correct weighted value for mid-range inputs", () => {
    // 0.7 * 0.6 + 0.3 * 0.4 = 0.42 + 0.12 = 0.54
    expect(computeScore(0.6, 0.4)).toBeCloseTo(0.54)
  })

  test("result is always between 0 and 1 for normalised inputs", () => {
    const inputs: Array<[number, number]> = [
      [0.3, 0.9],
      [0.8, 0.2],
      [0.5, 0.5],
      [0.99, 0.01],
    ]
    inputs.forEach(([sem, bm25]) => {
      const score = computeScore(sem, bm25)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  test("same inputs always produce the same output (deterministic)", () => {
    const a = computeScore(0.72, 0.45)
    const b = computeScore(0.72, 0.45)
    expect(a).toBe(b)
  })

  test("higher semantic similarity dominates when bm25 is equal", () => {
    const high = computeScore(0.9, 0.5)
    const low  = computeScore(0.4, 0.5)
    expect(high).toBeGreaterThan(low)
  })
})

// ─── Confidence gate ──────────────────────────────────────────────────────────

describe("retrieve — confidence gate", () => {
  test("returns I-don't-know answer when best score is below 0.5", async () => {
    // Query content that has no semantic match to any seeded chunk
    const result = await retrieve({
      query: "xyzzy irrelevant nonsense text no match exists",
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })

    expect(result.success).toBe(true)
    expect(result.data.answer.toLowerCase()).toMatch(/don't know|not in the knowledge base/i)
    expect(result.data.confidence).toBeLessThan(0.5)
  })

  test("synthesis is NOT called when confidence gate fails", async () => {
    await retrieve({
      query: "xyzzy irrelevant nonsense text no match exists",
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })
    expect(mockSynthesize).not.toHaveBeenCalled()
  })

  test("synthesis IS called when confidence gate passes", async () => {
    // Query that closely matches a seeded chunk
    await retrieve({
      query: chunkOrgAInternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })
    expect(mockSynthesize).toHaveBeenCalledTimes(1)
  })

  test("response shape on gate failure is { answer, citations: [], confidence, missing }", async () => {
    const result = await retrieve({
      query: "xyzzy irrelevant nonsense text no match exists",
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty("answer")
    expect(result.data).toHaveProperty("citations")
    expect(result.data).toHaveProperty("confidence")
    expect(result.data).toHaveProperty("missing")
    expect(result.data.citations).toHaveLength(0)
  })

  test("score exactly at 0.5 passes the gate", () => {
    // Gate condition is strict: final_score < 0.5 → deny; 0.5 should pass
    expect(computeScore(0.5, 0.5)).toBeGreaterThanOrEqual(0.5)
  })
})

// ─── Top-k ────────────────────────────────────────────────────────────────────

describe("retrieve — top-k", () => {
  test("returns at most 5 chunks to synthesis regardless of how many match", async () => {
    let capturedChunks: unknown[] = []
    mockSynthesize.mockImplementation((args: { chunks: unknown[] }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgAInternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    expect(capturedChunks.length).toBeLessThanOrEqual(5)
  })

  test("chunks passed to synthesis are ranked by final_score descending", async () => {
    let capturedChunks: Array<{ score: number }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ score: number }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgAInternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    for (let i = 1; i < capturedChunks.length; i++) {
      expect(capturedChunks[i - 1].score).toBeGreaterThanOrEqual(capturedChunks[i].score)
    }
  })

  test("duplicate chunk IDs are never passed to synthesis", async () => {
    let capturedChunks: Array<{ id: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ id: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgAInternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    const ids = capturedChunks.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── Small-to-big retrieval ───────────────────────────────────────────────────

describe("retrieve — small-to-big expansion", () => {
  test("when a child chunk matches, its parent section is included in context", async () => {
    let capturedChunks: Array<{ id: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ id: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    // Query matches a child chunk that has a parent_chunk_id set
    await retrieve({
      query: "child chunk content with known parent",
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    // Parent chunk ID should appear in the chunks sent to synthesis
    const chunkIds = capturedChunks.map(c => c.id)
    expect(chunkIds).toContain("chunk-a-parent-section")
  })

  test("parent expansion does not push total chunks beyond 5", async () => {
    let capturedChunks: Array<{ id: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ id: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgAInternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    expect(capturedChunks.length).toBeLessThanOrEqual(5)
  })
})

// ─── Access tier and visibility filtering ─────────────────────────────────────

describe("retrieve — access tier and visibility pre-filtering", () => {
  test("internal chunks are excluded from external retrieval before scoring", async () => {
    let capturedChunks: Array<{ access_tier: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ access_tier: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgAExternal.content,
      orgId: ORG_A_ID,
      userId: userOrgAExternal.id,
      userRole: userOrgAExternal.role,
      accessTier: "external",
    })

    capturedChunks.forEach(c => expect(c.access_tier).toBe("external"))
  })

  test("chunks outside user visibility are excluded before scoring", async () => {
    let capturedChunks: Array<{ id: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ id: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: chunkOrgARestricted.content,
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })

    const ids = capturedChunks.map(c => c.id)
    expect(ids).not.toContain(chunkOrgARestricted.id)
  })

  test("chunks from a different org are never in retrieval results", async () => {
    let capturedChunks: Array<{ org_id: string }> = []
    mockSynthesize.mockImplementation((args: { chunks: Array<{ org_id: string }> }) => {
      capturedChunks = args.chunks
      return Promise.resolve({
        success: true as const,
        data: { answer: "ok", citations: [], confidence: 0.9, missing: [] },
      })
    })

    await retrieve({
      query: "internal sop content belonging exclusively to org b",
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })

    capturedChunks.forEach(c => expect(c.org_id).toBe(ORG_A_ID))
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("retrieve — edge cases", () => {
  test("empty query string returns a validation error", async () => {
    const result = await retrieve({
      query: "",
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(false)
  })

  test("whitespace-only query string returns a validation error", async () => {
    const result = await retrieve({
      query: "     ",
      orgId: ORG_A_ID,
      userId: userOrgAStaff.id,
      userRole: userOrgAStaff.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(false)
  })

  test("query with no matching chunks returns I-don't-know without calling synthesis", async () => {
    const result = await retrieve({
      query: "zxqwerty no possible match zzz",
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(true)
    expect(result.data.answer).toMatch(/don't know|not in the knowledge base/i)
    expect(mockSynthesize).not.toHaveBeenCalled()
  })

  test("retrieve returns success: false if OpenAI embedding call fails", async () => {
    mockCreateEmbedding.mockImplementationOnce(() => Promise.reject(new Error("OpenAI timeout")))
    const result = await retrieve({
      query: "valid query text",
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(false)
    expect(result.error).toHaveProperty("code")
    expect(result.error).toHaveProperty("message")
  })

  test("error result never includes a stack trace", async () => {
    mockCreateEmbedding.mockImplementationOnce(() => Promise.reject(new Error("OpenAI timeout")))
    const result = await retrieve({
      query: "valid query",
      orgId: ORG_A_ID,
      userId: userOrgAAdmin.id,
      userRole: userOrgAAdmin.role,
      accessTier: "internal",
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
  })
})
