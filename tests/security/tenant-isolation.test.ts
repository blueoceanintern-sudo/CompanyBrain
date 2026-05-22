import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, makeAuthHeader, authedRequest, request } from "../helpers/setup"
import {
  ORG_A_ID,
  ORG_B_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgBAdmin,
  documentOrgB,
  chunkOrgB,
} from "../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

describe("tenant isolation — documents", () => {
  test("org A admin cannot list org B documents", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/documents`, userOrgAAdmin)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test("org A staff cannot upload a document to org B", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/documents`, userOrgAStaff, {
      method: "POST",
      body: { filename: "injected.pdf", access_tier: "internal", source_type: "sop", compartment_id: "comp-b-ops" },
    })
    expect(res.status).toBe(403)
  })

  test("org A admin cannot patch an org B document", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_B_ID}/documents/${documentOrgB.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { access_tier: "external" } }
    )
    expect(res.status).toBe(403)
  })

  test("org A admin cannot delete an org B document", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_B_ID}/documents/${documentOrgB.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )
    expect(res.status).toBe(403)
  })

  test("org A document list never contains org B documents", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    const docs: Array<{ org_id: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.org_id).toBe(ORG_A_ID))
  })
})

describe("tenant isolation — query", () => {
  test("org A user cannot post to org B query endpoint", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/query`, userOrgAAdmin, {
      method: "POST",
      body: { query: "anything" },
    })
    expect(res.status).toBe(403)
  })

  test("org A query result citations are all scoped to org A", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "internal sop content org b" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citations: Array<{ org_id: string }> = body.data?.citations ?? []
    citations.forEach(c => expect(c.org_id).toBe(ORG_A_ID))
  })

  test("org A user cannot view org B query history", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/queries`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A query history only contains org A records", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    const queries: Array<{ org_id: string }> = body.data ?? []
    queries.forEach(q => expect(q.org_id).toBe(ORG_A_ID))
  })
})

describe("tenant isolation — admin routes", () => {
  test("org A admin cannot list org B compartments", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/compartments`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A admin cannot create a compartment in org B", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/compartments`, userOrgAAdmin, {
      method: "POST",
      body: { name: "Injected", description: "cross-org write attempt" },
    })
    expect(res.status).toBe(403)
  })

  test("org A admin cannot list org B users", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/users`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A admin cannot invite a user into org B", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "attacker@evil.test", role: "staff" },
    })
    expect(res.status).toBe(403)
  })

  test("org A admin cannot change a role in org B", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_B_ID}/users/${userOrgBAdmin.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "staff" } }
    )
    expect(res.status).toBe(403)
  })
})

describe("tenant isolation — analytics and audit", () => {
  test("org A admin cannot view org B analytics overview", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/analytics/overview`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A admin cannot view org B top unanswered queries", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/analytics/queries`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A admin cannot export org B audit log", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })
})

describe("tenant isolation — payments", () => {
  test("org A admin cannot view org B subscription", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/subscriptions`, userOrgAAdmin)
    expect(res.status).toBe(403)
  })

  test("org A admin cannot create a subscription for org B", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/subscriptions`, userOrgAAdmin, {
      method: "POST",
      body: { plan: "paid" },
    })
    expect(res.status).toBe(403)
  })
})

describe("tenant isolation — edge cases", () => {
  test("unauthenticated request is rejected on every route", async () => {
    const routes = [
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/documents` },
      { method: "POST", path: `/api/v1/orgs/${ORG_A_ID}/query` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/queries` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/compartments` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/users` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/analytics/overview` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/subscriptions` },
    ]
    for (const route of routes) {
      const res = await request(route.path, { method: route.method })
      expect(res.status).toBe(401)
    }
  })

  test("malformed auth token is rejected on all routes", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/documents`, {
      headers: { Authorization: "Bearer not.a.valid.token" },
    })
    expect(res.status).toBe(401)
  })

  test("token from org A is rejected when path specifies org B", async () => {
    // Token is valid but bound to org A — must not grant access to org B paths
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/documents`, userOrgAAdmin)
    expect([401, 403]).toContain(res.status)
  })

  test("non-existent org in path returns 404 not a 500", async () => {
    const res = await authedRequest("/api/v1/orgs/does-not-exist/documents", userOrgAAdmin)
    expect(res.status).toBe(404)
  })

  test("SQL injection in org_id path param does not cause a 500", async () => {
    const res = await authedRequest(
      "/api/v1/orgs/'; DROP TABLE orgs; --/documents",
      userOrgAAdmin
    )
    expect([400, 404]).toContain(res.status)
  })

  test("error responses never expose stack traces or raw DB errors", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_B_ID}/documents`, userOrgAAdmin)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toHaveProperty("success", false)
    expect(body).toHaveProperty("error")
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
    expect(JSON.stringify(body)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
  })

  test("path with valid doc ID from wrong org returns 403 not the document", async () => {
    // Org B's doc ID used against org B's route, but with org A token
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_B_ID}/documents/${documentOrgB.id}`,
      userOrgAAdmin
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    // Must not leak any of org B's document data
    expect(JSON.stringify(body)).not.toContain(chunkOrgB.content)
    expect(JSON.stringify(body)).not.toContain(ORG_B_ID)
  })
})
