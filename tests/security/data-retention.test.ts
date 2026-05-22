import { mock } from "bun:test"

// Mock Stripe — not under test here
mock.module("stripe", () => ({
  default: class {
    subscriptions = { cancel: mock(() => Promise.resolve({ status: "canceled" })) }
  },
}))

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { runQueryLogPurge } from "../../workers/retention"
import { cancelOrgSubscription, deleteOrgData } from "../../services/payments"
import { seedDb, clearDb, authedRequest } from "../helpers/setup"
import {
  ORG_A_ID,
  ORG_FREE_ID,
  userOrgAAdmin,
  userOrgAStaff,
  userOrgFreeAdmin,
} from "../helpers/fixtures"

// Reference date used as "now" in all retention tests — makes date arithmetic deterministic
const NOW = new Date("2026-05-19T00:00:00Z")
const DAYS_91_AGO = new Date("2026-02-17T00:00:00Z") // 91 days before NOW
const DAYS_89_AGO = new Date("2026-02-19T00:00:00Z") // 89 days before NOW
const DAYS_31_AGO = new Date("2026-04-18T00:00:00Z") // 31 days before NOW — past quarantine
const DAYS_29_AGO = new Date("2026-04-20T00:00:00Z") // 29 days before NOW — still in quarantine

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── 90-day query log purge ───────────────────────────────────────────────────

