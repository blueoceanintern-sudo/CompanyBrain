import { mock } from "bun:test"

mock.module("stripe", () => ({
  default: class {
    subscriptions = {
      create:   mock(() => Promise.resolve({ id: "sub_plan_test", status: "active" })),
      cancel:   mock(() => Promise.resolve({ id: "sub_plan_test", status: "canceled" })),
      retrieve: mock(() => Promise.resolve({ id: "sub_plan_test", status: "active" })),
    }
    webhooks = { constructEvent: mock((p: string) => JSON.parse(p)) }
  },
}))

mock.module("openai", () => ({
  default: class {
    embeddings = {
      create: mock(() => Promise.resolve({ data: [{ embedding: new Array(1536).fill(0.1) }] })),
    }
  },
}))

mock.module("../../../services/synthesis", () => ({
  synthesize: mock(() =>
    Promise.resolve({
      success: true as const,
      data: { answer: "mocked", citations: [], confidence: 0.9, missing: [] },
    })
  ),
}))

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../helpers/setup"
import {
  ORG_A_ID,
  ORG_FREE_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgAExternal,
  userOrgFreeAdmin,
  compartmentAHr,
} from "../helpers/fixtures"

const VALID_PDF = Buffer.from("%PDF-1.4 plan enforcement test content")

function makePdfForm(accessTier: string): FormData {
  const form = new FormData()
  form.append("file", new Blob([VALID_PDF], { type: "application/pdf" }), "test.pdf")
  form.append("source_type", "faq")
  form.append("access_tier", accessTier)
  form.append("compartment_id", compartmentAHr.id)
  return form
}

// Simulate a Stripe webhook that changes an org's plan state
async function sendWebhookEvent(type: string, eventId: string, customerId: string): Promise<void> {
  const payload = JSON.stringify({
    id: eventId,
    type,
    data: { object: { id: "sub_plan_test", customer: customerId, status: "canceled" } },
  })
  await request("/api/v1/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": `t=${Date.now()},v1=mock`, "Content-Type": "application/json" },
    body: JSON.parse(payload),
  })
}

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── Free tier — external plane locked ────────────────────────────────────────

