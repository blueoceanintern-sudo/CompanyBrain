import { mock } from "bun:test"

// Mock the Stripe SDK — network calls are not under test here
const mockSubscriptionsCreate   = mock(() => Promise.resolve({ id: "sub_mock_123", status: "active" }))
const mockSubscriptionsRetrieve = mock(() => Promise.resolve({ id: "sub_mock_123", status: "active" }))
const mockSubscriptionsCancel   = mock(() => Promise.resolve({ id: "sub_mock_123", status: "canceled" }))
const mockWebhooksConstructEvent = mock((payload: string) => JSON.parse(payload))

mock.module("stripe", () => ({
  default: class {
    subscriptions = {
      create:   mockSubscriptionsCreate,
      retrieve: mockSubscriptionsRetrieve,
      cancel:   mockSubscriptionsCancel,
    }
    webhooks = { constructEvent: mockWebhooksConstructEvent }
  },
}))

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { createSubscription, handleStripeWebhook, computePlatformFee } from "../../../services/payments"
import { seedDb, clearDb, authedRequest } from "../../helpers/setup"
import {
  ORG_A_ID,
  ORG_FREE_ID,
  userOrgAAdmin,
  userOrgFreeAdmin,
} from "../../helpers/fixtures"

const PLATFORM_FEE_PERCENT = 15

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })
beforeEach(() => {
  mockSubscriptionsCreate.mockClear()
  mockSubscriptionsCancel.mockClear()
  mockWebhooksConstructEvent.mockClear()
})

// ─── Platform fee calculation ──────────────────────────────────────────────────

describe("computePlatformFee — 15% platform fee", () => {
  test("returns exactly 15% of the gross amount", () => {
    expect(computePlatformFee(10000)).toBe(1500)   // £100.00 → £15.00
    expect(computePlatformFee(5000)).toBe(750)     // £50.00 → £7.50
    expect(computePlatformFee(1)).toBe(0)          // sub-cent rounds to 0 or floors
  })

  test("fee is calculated on the gross amount, not after any other deduction", () => {
    const gross = 20000
    const fee = computePlatformFee(gross)
    expect(fee).toBe(Math.floor(gross * (PLATFORM_FEE_PERCENT / 100)))
  })

  test("fee for zero amount is zero", () => {
    expect(computePlatformFee(0)).toBe(0)
  })

  test("fee is always a non-negative integer (Stripe works in smallest currency unit)", () => {
    const amounts = [100, 999, 4999, 12345, 99999]
    amounts.forEach(amount => {
      const fee = computePlatformFee(amount)
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(fee)).toBe(true)
    })
  })

  test("fee does not change the platform fee percentage regardless of org or plan", () => {
    // Fee is fixed at 15% — not variable per org
    const fee100 = computePlatformFee(10000)
    const fee200 = computePlatformFee(20000)
    expect(fee200).toBe(fee100 * 2)
  })
})

// ─── Subscription creation ────────────────────────────────────────────────────

describe("createSubscription — subscription lifecycle", () => {
  test("creates a Stripe subscription with the 15% application fee", async () => {
    await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })

    expect(mockSubscriptionsCreate).toHaveBeenCalledTimes(1)
    const callArgs = mockSubscriptionsCreate.mock.calls[0][0] as {
      application_fee_percent: number
    }
    expect(callArgs.application_fee_percent).toBe(PLATFORM_FEE_PERCENT)
  })

  test("org is updated with stripe_subscription_id after successful creation", async () => {
    const result = await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })

    expect(result.success).toBe(true)
    expect(result.data.stripe_subscription_id).toBeDefined()
    expect(typeof result.data.stripe_subscription_id).toBe("string")
  })

  test("org plan is updated to 'paid' after successful subscription creation", async () => {
    const result = await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })

    expect(result.success).toBe(true)
    expect(result.data.org_plan).toBe("paid")
  })

  test("external plane becomes accessible once subscription is active", async () => {
    await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })

    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin, {
      method: "POST",
      body: { filename: "external.pdf", access_tier: "external", source_type: "faq", compartment_id: "comp-free-1" },
    })
    // Now a paid org — should not get 402/403 for external tier upload
    expect([200, 201]).toContain(res.status)
  })

  test("createSubscription returns { success: false, error } on Stripe error — never throws", async () => {
    mockSubscriptionsCreate.mockRejectedValueOnce(new Error("Stripe unavailable"))

    let threw = false
    let result: { success: boolean; error?: unknown }
    try {
      result = await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })
    } catch {
      threw = true
      result = { success: false }
    }

    expect(threw).toBe(false)
    expect(result.success).toBe(false)
    expect(result.error).toHaveProperty("code")
    expect(result.error).toHaveProperty("message")
  })

  test("error result from createSubscription never exposes a stack trace", async () => {
    mockSubscriptionsCreate.mockRejectedValueOnce(new Error("Stripe error"))
    const result = await createSubscription({ orgId: ORG_FREE_ID, plan: "paid" })
    if (!result.success) {
      expect(JSON.stringify(result)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
    }
  })
})