describe("data retention — 90-day query log purge", () => {
  test("query logs older than 90 days are purged by the retention worker", async () => {
    const result = await runQueryLogPurge({ referenceDate: NOW })

    expect(result.success).toBe(true)
    expect(result.data.purged_count).toBeGreaterThan(0)

    // Verify purged logs are gone: query history endpoint should not include them
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    const queries: Array<{ created_at: string }> = body.data ?? []
    queries.forEach(q => {
      const age = NOW.getTime() - new Date(q.created_at).getTime()
      const ageDays = age / (1000 * 60 * 60 * 24)
      expect(ageDays).toBeLessThanOrEqual(90)
    })
  })

  test("query logs newer than 90 days are NOT purged", async () => {
    const result = await runQueryLogPurge({ referenceDate: NOW })

    expect(result.success).toBe(true)

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/queries`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Queries seeded at DAYS_89_AGO should still be present
    const recent = body.data?.filter((q: { created_at: string }) => {
      const age = NOW.getTime() - new Date(q.created_at).getTime()
      return age / (1000 * 60 * 60 * 24) <= 90
    })
    expect(recent?.length).toBeGreaterThan(0)
  })

  test("purge is scoped per org — org B logs are not affected by org A purge", async () => {
    const before = await authedRequest(`/api/v1/orgs/test-org-b/queries`, {
      id: "user-b-admin", org_id: "test-org-b", role: "org_admin", email: "admin@orgb.test",
    })
    const beforeCount: number = (await before.json()).data?.length ?? 0

    await runQueryLogPurge({ referenceDate: NOW, orgId: ORG_A_ID })

    const after = await authedRequest(`/api/v1/orgs/test-org-b/queries`, {
      id: "user-b-admin", org_id: "test-org-b", role: "org_admin", email: "admin@orgb.test",
    })
    const afterCount: number = (await after.json()).data?.length ?? 0

    expect(afterCount).toBe(beforeCount)
  })

  test("purge result returns the count of records deleted", async () => {
    const result = await runQueryLogPurge({ referenceDate: NOW })
    expect(result.success).toBe(true)
    expect(typeof result.data.purged_count).toBe("number")
    expect(result.data.purged_count).toBeGreaterThanOrEqual(0)
  })

  test("running purge twice does not error on the second run (idempotent)", async () => {
    const first  = await runQueryLogPurge({ referenceDate: NOW })
    const second = await runQueryLogPurge({ referenceDate: NOW })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.data.purged_count).toBe(0) // nothing left to purge
  })

  test("analytics export does not include queries that have been purged", async () => {
    await runQueryLogPurge({ referenceDate: NOW })

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const text = await res.text()

    // The export CSV/JSON should not include rows with created_at older than 90 days
    // We check by ensuring no timestamp from before the purge window appears
    expect(text).not.toContain(DAYS_91_AGO.toISOString().slice(0, 10))
  })
})

// ─── 30-day org quarantine on cancellation ────────────────────────────────────

describe("data retention — 30-day quarantine on subscription cancellation", () => {
  test("cancelling a subscription immediately makes org data inaccessible", async () => {
    await cancelOrgSubscription({ orgId: ORG_A_ID, cancelledAt: NOW })

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    expect([403, 402, 410]).toContain(res.status)
  })

  test("org users cannot query knowledge base during quarantine", async () => {
    await cancelOrgSubscription({ orgId: ORG_A_ID, cancelledAt: NOW })

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/query`, userOrgAStaff, {
      method: "POST",
      body: { query: "anything" },
    })
    expect([403, 402, 410]).toContain(res.status)
  })

  test("org data is permanently deleted after 30-day quarantine period", async () => {
    // Simulate cancellation 31 days ago and then run the deletion job
    await cancelOrgSubscription({ orgId: ORG_FREE_ID, cancelledAt: DAYS_31_AGO })
    const result = await deleteOrgData({ referenceDate: NOW })

    expect(result.success).toBe(true)
    expect(result.data.deleted_org_ids).toContain(ORG_FREE_ID)

    // All routes for the deleted org should now return 404
    const res = await authedRequest(`/api/v1/orgs/${ORG_FREE_ID}/documents`, userOrgFreeAdmin)
    expect(res.status).toBe(404)
  })

  test("org still in quarantine (< 30 days) is NOT permanently deleted", async () => {
    await cancelOrgSubscription({ orgId: ORG_A_ID, cancelledAt: DAYS_29_AGO })
    const result = await deleteOrgData({ referenceDate: NOW })

    expect(result.success).toBe(true)
    expect(result.data.deleted_org_ids).not.toContain(ORG_A_ID)
  })

  test("permanent deletion removes all associated users, documents, and chunks", async () => {
    await cancelOrgSubscription({ orgId: ORG_FREE_ID, cancelledAt: DAYS_31_AGO })
    const result = await deleteOrgData({ referenceDate: NOW })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      deleted_org_ids:    expect.arrayContaining([ORG_FREE_ID]),
      deleted_user_count: expect.any(Number),
      deleted_doc_count:  expect.any(Number),
      deleted_chunk_count: expect.any(Number),
    })
    expect(result.data.deleted_user_count).toBeGreaterThan(0)
  })

  test("deletion job is idempotent — running it twice does not error", async () => {
    await cancelOrgSubscription({ orgId: ORG_FREE_ID, cancelledAt: DAYS_31_AGO })
    const first  = await deleteOrgData({ referenceDate: NOW })
    const second = await deleteOrgData({ referenceDate: NOW })
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.data.deleted_org_ids).not.toContain(ORG_FREE_ID) // already gone
  })

  test("cancellation quarantine does not affect other orgs", async () => {
    await cancelOrgSubscription({ orgId: ORG_FREE_ID, cancelledAt: DAYS_31_AGO })
    await deleteOrgData({ referenceDate: NOW })

    // Org A should still be accessible
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/documents`, userOrgAAdmin)
    expect(res.status).toBe(200)
  })

  test("cancellation and deletion result never exposes internal error details to the caller", async () => {
    const result = await cancelOrgSubscription({ orgId: "nonexistent-org", cancelledAt: NOW })
    if (!result.success) {
      expect(result.error).toHaveProperty("code")
      expect(result.error).toHaveProperty("message")
      expect(JSON.stringify(result)).not.toMatch(/at Object\.|at async|\.ts:\d+/)
    }
  })
})

// ─── Audit log retention ──────────────────────────────────────────────────────

describe("data retention — audit log retention", () => {
  test("audit logs are not purged by the 90-day query log purge worker", async () => {
    const beforeRes = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    const beforeBody = await beforeRes.json()
    const auditCountBefore: number = beforeBody.data?.audit_logs?.length ?? 0

    await runQueryLogPurge({ referenceDate: NOW })

    const afterRes = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    const afterBody = await afterRes.json()
    const auditCountAfter: number = afterBody.data?.audit_logs?.length ?? 0

    expect(auditCountAfter).toBe(auditCountBefore)
  })

  test("audit logs older than 90 days remain accessible after query purge", async () => {
    await runQueryLogPurge({ referenceDate: NOW })

    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/analytics/export`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Audit logs seeded at DAYS_91_AGO should still be present
    const old = (body.data?.audit_logs ?? []).filter((log: { created_at: string }) => {
      return new Date(log.created_at) <= DAYS_91_AGO
    })
    expect(old.length).toBeGreaterThan(0)
  })
})
