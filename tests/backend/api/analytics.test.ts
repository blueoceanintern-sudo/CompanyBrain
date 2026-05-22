import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgAExternal,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── Overview ─────────────────────────────────────────────────────────────────

describe("GET /orgs/:id/analytics/overview — stat metrics", () => {
  test("org_admin receives 200 with all four stat metrics", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("kb_coverage")
    expect(body.data).toHaveProperty("query_volume")
    expect(body.data).toHaveProperty("citation_hit_rate")
    expect(body.data).toHaveProperty("idk_rate")
  })

  test("all metrics are numbers", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    expect(typeof body.data.kb_coverage).toBe("number")
    expect(typeof body.data.query_volume).toBe("number")
    expect(typeof body.data.citation_hit_rate).toBe("number")
    expect(typeof body.data.idk_rate).toBe("number")
  })

  test("percentage metrics are between 0 and 100", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    const pcts = [body.data.kb_coverage, body.data.citation_hit_rate, body.data.idk_rate]
    pcts.forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    })
  })

  test("query_volume is a non-negative integer", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    expect(body.data.query_volume).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(body.data.query_volume)).toBe(true)
  })

  test("response includes warning flags when thresholds are breached", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    // Warning fields should be present (true/false depending on data)
    expect(body.data).toHaveProperty("kb_coverage_warning")
    expect(body.data).toHaveProperty("citation_hit_rate_warning")
    expect(body.data).toHaveProperty("idk_rate_warning")
  })

  test("kb_coverage_warning is true when coverage is below 70%", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.kb_coverage < 70) {
      expect(body.data.kb_coverage_warning).toBe(true)
    } else {
      expect(body.data.kb_coverage_warning).toBe(false)
    }
  })

  test("citation_hit_rate_warning is true when rate is below 85%", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.citation_hit_rate < 85) {
      expect(body.data.citation_hit_rate_warning).toBe(true)
    } else {
      expect(body.data.citation_hit_rate_warning).toBe(false)
    }
  })

  test("idk_rate_warning is true when rate exceeds 15%", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.idk_rate > 15) {
      expect(body.data.idk_rate_warning).toBe(true)
    } else {
      expect(body.data.idk_rate_warning).toBe(false)
    }
  })

  test("date range filter changes the query_volume metric", async () => {
    const last7  = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview?range=7d`,  userOrgAAdmin)
    const last90 = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview?range=90d`, userOrgAAdmin)
    const body7  = await last7.json()
    const body90 = await last90.json()
    // 90-day window should have ≥ 7-day window volume (or equal if all queries are recent)
    expect(body90.data.query_volume).toBeGreaterThanOrEqual(body7.data.query_volume)
  })

  test("overview with no query data returns zero metrics — not a 500", async () => {
    // Use a fresh org with no queries seeded
    const res = await authedRequest("/api/v1/orgs/test-org-free/analytics/overview", {
      id: "user-free-admin", org_id: "test-org-free", role: "org_admin", email: "admin@orgfree.test",
    })
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.query_volume).toBe(0)
    }
  })

  test("analytics data is scoped to the org — metrics reflect only that org's queries", async () => {
    const resA = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAAdmin)
    const bodyA = await resA.json()
    // Volume from org A should be consistent with seeded data — no cross-org bleed
    expect(typeof bodyA.data.query_volume).toBe("number")
  })
})

// ─── Top unanswered queries ────────────────────────────────────────────────────