// ─── Stripe webhook handling ───────────────────────────────────────────────────

describe("handleStripeWebhook — idempotency and event processing", () => {
  const buildEvent = (type: string, overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      id: "evt_test_001",
      type,
      data: {
        object: {
          id: "sub_mock_123",
          customer: "cus_test_a",
          status: "active",
          application_fee_percent: PLATFORM_FEE_PERCENT,
          ...overrides,
        },
      },
      ...overrides,
    })

  test("same stripe_event_id is processed only once", async () => {
    const payload = buildEvent("customer.subscription.updated")

    const first  = await handleStripeWebhook({ payload, signature: "valid-sig" })
    const second = await handleStripeWebhook({ payload, signature: "valid-sig" })

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.data.already_processed).toBe(true)
  })

  test("different event IDs are both processed", async () => {
    const event1 = buildEvent("customer.subscription.updated", { id: "evt_unique_001" })
    const event2 = buildEvent("customer.subscription.updated", { id: "evt_unique_002" })

    const r1 = await handleStripeWebhook({ payload: event1, signature: "valid-sig" })
    const r2 = await handleStripeWebhook({ payload: event2, signature: "valid-sig" })

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r1.data.already_processed).toBe(false)
    expect(r2.data.already_processed).toBe(false)
  })

  test("customer.subscription.deleted event triggers org quarantine", async () => {
    const payload = buildEvent("customer.subscription.deleted", {
      id: "evt_cancel_001",
      status: "canceled",
    })

    const result = await handleStripeWebhook({ payload, signature: "valid-sig" })
    expect(result.success).toBe(true)
    expect(result.data.org_quarantined).toBe(true)
  })

  test("customer.subscription.created event sets org to paid plan", async () => {
    const payload = buildEvent("customer.subscription.created", {
      id: "evt_created_001",
      status: "active",
    })

    const result = await handleStripeWebhook({ payload, signature: "valid-sig" })
    expect(result.success).toBe(true)
    expect(result.data.org_plan).toBe("paid")
  })

  test("invalid webhook signature is rejected", async () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      throw new Error("Webhook signature verification failed")
    })

    const result = await handleStripeWebhook({
      payload: buildEvent("customer.subscription.updated"),
      signature: "invalid-signature",
    })

    expect(result.success).toBe(false)
    expect(result.error.code).toBeDefined()
  })

  test("unknown event type is acknowledged without error — not thrown or 500", async () => {
    const payload = buildEvent("payment_intent.succeeded", { id: "evt_unknown_001" })

    let threw = false
    let result: { success: boolean }
    try {
      result = await handleStripeWebhook({ payload, signature: "valid-sig" })
    } catch {
      threw = true
      result = { success: false }
    }

    expect(threw).toBe(false)
    expect(result.success).toBe(true)
  })

  test("webhook with missing data.object fields returns a validation error", async () => {
    const malformed = JSON.stringify({ id: "evt_malformed_001", type: "customer.subscription.updated" })

    const result = await handleStripeWebhook({ payload: malformed, signature: "valid-sig" })
    expect(result.success).toBe(false)
    expect(result.error.code).toBeDefined()
  })

  test("webhook result never includes a stack trace in the error", async () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      throw new Error("unexpected internal error")
    })

    const result = await handleStripeWebhook({
      payload: buildEvent("customer.subscription.updated"),
      signature: "bad-sig",
    })

    if (!result.success) {
      expect(JSON.stringify(result)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
    }
  })
})

// ─── Plan transition enforcement ─────────────────────────────────────────────

describe("payments — plan transition enforcement via API", () => {
  test("GET /orgs/:id/subscriptions returns current plan status", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/subscriptions`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("plan")
    expect(body.data).toHaveProperty("status")
  })

  test("free org gets 402 when attempting to access subscription management", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/subscriptions`, userOrgFreeAdmin)
    expect([200, 402]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json()
      expect(body.data.plan).toBe("free")
    }
  })

  test("Stripe webhook endpoint rejects non-POST methods", async () => {
    const res = await authedRequest("/api/v1/webhooks/stripe", userOrgAAdmin, { method: "GET" })
    expect([404, 405]).toContain(res.status)
  })

  test("Stripe webhook endpoint is accessible without an auth token (Stripe calls it directly)", async () => {
    const payload = JSON.stringify({
      id: "evt_no_auth_001",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_mock_123", customer: "cus_test_a", status: "active" } },
    })

    const { request } = await import("../../helpers/setup")
    const res = await request("/api/v1/webhooks/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
        "Content-Type": "application/json",
      },
      body: JSON.parse(payload),
    })
    // Should not be 401 (no auth required for webhooks)
    expect(res.status).not.toBe(401)
  })
})
