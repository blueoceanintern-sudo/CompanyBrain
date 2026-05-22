import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../helpers/setup"
import {
  ORG_A_ID,
  ORG_FREE_ID,
  userOrgAAdmin,
  userOrgADeptAdmin,
  userOrgAStaff,
  userOrgAExternal,
  userOrgFreeAdmin,
  documentOrgAInternal,
  chunkOrgARestricted,
  chunkNullVisibility,
  chunkEmptyAllowedGroups,
  chunkOrgAInternal,
} from "../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

describe("access control — role-based route access", () => {
  test("staff cannot list documents (admin-only route)", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("staff cannot upload a document", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAStaff, {
      method: "POST",
      body: { filename: "test.pdf", access_tier: "internal", source_type: "sop", compartment_id: "comp-a-hr" },
    })
    expect(res.status).toBe(403)
  })

  test("staff cannot access analytics", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("staff cannot export the audit log", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("staff cannot list users", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("staff cannot invite users", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAStaff, {
      method: "POST",
      body: { email: "new@orga.test", role: "staff" },
    })
    expect(res.status).toBe(403)
  })

  test("staff cannot create a compartment", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAStaff, {
      method: "POST",
      body: { name: "Rogue", description: "should not be created" },
    })
    expect(res.status).toBe(403)
  })

  test("staff cannot change their own role", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAStaff,
      { method: "PATCH", body: { role: "org_admin" } }
    )
    expect(res.status).toBe(403)
  })

  test("staff cannot change another user's role", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAExternal.id}/role`,
      userOrgAStaff,
      { method: "PATCH", body: { role: "org_admin" } }
    )
    expect(res.status).toBe(403)
  })

  test("dept_admin cannot access another compartment's documents", async () => {
    // dept_admin is scoped to their compartment only
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgADeptAdmin
    )
    // Must be 403 if the document does not belong to dept_admin's compartment
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json()
      expect(body.data.compartment_id).toBe("comp-a-hr") // only their compartment
    }
  })

  test("external_client can submit a query", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAExternal, {
      method: "POST",
      body: { query: "what are the client FAQs" },
    })
    expect(res.status).toBe(200)
  })

  test("external_client cannot list documents", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAExternal)
    expect(res.status).toBe(403)
  })

  test("external_client cannot access analytics", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/overview`, userOrgAExternal)
    expect(res.status).toBe(403)
  })

  test("external_client cannot manage users", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAExternal)
    expect(res.status).toBe(403)
  })
})

describe("access control — access tier enforcement", () => {
  test("external_client query never returns internal-tier chunks", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAExternal, {
      method: "POST",
      body: { query: chunkOrgAInternal.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citations: Array<{ access_tier: string }> = body.data?.citations ?? []
    citations.forEach(c => expect(c.access_tier).toBe("external"))
  })

  test("external_client cannot retrieve an internal document directly", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAExternal
    )
    expect([403, 404]).toContain(res.status)
  })

  test("staff query on external access tier cannot reach internal chunks", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: chunkOrgAInternal.content, access_tier: "external" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citations: Array<{ access_tier: string }> = body.data?.citations ?? []
    citations.forEach(c => expect(c.access_tier).toBe("external"))
  })

  test("internal query by org_admin can reach internal chunks", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAAdmin, {
      method: "POST",
      body: { query: "confidential internal HR policy" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("answer")
  })
})

describe("access control — visibility JSONB enforcement", () => {
  test("staff not in allowedGroups does not receive the restricted chunk", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: chunkOrgARestricted.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citationIds: string[] = (body.data?.citations ?? []).map(
      (c: { chunk_id: string }) => c.chunk_id
    )
    expect(citationIds).not.toContain(chunkOrgARestricted.id)
  })

  test("staff explicitly in deniedGroups cannot receive chunk even if query matches exactly", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "legal compliance restricted" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citationIds: string[] = (body.data?.citations ?? []).map(
      (c: { chunk_id: string }) => c.chunk_id
    )
    expect(citationIds).not.toContain(chunkOrgARestricted.id)
  })

  test("org_admin in allowedGroups can receive the restricted chunk", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAAdmin, {
      method: "POST",
      body: { query: chunkOrgARestricted.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("answer")
  })

  test("chunk with null visibility policy is never returned to staff", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: chunkNullVisibility.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citationIds: string[] = (body.data?.citations ?? []).map(
      (c: { chunk_id: string }) => c.chunk_id
    )
    expect(citationIds).not.toContain(chunkNullVisibility.id)
  })

  test("chunk with null visibility policy is never returned to external_client", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAExternal, {
      method: "POST",
      body: { query: chunkNullVisibility.content },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const citationIds: string[] = (body.data?.citations ?? []).map(
      (c: { chunk_id: string }) => c.chunk_id
    )
    expect(citationIds).not.toContain(chunkNullVisibility.id)
  })

  test("chunk with empty allowedGroups and no allowedPrincipals is inaccessible to all", async () => {
    const roles = [userOrgAAdmin, userOrgAStaff, userOrgAExternal]
    for (const user of roles) {
      const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, user, {
        method: "POST",
        body: { query: chunkEmptyAllowedGroups.content },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      const citationIds: string[] = (body.data?.citations ?? []).map(
        (c: { chunk_id: string }) => c.chunk_id
      )
      expect(citationIds).not.toContain(chunkEmptyAllowedGroups.id)
    }
  })
})

describe("access control — plan enforcement", () => {
  test("free org cannot upload a document with external access tier", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: { filename: "test.pdf", access_tier: "external", source_type: "faq", compartment_id: "comp-free-1" },
    })
    expect([402, 403]).toContain(res.status)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test("free org query cannot surface external-tier chunks", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/query`, userOrgFreeAdmin, {
      method: "POST",
      body: { query: "client-facing FAQ", access_tier: "external" },
    })
    expect([402, 403]).toContain(res.status)
  })
})

describe("access control — edge cases", () => {
  test("all protected routes return 401 with no auth header", async () => {
    const protectedRoutes = [
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/documents` },
      { method: "POST", path: `/api/v1/orgs/${ORG_A_ID}/query` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/users` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/compartments` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/analytics/overview` },
      { method: "GET",  path: `/api/v1/orgs/${ORG_A_ID}/subscriptions` },
    ]
    for (const route of protectedRoutes) {
      const res = await request(route.path, { method: route.method })
      expect(res.status).toBe(401)
    }
  })

  test("error body on 401 is always { success, error: { code, message } } never a raw error", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/documents`, {
      headers: { Authorization: "Bearer invalid-token-here" },
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty("success", false)
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
  })

  test("error body on 403 is always { success, error: { code, message } } never a raw error", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAStaff)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toHaveProperty("success", false)
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
  })

  test("query with excessively long string does not cause a 500", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "a".repeat(10_000) },
    })
    expect(res.status).not.toBe(500)
  })

  test("query with empty string body returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "" },
    })
    expect(res.status).toBe(400)
  })

  test("query with missing query field returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: {},
    })
    expect(res.status).toBe(400)
  })

  test("response never leaks chunk content from a denied visibility policy", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: chunkOrgARestricted.content },
    })
    expect(res.status).toBe(200)
    const raw = await res.text()
    expect(raw).not.toContain(chunkOrgARestricted.content)
    expect(raw).not.toContain(chunkOrgARestricted.id)
  })
})
