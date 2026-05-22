import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db, documents, orgs } from "../../../../db/index"
import { ingestDocument } from "../../../../services/ingestion"
import { auth } from "../middleware/auth"
import type { UserRole } from "../../../../shared/types"

const ADMIN_ROLES: UserRole[] = ["org_admin", "dept_admin"]

const patchSchema = z.object({
  compartment_id: z.string().optional(),
  access_tier:    z.enum(["internal", "external"]).optional(),
}).refine(d => d.compartment_id !== undefined || d.access_tier !== undefined, {
  message: "At least one field is required.",
})

export const documentsRouter = new Hono()

documentsRouter.use("*", auth)

// POST /orgs/:orgId/documents
documentsRouter.post("/", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  // Check org exists and plan allows external tier uploads
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId))
  if (!org) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Organisation not found." } }, 404)
  }

  // Check org is not in quarantine (cancelled)
  if (org.cancelled_at) {
    return c.json({ success: false, error: { code: "ORG_CANCELLED", message: "Organisation subscription is cancelled." } }, 403)
  }

  let body: FormData
  try {
    body = await c.req.formData()
  } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Expected multipart/form-data." } }, 400)
  }

  const file        = body.get("file")
  const source_type = body.get("source_type") as string | null
  const access_tier = body.get("access_tier") as string | null
  const compartment_id = body.get("compartment_id") as string | null

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "File is required." } }, 400)
  }
  if (!source_type) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "source_type is required." } }, 400)
  }
  if (!access_tier) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "access_tier is required." } }, 400)
  }
  if (!compartment_id) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "compartment_id is required." } }, 400)
  }

  const VALID_TIERS   = ["internal", "external"]
  const VALID_SOURCES = ["hr_policy", "sop", "faq", "case_note", "compliance", "product_doc", "other"]

  if (!VALID_TIERS.includes(access_tier)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid access_tier." } }, 400)
  }
  if (!VALID_SOURCES.includes(source_type)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid source_type." } }, 400)
  }

  // Free plan cannot upload external tier
  if (org.plan === "free" && access_tier === "external") {
    return c.json({ success: false, error: { code: "PLAN_RESTRICTION", message: "External plane requires a paid plan." } }, 402)
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const result = await ingestDocument({
    fileBuffer,
    filename:      file.name,
    orgId,
    compartmentId: compartment_id,
    accessTier:    access_tier as "internal" | "external",
    sourceType:    source_type as "hr_policy" | "sop" | "faq" | "case_note" | "compliance" | "product_doc" | "other",
    uploadedBy:    user.sub,
  })

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400)
  }

  return c.json({
    success: true,
    data: {
      id:             result.data.document_id,
      org_id:         orgId,
      compartment_id,
      access_tier,
      source_type,
      status:         "processing",
      job_id:         result.data.job_id,
    },
  }, 201)
})

// GET /orgs/:orgId/documents
documentsRouter.get("/", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId))
  if (!org) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Org not found." } }, 404)

  const access_tier    = c.req.query("access_tier")
  const compartment_id = c.req.query("compartment_id")
  const status         = c.req.query("status")
  const page           = Math.max(1, parseInt(c.req.query("page") ?? "1", 10))
  const perPage        = 25

  const conditions = [eq(documents.org_id, orgId)]
  if (access_tier)    conditions.push(eq(documents.access_tier, access_tier as "internal" | "external"))
  if (compartment_id) conditions.push(eq(documents.compartment_id, compartment_id))
  if (status)         conditions.push(eq(documents.status, status as "active" | "processing" | "error" | "archived"))

  const rows = await db.select().from(documents).where(and(...conditions))

  const start  = (page - 1) * perPage
  const paged  = rows.slice(start, start + perPage)
  const total  = rows.length

  return c.json({
    success: true,
    data: paged,
    pagination: { page, per_page: perPage, total },
  })
})

// GET /orgs/:orgId/documents/:docId
documentsRouter.get("/:docId", async (c) => {
  const orgId = c.req.param("orgId")
  const docId = c.req.param("docId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.org_id, orgId)))
  if (!doc) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Document not found." } }, 404)
  }

  if (!ADMIN_ROLES.includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  return c.json({ success: true, data: doc })
})

// PATCH /orgs/:orgId/documents/:docId
documentsRouter.patch("/:docId", zValidator("json", patchSchema), async (c) => {
  const orgId = c.req.param("orgId")
  const docId = c.req.param("docId")
  const user  = c.get("user")
  const body  = c.req.valid("json")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.org_id, orgId)))
  if (!doc) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Document not found." } }, 404)
  }

  // Validate compartment belongs to this org
  if (body.compartment_id) {
    const { compartments } = await import("../../../../db/index")
    const [comp] = await db.select().from(compartments).where(and(eq(compartments.id, body.compartment_id), eq(compartments.org_id, orgId)))
    if (!comp) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Compartment not found in this org." } }, 404)
    }
  }

  await db.update(documents)
    .set({ ...body, updated_at: new Date() })
    .where(eq(documents.id, docId))

  const [updated] = await db.select().from(documents).where(eq(documents.id, docId))
  return c.json({ success: true, data: updated })
})

// DELETE /orgs/:orgId/documents/:docId
documentsRouter.delete("/:docId", async (c) => {
  const orgId = c.req.param("orgId")
  const docId = c.req.param("docId")
  const user  = c.get("user")

  if (user.org_id !== orgId) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admins only." } }, 403)
  }

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.org_id, orgId)))
  if (!doc || doc.status === "archived") {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Document not found." } }, 404)
  }

  await db.update(documents).set({ status: "archived", updated_at: new Date() }).where(eq(documents.id, docId))
  return c.json({ success: true, data: { id: docId, status: "archived" } })
})
