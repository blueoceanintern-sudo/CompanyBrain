import { Hono } from "hono"
import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import { randomUUID } from "crypto"
import { db, queries, orgs } from "../../../../db/index"
import { retrieve } from "../../../../services/retrieval"
import { auth } from "../middleware/auth"

const queryBodySchema = z.object({
  query:       z.string().min(1, "Query must not be empty.").max(5000),
  access_tier: z.enum(["internal", "external"]).optional(),
})

export const queryRouter = new Hono()
queryRouter.use("*", auth)

// POST /orgs/:orgId/query
queryRouter.post("/", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }

  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId))
  if (!org) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Organisation not found." } }, 404)
  }

  if (org.cancelled_at) {
    return c.json({ success: false, error: { code: "ORG_CANCELLED", message: "Subscription cancelled." } }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } }, 400)
  }

  const parsed = queryBodySchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid input."
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message } }, 400)
  }

  const queryText = parsed.data.query.trim()
  if (!queryText) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Query must not be empty." } }, 400)
  }

  // Determine effective access tier
  let accessTier = parsed.data.access_tier ?? (user.role === "external_client" ? "external" : "internal")

  // Free plan cannot use external plane
  if (org.plan === "free" && accessTier === "external") {
    return c.json({ success: false, error: { code: "PLAN_RESTRICTION", message: "External plane requires a paid plan." } }, 402)
  }

  // External clients are always scoped to external tier
  if (user.role === "external_client") {
    accessTier = "external"
  }

  const result = await retrieve({
    query:      queryText,
    orgId,
    userId:     user.sub,
    userRole:   user.role,
    accessTier: accessTier as "internal" | "external",
  })

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 500)
  }

  // Log the query
  try {
    await db.insert(queries).values({
      id:          randomUUID(),
      org_id:      orgId,
      user_id:     user.sub,
      query_text:  queryText,
      answer:      result.data.answer,
      citations:   result.data.citations,
      confidence:  result.data.confidence,
      missing:     result.data.missing,
      access_tier: accessTier as "internal" | "external",
    })
  } catch {}

  return c.json({ success: true, data: result.data })
})

// GET /orgs/:orgId/queries
queryRouter.get("/queries", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }
  if (!["org_admin", "super_admin"].includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  const rows = await db
    .select()
    .from(queries)
    .where(eq(queries.org_id, orgId))
    .orderBy(desc(queries.created_at))

  return c.json({ success: true, data: rows })
})
