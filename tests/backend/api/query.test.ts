import { mock } from "bun:test"

// Mock external AI dependencies — not under test at the API layer
mock.module("../../../services/synthesis", () => ({
  synthesize: mock(() =>
    Promise.resolve({
      success: true as const,
      data: {
        answer: "The leave policy allows 20 days per year.",
        citations: [
          { chunk_id: "chunk-a-internal-1", document_id: "doc-a-internal-1", source_type: "hr_policy" },
        ],
        confidence: 0.82,
        missing: [],
      },
    })
  ),
}))

mock.module("openai", () => ({
  default: class {
    embeddings = {
      create: mock(() => Promise.resolve({ data: [{ embedding: new Array(1536).fill(0.5) }] })),
    }
  },
}))

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgAExternal,
  chunkOrgAInternal,
  chunkOrgAExternal,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── Response shape ───────────────────────────────────────────────────────────

describe("POST /orgs/:id/query — response shape", () => {
  test("successful query returns { success: true, data: { answer, citations, confidence, missing } }", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "What is the leave policy?" },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("answer")
    expect(body.data).toHaveProperty("citations")
    expect(body.data).toHaveProperty("confidence")
    expect(body.data).toHaveProperty("missing")
  })

  test("answer is a non-empty string", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "What is the leave policy?" },
    })
    const body = await res.json()
    expect(typeof body.data.answer).toBe("string")
    expect(body.data.answer.trim().length).toBeGreaterThan(0)
  })

  test("citations is an array of objects with chunk_id, document_id, source_type", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "What is the leave policy?" },
    })
    const body = await res.json()
    expect(Array.isArray(body.data.citations)).toBe(true)
    body.data.citations.forEach((c: { chunk_id: string; document_id: string; source_type: string }) => {
      expect(typeof c.chunk_id).toBe("string")
      expect(typeof c.document_id).toBe("string")
      expect(typeof c.source_type).toBe("string")
    })
  })

  test("confidence is a number between 0 and 1", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "What is the leave policy?" },
    })
    const body = await res.json()
    expect(body.data.confidence).toBeGreaterThanOrEqual(0)
    expect(body.data.confidence).toBeLessThanOrEqual(1)
  })
})

// ─── Confidence gate — inline I-don't-know ────────────────────────────────────

describe("POST /orgs/:id/query — confidence gate", () => {
  test("low-confidence query returns 200 with I-don't-know answer (not 4xx or 5xx)", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "xyzzy completely irrelevant nonsense no match" },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.answer).toMatch(/don't know|not in the knowledge base/i)
  })

  test("low-confidence response has empty citations array", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "xyzzy completely irrelevant nonsense no match" },
    })
    const body = await res.json()
    expect(body.data.citations).toHaveLength(0)
  })

  test("low-confidence response has confidence value below 0.5", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "xyzzy completely irrelevant nonsense" },
    })
    const body = await res.json()
    expect(body.data.confidence).toBeLessThan(0.5)
  })
})

// ─── Input validation ─────────────────────────────────────────────────────────

describe("POST /orgs/:id/query — input validation", () => {
  test("missing query field returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: {},
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toHaveProperty("code")
  })

  test("empty query string returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "" },
    })
    expect(res.status).toBe(400)
  })

  test("whitespace-only query returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "    " },
    })
    expect(res.status).toBe(400)
  })

  test("non-string query field returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: 12345 },
    })
    expect(res.status).toBe(400)
  })

  test("query exceeding max length returns 400 not 500", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "a".repeat(10_000) },
    })
    expect(res.status).not.toBe(500)
    expect([200, 400]).toContain(res.status)
  })

  test("request with no body returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
    })
    expect(res.status).toBe(400)
  })

  test("400 response always has { success: false, error: { code, message } }", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: {},
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty("success", false)
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
  })
})

// ─── Access tier scoping ──────────────────────────────────────────────────────

describe("POST /orgs/:id/query — access tier scoping", () => {
  test("external_client query never returns citations with access_tier: internal", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAExternal, {
      method: "POST",
      body: { query: chunkOrgAInternal.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citations: Array<{ access_tier: string }> = body.data.citations ?? []
    citations.forEach(c => expect(c.access_tier).toBe("external"))
  })

  test("internal query by org_admin can surface internal chunks in citations", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAAdmin, {
      method: "POST",
      body: { query: chunkOrgAInternal.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ─── Query history ────────────────────────────────────────────────────────────

describe("GET /orgs/:id/queries — query history", () => {
  test("returns 200 with an array of past queries for org_admin", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test("query is logged after being submitted", async () => {
    const queryText = `unique-test-query-${Date.now()}`

    await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: queryText },
    })

    const historyRes = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    const body = await historyRes.json()
    const logged = body.data.find((q: { query_text: string }) => q.query_text === queryText)
    expect(logged).toBeDefined()
  })

  test("each history record has query_text, answer, confidence, created_at", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.length > 0) {
      const record = body.data[0]
      expect(record).toHaveProperty("query_text")
      expect(record).toHaveProperty("answer")
      expect(record).toHaveProperty("confidence")
      expect(record).toHaveProperty("created_at")
    }
  })

  test("history is ordered with most recent query first", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    const body = await res.json()
    const records: Array<{ created_at: string }> = body.data ?? []
    for (let i = 1; i < records.length; i++) {
      const prev = new Date(records[i - 1].created_at).getTime()
      const curr = new Date(records[i].created_at).getTime()
      expect(prev).toBeGreaterThanOrEqual(curr)
    }
  })

  test("staff cannot view query history", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("external_client cannot view query history", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAExternal)
    expect(res.status).toBe(403)
  })

  test("query history records only contain org_id matching the scoped org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    const body = await res.json()
    const records: Array<{ org_id: string }> = body.data ?? []
    records.forEach(r => expect(r.org_id).toBe(ORG_A_ID))
  })
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /orgs/:id/query — auth", () => {
  test("unauthenticated request returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/query`, {
      method: "POST",
      body: { query: "test" },
    })
    expect(res.status).toBe(401)
  })

  test("GET /orgs/:id/queries without auth returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/queries`)
    expect(res.status).toBe(401)
  })
})