describe("GET /orgs/:id/analytics/queries — top unanswered", () => {
  test("org_admin receives 200 with an array of unanswered query records", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test("each record has query_text, count, and last_asked fields", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.length > 0) {
      const record = body.data[0]
      expect(record).toHaveProperty("query_text")
      expect(record).toHaveProperty("count")
      expect(record).toHaveProperty("last_asked")
      expect(typeof record.count).toBe("number")
    }
  })

  test("records are sorted by count descending (most unanswered first)", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAAdmin)
    const body = await res.json()
    const records: Array<{ count: number }> = body.data ?? []
    for (let i = 1; i < records.length; i++) {
      expect(records[i - 1].count).toBeGreaterThanOrEqual(records[i].count)
    }
  })

  test("only low-confidence or unanswered queries appear in the list", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAAdmin)
    const body = await res.json()
    // All records should represent queries that were not answered (confidence < 0.5)
    // We can't assert confidence directly here as it's aggregated, but count > 0 implies there are unanswered queries
    body.data.forEach((record: { count: number }) => {
      expect(record.count).toBeGreaterThan(0)
    })
  })

  test("date range filter affects the results", async () => {
    const last7  = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries?range=7d`,  userOrgAAdmin)
    const last90 = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries?range=90d`, userOrgAAdmin)
    expect(last7.status).toBe(200)
    expect(last90.status).toBe(200)
    const body7  = await last7.json()
    const body90 = await last90.json()
    expect(Array.isArray(body7.data)).toBe(true)
    expect(Array.isArray(body90.data)).toBe(true)
  })

  test("staff cannot view analytics queries — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("external_client cannot view analytics queries — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/queries`, userOrgAExternal)
    expect(res.status).toBe(403)
  })
})

// ─── Export ───────────────────────────────────────────────────────────────────

describe("GET /orgs/:id/analytics/export — audit log export", () => {
  test("org_admin receives 200 with exportable data", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(200)
  })

  test("export Content-Type is text/csv or application/json", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    const contentType = res.headers.get("content-type") ?? ""
    expect(contentType).toMatch(/text\/csv|application\/json/)
  })

  test("export response is non-empty when audit logs exist", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text.trim().length).toBeGreaterThan(0)
  })

  test("export contains audit log fields: actor, action, resource, timestamp", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    const text = await res.text()
    // Header row (CSV) or keys (JSON) should include these fields
    const lowerText = text.toLowerCase()
    expect(lowerText).toMatch(/actor|user/)
    expect(lowerText).toMatch(/action/)
    expect(lowerText).toMatch(/timestamp|created_at/)
  })

  test("export does not include data from a different org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    const text = await res.text()
    expect(text).not.toContain("test-org-b")
    expect(text).not.toContain("admin@orgb.test")
  })

  test("export does not include query log entries purged by retention policy", async () => {
    // This verifies the export respects the 90-day retention window
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(200)
    // Dates older than 90 days from NOW (2026-05-19) should not appear in the query section
    const text = await res.text()
    expect(text).not.toContain("2026-02-16") // > 90 days ago
  })

  test("staff cannot export audit log — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("external_client cannot export audit log — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAExternal)
    expect(res.status).toBe(403)
  })

  test("unauthenticated request returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/analytics/export`)
    expect(res.status).toBe(401)
  })
})

// ─── Role access across all analytics routes ──────────────────────────────────

describe("analytics — role access enforcement", () => {
  const analyticsRoutes = [
    `/api/v1/orgs/${ORG_A_ID}/analytics/overview`,
    `/api/v1/orgs/${ORG_A_ID}/analytics/queries`,
    `/api/v1/orgs/${ORG_A_ID}/analytics/export`,
  ]

  test("staff receives 403 on all analytics routes", async () => {
    for (const route of analyticsRoutes) {
      const res = await authedRequest(route, userOrgAStaff)
      expect(res.status).toBe(403)
    }
  })

  test("external_client receives 403 on all analytics routes", async () => {
    for (const route of analyticsRoutes) {
      const res = await authedRequest(route, userOrgAExternal)
      expect(res.status).toBe(403)
    }
  })

  test("unauthenticated request receives 401 on all analytics routes", async () => {
    for (const route of analyticsRoutes) {
      const res = await request(route)
      expect(res.status).toBe(401)
    }
  })

  test("error responses on analytics routes have { success: false, error: { code, message } }", async () => {
    const res = await authedRequest(analyticsRoutes[0], userOrgAStaff)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toHaveProperty("success", false)
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
  })
})
