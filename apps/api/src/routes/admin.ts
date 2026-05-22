import { Hono } from "hono"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { randomUUID } from "crypto"
import { db, compartments, users, orgs } from "../../../../db/index"
import { auth } from "../middleware/auth"
import type { UserRole } from "../../../../shared/types"

const ORG_ADMIN_ROLES: UserRole[] = ["org_admin", "super_admin"]

const compartmentCreateSchema = z.object({
  name:        z.string().min(1, "Name is required."),
  description: z.string().optional().default(""),
})

const compartmentUpdateSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
}).refine(d => d.name !== undefined || d.description !== undefined, {
  message: "At least one field required.",
})

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email."),
  role:  z.enum(["org_admin", "dept_admin", "staff", "external_client"]),
})

const updateRoleSchema = z.object({
  role: z.enum(["org_admin", "dept_admin", "staff", "external_client"]),
})

export const adminRouter = new Hono()
adminRouter.use("*", auth)

// ─── Compartments ─────────────────────────────────────────────────────────────

adminRouter.post("/compartments", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, 400)
  }

  const parsed = compartmentCreateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid." } }, 400)
  }

  const id = randomUUID()
  await db.insert(compartments).values({ id, org_id: orgId, ...parsed.data })
  const [created] = await db.select().from(compartments).where(eq(compartments.id, id))
  return c.json({ success: true, data: created }, 201)
})

adminRouter.get("/compartments", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  const rows = await db.select().from(compartments).where(eq(compartments.org_id, orgId))
  return c.json({ success: true, data: rows })
})

adminRouter.patch("/compartments/:cId", async (c) => {
  const orgId = c.req.param("orgId")
  const cId   = c.req.param("cId")
  const user  = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  const [comp] = await db.select().from(compartments).where(and(eq(compartments.id, cId), eq(compartments.org_id, orgId)))
  if (!comp) return c.json({ success: false, error: { code: "NOT_FOUND", message: "Compartment not found." } }, 404)

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, 400)
  }

  const parsed = compartmentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid." } }, 400)
  }

  await db.update(compartments).set({ ...parsed.data, updated_at: new Date() }).where(eq(compartments.id, cId))
  const [updated] = await db.select().from(compartments).where(eq(compartments.id, cId))
  return c.json({ success: true, data: updated })
})

// ─── Users ────────────────────────────────────────────────────────────────────

adminRouter.post("/users", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, 400)
  }

  const parsed = inviteUserSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid." } }, 400)
  }

  // Check duplicate
  const existing = await db.select({ id: users.id }).from(users).where(and(eq(users.email, parsed.data.email), eq(users.org_id, orgId)))
  if (existing.length > 0) {
    return c.json({ success: false, error: { code: "CONFLICT", message: "User with this email already exists." } }, 409)
  }

  const id = randomUUID()
  await db.insert(users).values({ id, org_id: orgId, email: parsed.data.email, role: parsed.data.role })
  const [created] = await db.select().from(users).where(eq(users.id, id))
  return c.json({ success: true, data: created }, 201)
})

adminRouter.get("/users", async (c) => {
  const orgId = c.req.param("orgId")
  const user  = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  const rows = await db.select().from(users).where(eq(users.org_id, orgId))
  return c.json({ success: true, data: rows })
})

adminRouter.patch("/users/:userId/role", async (c) => {
  const orgId  = c.req.param("orgId")
  const userId = c.req.param("userId")
  const user   = c.get("user")

  if (user.org_id !== orgId) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }, 403)
  if (!ORG_ADMIN_ROLES.includes(user.role)) return c.json({ success: false, error: { code: "FORBIDDEN", message: "Org admin required." } }, 403)

  const [target] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.org_id, orgId)))
  if (!target) return c.json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } }, 404)

  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON." } }, 400)
  }

  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid role." } }, 400)
  }

  await db.update(users).set({ role: parsed.data.role, updated_at: new Date() }).where(eq(users.id, userId))
  const [updated] = await db.select().from(users).where(eq(users.id, userId))
  return c.json({ success: true, data: updated })
})
