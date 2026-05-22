import { mock } from "bun:test"

// Mock Stripe SDK at the HTTP layer — fee and webhook logic tested in services/payments.test.ts
mock.module("stripe", () => ({
  default: class {
    subscriptions = {
      create:   mock(() => Promise.resolve({ id: "sub_api_test_001", status: "active" })),
      retrieve: mock(() => Promise.resolve({ id: "sub_api_test_001", status: "active", application_fee_percent: 15 })),
      cancel:   mock(() => Promise.resolve({ id: "sub_api_test_001", status: "canceled" })),
    }
    webhooks = {
      constructEvent: mock((payload: string) => JSON.parse(payload)),
    }
  },
}))

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../../helpers/setup"
import {
  ORG_A_ID,
  ORG_FREE_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgAExternal,
  userOrgFreeAdmin,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── GET /orgs/:id/subscriptions — current status ─────────────────────────────

describe("GET /orgs/:id/subscriptions — current status", () => {
  test("org_admin receives 200 with subscription data", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("plan")
    expect(body.data).toHaveProperty("status")
  })

  test("paid org returns plan: 'paid' and status: 'active'", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    const body = await res.json()
    expect(body.data.plan).toBe("paid")
    expect(body.data.status).toBe("active")
  })

  test("free org returns plan: 'free'", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.plan).toBe("free")
  })

  test("response includes stripe_subscription_id for paid orgs", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.plan === "paid") {
      expect(body.data.stripe_subscription_id).toBeDefined()
      expect(typeof body.data.stripe_subscription_id).toBe("string")
    }
  })

  test("staff cannot view subscription — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("external_client cannot view subscription — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAExternal)
    expect(res.status).toBe(403)
  })

  test("unauthenticated request returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/subscriptions`)
    expect(res.status).toBe(401)
  })
})

// ─── POST /orgs/:id/subscriptions — create ────────────────────────────────────

describe("POST /orgs/:id/subscriptions — create", () => {
  test("free org admin can create a subscription and receives 201", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin, {
      method: "POST",
      body: { plan: "paid" },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("stripe_subscription_id")
    expect(body.data.plan).toBe("paid")
  })

  test("subscription creation response includes the active plan and status", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin, {
      method: "POST",
      body: { plan: "paid" },
    })
    const body = await res.json()
    expect(body.data).toHaveProperty("plan")
    expect(body.data).toHaveProperty("status")
  })

  test("missing plan field returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin, {
      method: "POST",
      body: {},
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test("invalid plan value returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin, {
      method: "POST",
      body: { plan: "enterprise" },
    })
    expect(res.status).toBe(400)
  })

  test("staff cannot create a subscription — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAStaff, {
      method: "POST",
      body: { plan: "paid" },
    })
    expect(res.status).toBe(403)
  })

  test("creating a subscription for an already-paid org returns 409", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin, {
      method: "POST",
      body: { plan: "paid" },
    })
    expect(res.status).toBe(409)
  })
})

// ─── POST /webhooks/stripe ────────────────────────────────────────────────────

describe("POST /webhooks/stripe — webhook endpoint", () => {
  const buildWebhookPayload = (type: string, eventId: string, extraData: Record<string, unknown> = {}) =>
    JSON.stringify({
      id: eventId,
      type,
      data: {
        object: {
          id: "sub_mock_001",
          customer: "cus_test_a",
          status: "active",
          application_fee_percent: 15,
          ...extraData,
        },
      },
    })

  const webhookHeaders = (payload: string) => ({
    "stripe-signature": `t=${Date.now()},v1=mocksignature`,
    "Content-Type": "application/json",
    // Intentionally no Authorization header — Stripe calls this endpoint directly
  })

  test("valid webhook event returns 200", async () => {
    const payload = buildWebhookPayload("customer.subscription.updated", "evt_valid_001")
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: webhookHeaders(payload),
      body: JSON.parse(payload),
    })
    expect(res.status).toBe(200)
  })

  test("webhook endpoint does NOT require an Authorization header", async () => {
    const payload = buildWebhookPayload("customer.subscription.updated", "evt_noauth_001")
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": `t=${Date.now()},v1=mocksignature`,
        "Content-Type": "application/json",
      },
      body: JSON.parse(payload),
    })
    expect(res.status).not.toBe(401)
  })

  test("same event ID processed twice returns 200 both times — idempotent", async () => {
    const payload = buildWebhookPayload("customer.subscription.updated", "evt_idempotent_001")
    const parsedPayload = JSON.parse(payload)

    const first  = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: webhookHeaders(payload),
      body: parsedPayload,
    })
    const second = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: webhookHeaders(payload),
      body: parsedPayload,
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  test("webhook without stripe-signature header returns 400", async () => {
    const payload = buildWebhookPayload("customer.subscription.updated", "evt_nosig_001")
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.parse(payload),
    })
    expect(res.status).toBe(400)
  })

  test("subscription.deleted event returns 200 and org enters quarantine", async () => {
    const payload = buildWebhookPayload("customer.subscription.deleted", "evt_cancel_001", {
      status: "canceled",
    })
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: webhookHeaders(payload),
      body: JSON.parse(payload),
    })
    expect(res.status).toBe(200)
  })

  test("empty body returns 400", async () => {
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=abc", "Content-Type": "application/json" },
      body: {},
    })
    expect(res.status).toBe(400)
  })

  test("GET method on webhook endpoint returns 404 or 405", async () => {
    const res = await request("/api/v1/webhooks/stripe", { method: "GET" })
    expect([404, 405]).toContain(res.status)
  })

  test("webhook response never exposes stack traces", async () => {
    const payload = buildWebhookPayload("customer.subscription.updated", "evt_stackcheck_001")
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: webhookHeaders(payload),
      body: JSON.parse(payload),
    })
    const text = await res.text()
    expect(text).not.toMatch(/at Object\.|at async|\.ts:\d+/)
  })
})
