import { mock } from "bun:test"

// Mock embedding and ingestion pipeline — not under test at the API layer
mock.module("openai", () => ({
  default: class {
    embeddings = {
      create: mock(() => Promise.resolve({ data: [{ embedding: new Array(1536).fill(0.1) }] })),
    }
  },
}))

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgADeptAdmin,
  userOrgAStaff,
  userOrgAExternal,
  compartmentAHr,
  compartmentALegal,
  documentOrgAInternal,
  documentOrgAExternal,
} from "../../helpers/fixtures"

// Minimal valid PDF buffer for upload tests
const VALID_PDF = Buffer.from("%PDF-1.4 test document content for api tests")

function makePdfForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  form.append("file", new Blob([VALID_PDF], { type: "application/pdf" }), "test.pdf")
  form.append("source_type", overrides.source_type ?? "sop")
  form.append("access_tier", overrides.access_tier ?? "internal")
  form.append("compartment_id", overrides.compartment_id ?? compartmentAHr.id)
  return form
}

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── Upload (POST) ────────────────────────────────────────────────────────────

describe("POST /orgs/:id/documents — upload", () => {
  test("admin can upload a document and receives 201 with document data", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      headers: {},                    // FormData sets Content-Type with boundary
      body: makePdfForm(),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("id")
    expect(body.data).toHaveProperty("status")
    expect(body.data.org_id).toBe(ORG_A_ID)
  })

  test("upload response includes a job_id for tracking ingestion progress", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm(),
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("job_id")
  })

  test("newly uploaded document has status 'processing' immediately after upload", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm(),
    })
    const body = await res.json()
    expect(["processing", "queued"]).toContain(body.data.status)
  })

  test("uploaded document is tagged with correct org_id, compartment_id, access_tier", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm({ compartment_id: compartmentALegal.id, access_tier: "external" }),
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.org_id).toBe(ORG_A_ID)
    expect(body.data.compartment_id).toBe(compartmentALegal.id)
    expect(body.data.access_tier).toBe("external")
  })

  test("staff cannot upload a document — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAStaff, {
      method: "POST",
      body: makePdfForm(),
    })
    expect(res.status).toBe(403)
  })

  test("external_client cannot upload a document — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAExternal, {
      method: "POST",
      body: makePdfForm(),
    })
    expect(res.status).toBe(403)
  })

  test("upload with no file returns 400", async () => {
    const form = new FormData()
    form.append("source_type", "sop")
    form.append("access_tier", "internal")
    form.append("compartment_id", compartmentAHr.id)

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: form,
    })
    expect(res.status).toBe(400)
  })

  test("upload with missing source_type returns 400", async () => {
    const form = new FormData()
    form.append("file", new Blob([VALID_PDF], { type: "application/pdf" }), "test.pdf")
    form.append("access_tier", "internal")
    form.append("compartment_id", compartmentAHr.id)

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: form,
    })
    expect(res.status).toBe(400)
  })

  test("upload with invalid access_tier value returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm({ access_tier: "ultra_secret" }),
    })
    expect(res.status).toBe(400)
  })

  test("upload with invalid source_type value returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm({ source_type: "blog_post" }),
    })
    expect(res.status).toBe(400)
  })

  test("upload of unsupported file type returns 400", async () => {
    const form = new FormData()
    form.append("file", new Blob(["<html></html>"], { type: "text/html" }), "page.html")
    form.append("source_type", "sop")
    form.append("access_tier", "internal")
    form.append("compartment_id", compartmentAHr.id)

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: form,
    })
    expect(res.status).toBe(400)
  })
})

// ─── List (GET) ────────────────────────────────────────────────────────────────

