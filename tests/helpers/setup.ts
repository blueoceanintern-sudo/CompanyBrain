import type { UserFixture } from "./fixtures"
import {
  ALL_ORGS,
  ALL_USERS,
  ALL_COMPARTMENTS,
  ALL_DOCUMENTS,
  ALL_CHUNKS,
} from "./fixtures"

// Placeholder — replace with real connection once DATABASE_URL is configured
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://user:pass@localhost:5432/blueocean_test"

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Produces the Authorization header for a given user fixture.
// Placeholder encoding — replace with real JWT signing once auth service exists.
export function makeAuthHeader(user: UserFixture): Record<string, string> {
  return { Authorization: `Bearer ${generateTestToken(user)}` }
}

function generateTestToken(user: UserFixture): string {
  const payload = JSON.stringify({ sub: user.id, org_id: user.org_id, role: user.role })
  return Buffer.from(payload).toString("base64")
}

// Produces a token that claims a different org than the user actually belongs to.
// Used to verify tampered-token rejection.
export function makeTokenWithForcedOrg(user: UserFixture, forcedOrgId: string): Record<string, string> {
  const payload = JSON.stringify({ sub: user.id, org_id: forcedOrgId, role: user.role })
  return { Authorization: `Bearer ${Buffer.from(payload).toString("base64")}` }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

// Import the Hono app instance.
// Path will resolve once apps/api/src/app.ts is implemented.
import app from "../../apps/api/src/app"

type RequestOptions = {
  method?: string
  headers?: Record<string, string>
  body?: unknown
}

export async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", headers = {}, body } = options
  const init: RequestInit = { method, headers }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
    ;(init.headers as Record<string, string>)["Content-Type"] = "application/json"
  }

  return app.request(path, init)
}

export async function authedRequest(
  path: string,
  user: UserFixture,
  options: RequestOptions = {}
): Promise<Response> {
  return request(path, {
    ...options,
    headers: { ...makeAuthHeader(user), ...options.headers },
  })
}

// ─── DB seed / teardown ───────────────────────────────────────────────────────
// Placeholders — implement against db/schema once Drizzle is wired up.
// Seed order respects FK constraints: orgs → users → compartments → documents → chunks

export async function seedDb(): Promise<void> {
  // Insert ALL_ORGS, ALL_USERS, ALL_COMPARTMENTS, ALL_DOCUMENTS, ALL_CHUNKS
  // using Drizzle insert once schema is available
}

export async function clearDb(): Promise<void> {
  // Truncate in reverse FK order:
  // chunks → documents → compartments → users → orgs
  // Use CASCADE or explicit ordering to avoid FK violations
}