describe("plan enforcement — free tier cannot use external plane", () => {
  test("free org cannot upload a document with access_tier: external", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: makePdfForm("external"),
    })
    expect([402, 403]).toContain(res.status)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test("free org can upload a document with access_tier: internal", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: makePdfForm("internal"),
    })
    // Should succeed or fail with a non-plan-related error (e.g. ingestion failure)
    expect([201, 400, 500]).toContain(res.status)
    if (res.status === 201) {
      const body = await res.json()
      expect(body.data.access_tier).toBe("internal")
    }
  })

  test("free org query returns 402/403 when access_tier: external is requested", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/query`, userOrgFreeAdmin, {
      method: "POST",
      body: { query: "client FAQ", access_tier: "external" },
    })
    expect([402, 403]).toContain(res.status)
  })

  test("free org query on internal plane is allowed", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/query`, userOrgFreeAdmin, {
      method: "POST",
      body: { query: "internal policy", access_tier: "internal" },
    })
    // Should proceed — 200 even if "I don't know" (no internal chunks seeded for free org)
    expect(res.status).toBe(200)
  })

  test("free org cannot serve external queries via external_client user", async () => {
    // An external_client belongs to the free org — even they cannot trigger external retrieval
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/query`, {
      id: "user-free-external",
      org_id: ORG_FREE_ID,
      email: "client@orgfree.test",
      role: "external_client",
    }, {
      method: "POST",
      body: { query: "public FAQ content" },
    })
    expect([402, 403]).toContain(res.status)
  })

  test("plan lock error response shape is { success: false, error: { code, message } }", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: makePdfForm("external"),
    })
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toHaveProperty("code")
    expect(body.error).toHaveProperty("message")
    expect(body).not.toHaveProperty("stack")
  })
})

// ─── Paid tier — external plane accessible ────────────────────────────────────

describe("plan enforcement — paid tier can use external plane", () => {
  test("paid org admin can upload an external-tier document", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin, {
      method: "POST",
      body: makePdfForm("external"),
    })
    expect([201, 200]).toContain(res.status)
    if (res.status === 201) {
      const body = await res.json()
      expect(body.data.access_tier).toBe("external")
    }
  })

  test("paid org external_client can query the external plane", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAExternal, {
      method: "POST",
      body: { query: "what are the client FAQs" },
    })
    expect(res.status).toBe(200)
  })

  test("paid org GET /subscriptions returns status: active", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    const body = await res.json()
    expect(body.data.status).toBe("active")
    expect(body.data.plan).toBe("paid")
  })
})

// ─── Plan transition: paid → cancelled ────────────────────────────────────────

describe("plan enforcement — subscription cancellation locks the org", () => {
  test("after subscription.deleted webhook, org documents are inaccessible", async () => {
    // Simulate Stripe cancellation event for org A
    await sendWebhookEvent("customer.subscription.deleted", "evt_cancel_orga_001", "cus_test_a")

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    expect([402, 403, 410]).toContain(res.status)
  })

  test("after cancellation, org queries return 402/403/410 — not 200", async () => {
    await sendWebhookEvent("customer.subscription.deleted", "evt_cancel_orga_002", "cus_test_a")

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "anything" },
    })
    expect([402, 403, 410]).toContain(res.status)
  })

  test("cancellation lockout applies to all roles — not just external_client", async () => {
    await sendWebhookEvent("customer.subscription.deleted", "evt_cancel_orga_003", "cus_test_a")

    const roles = [userOrgAAdmin, userOrgAStaff, userOrgAExternal]
    for (const user of roles) {
      const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, user, {
        method: "POST",
        body: { query: "test" },
      })
      expect([402, 403, 410]).toContain(res.status)
    }
  })

  test("GET /subscriptions after cancellation shows status: canceled or quarantined", async () => {
    await sendWebhookEvent("customer.subscription.deleted", "evt_cancel_orga_004", "cus_test_a")

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    if (res.status === 200) {
      const body = await res.json()
      expect(["canceled", "quarantined"]).toContain(body.data.status)
    } else {
      expect([402, 403, 410]).toContain(res.status)
    }
  })

  test("cancellation of org A does not lock org B", async () => {
    await sendWebhookEvent("customer.subscription.deleted", "evt_cancel_orga_005", "cus_test_a")

    const res = await authedRequest(`/api/v1/orgs/test-org-b/query`, {
      id: "user-b-staff", org_id: "test-org-b", email: "staff@orgb.test", role: "staff",
    }, {
      method: "POST",
      body: { query: "test query for org B" },
    })
    expect(res.status).toBe(200)
  })
})

// ─── Plan transition: free → paid ─────────────────────────────────────────────

describe("plan enforcement — upgrade from free to paid unlocks external plane", () => {
  test("after subscription.created webhook, free org can upload external documents", async () => {
    const upgradePayload = JSON.stringify({
      id: "evt_upgrade_free_001",
      type: "customer.subscription.created",
      data: { object: { id: "sub_new_free", customer: "cus_test_free", status: "active" } },
    })
    await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": `t=${Date.now()},v1=mock`, "Content-Type": "application/json" },
      body: JSON.parse(upgradePayload),
    })

    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: makePdfForm("external"),
    })
    expect([201, 200]).toContain(res.status)
    if (res.status === 201) {
      const body = await res.json()
      expect(body.success).toBe(true)
    }
  })

  test("GET /subscriptions after upgrade shows plan: paid and status: active", async () => {
    const upgradePayload = JSON.stringify({
      id: "evt_upgrade_free_002",
      type: "customer.subscription.created",
      data: { object: { id: "sub_new_free_2", customer: "cus_test_free", status: "active" } },
    })
    await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": `t=${Date.now()},v1=mock`, "Content-Type": "application/json" },
      body: JSON.parse(upgradePayload),
    })

    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin)
    const body = await res.json()
    expect(body.data.plan).toBe("paid")
    expect(body.data.status).toBe("active")
  })
})