describe("GET /orgs/:id/documents — list", () => {
  test("admin receives 200 with a paginated list of documents", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body).toHaveProperty("pagination")
  })

  test("default page size is 25", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    const body = await res.json()
    expect(body.pagination.per_page).toBe(25)
  })

  test("all returned documents belong to the scoped org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    const body = await res.json()
    const docs: Array<{ org_id: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.org_id).toBe(ORG_A_ID))
  })

  test("filtering by access_tier=internal returns only internal documents", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents?access_tier=internal`,
      userOrgAAdmin
    )
    const body = await res.json()
    const docs: Array<{ access_tier: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.access_tier).toBe("internal"))
  })

  test("filtering by access_tier=external returns only external documents", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents?access_tier=external`,
      userOrgAAdmin
    )
    const body = await res.json()
    const docs: Array<{ access_tier: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.access_tier).toBe("external"))
  })

  test("filtering by compartment_id returns only documents in that compartment", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents?compartment_id=${compartmentAHr.id}`,
      userOrgAAdmin
    )
    const body = await res.json()
    const docs: Array<{ compartment_id: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.compartment_id).toBe(compartmentAHr.id))
  })

  test("filtering by status=active excludes archived documents", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents?status=active`,
      userOrgAAdmin
    )
    const body = await res.json()
    const docs: Array<{ status: string }> = body.data ?? []
    docs.forEach(doc => expect(doc.status).toBe("active"))
  })

  test("page=2 returns different results than page=1 (when enough docs exist)", async () => {
    const page1Res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents?page=1`, userOrgAAdmin)
    const page2Res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents?page=2`, userOrgAAdmin)

    const page1Body = await page1Res.json()
    const page2Body = await page2Res.json()

    if (page2Body.data.length > 0) {
      const page1Ids = new Set(page1Body.data.map((d: { id: string }) => d.id))
      page2Body.data.forEach((doc: { id: string }) => {
        expect(page1Ids.has(doc.id)).toBe(false)
      })
    }
  })

  test("staff cannot list documents — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("unauthenticated request returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/documents`)
    expect(res.status).toBe(401)
  })
})

// ─── Update (PATCH) ────────────────────────────────────────────────────────────

describe("PATCH /orgs/:id/documents/:docId — update", () => {
  test("admin can move a document to a different compartment", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { compartment_id: compartmentALegal.id } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.compartment_id).toBe(compartmentALegal.id)
  })

  test("admin can update access_tier of a document", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAExternal.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { access_tier: "internal" } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.access_tier).toBe("internal")
  })

  test("patching with invalid access_tier value returns 400", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { access_tier: "top_secret" } }
    )
    expect(res.status).toBe(400)
  })

  test("patching with a compartment_id from a different org returns 400 or 404", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { compartment_id: "comp-b-ops" } }
    )
    expect([400, 404]).toContain(res.status)
  })

  test("staff cannot patch a document — returns 403", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAStaff,
      { method: "PATCH", body: { compartment_id: compartmentALegal.id } }
    )
    expect(res.status).toBe(403)
  })

  test("patching a non-existent document returns 404", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/does-not-exist`,
      userOrgAAdmin,
      { method: "PATCH", body: { compartment_id: compartmentAHr.id } }
    )
    expect(res.status).toBe(404)
  })
})

// ─── Delete (soft-delete) ─────────────────────────────────────────────────────

describe("DELETE /orgs/:id/documents/:docId — soft delete", () => {
  test("admin can soft-delete a document — returns 200", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  test("deleted document has status 'archived' not physically removed", async () => {
    await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )

    // Fetch with status=archived filter — document should appear there
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents?status=archived`,
      userOrgAAdmin
    )
    const body = await res.json()
    const archived = body.data.find((d: { id: string }) => d.id === documentOrgAInternal.id)
    expect(archived).toBeDefined()
    expect(archived.status).toBe("archived")
  })

  test("archived document does not appear in default list (status=active)", async () => {
    await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    const body = await res.json()
    const deleted = body.data.find((d: { id: string }) => d.id === documentOrgAInternal.id)
    expect(deleted).toBeUndefined()
  })

  test("staff cannot delete a document — returns 403", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAInternal.id}`,
      userOrgAStaff,
      { method: "DELETE" }
    )
    expect(res.status).toBe(403)
  })

  test("deleting a non-existent document returns 404", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/does-not-exist`,
      userOrgAAdmin,
      { method: "DELETE" }
    )
    expect(res.status).toBe(404)
  })

  test("deleting the same document twice returns 404 on the second call", async () => {
    await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAExternal.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )
    const second = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/documents/${documentOrgAExternal.id}`,
      userOrgAAdmin,
      { method: "DELETE" }
    )
    expect(second.status).toBe(404)
  })
})
