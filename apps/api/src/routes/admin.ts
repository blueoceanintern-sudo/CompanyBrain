import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { compartments, users, auditLogs } from '@company-brain/db'
import { eq, and } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const adminRoute = new Hono<AuthVars>()

// ─── Compartments ─────────────────────────────────────────────────────────────

const compartmentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  mode: z.enum(['autonomous', 'schema_driven']).default('autonomous'),
})

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const

adminRoute.get('/compartments', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const rows = await db.select().from(compartments).where(eq(compartments.orgId, orgId))
  return c.json({ success: true, data: rows })
})

adminRoute.post('/compartments', zValidator('json', compartmentCreateSchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')
  const body = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const [compartment] = await db
    .insert(compartments)
    .values({
      orgId,
      name: body.name,
      mode: body.mode,
      ...(body.description !== undefined ? { description: body.description } : {}),
    })
    .returning()

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'compartment.create',
    resourceType: 'compartment',
    resourceId: compartment?.id ?? null,
    metadata: { name: body.name },
  })

  return c.json({ success: true, data: compartment }, 201)
})

adminRoute.patch('/compartments/:cId', zValidator('json', compartmentCreateSchema.partial()), async (c) => {
  const orgId = c.req.param('id')
  const cId = c.req.param('cId')
  if (!orgId || !cId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const updates = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  await db
    .update(compartments)
    .set({
      updatedAt: new Date(),
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
    })
    .where(and(eq(compartments.id, cId), eq(compartments.orgId, orgId)))

  return c.json({ success: true, data: null })
})

// ─── Users ────────────────────────────────────────────────────────────────────

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
  temporaryPassword: z.string().min(8),
})

const updateRoleSchema = z.object({
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
})

adminRoute.get('/users', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.orgId, orgId))
  return c.json({ success: true, data: rows })
})

adminRoute.post('/users', zValidator('json', inviteUserSchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const role = c.get('role')
  const body = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const passwordHash = await Bun.password.hash(body.temporaryPassword)

  const [newUser] = await db
    .insert(users)
    .values({ orgId, email: body.email, passwordHash, role: body.role })
    .returning({ id: users.id, email: users.email, role: users.role })

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'user.invite',
    resourceType: 'user',
    resourceId: newUser?.id ?? null,
    metadata: { email: body.email, role: body.role },
  })

  return c.json({ success: true, data: { id: newUser?.id, email: newUser?.email, role: newUser?.role } }, 201)
})

adminRoute.patch('/users/:userId/role', zValidator('json', updateRoleSchema), async (c) => {
  const orgId = c.req.param('id')
  const targetUserId = c.req.param('userId')
  if (!orgId || !targetUserId) return c.json(BAD_ORG, 400)
  const actorUserId = c.get('userId')
  const role = c.get('role')
  const { role: newRole } = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)))

  await db.insert(auditLogs).values({
    orgId,
    userId: actorUserId,
    action: 'user.role_update',
    resourceType: 'user',
    resourceId: targetUserId,
    metadata: { newRole },
  })

  return c.json({ success: true, data: null })
})

export default adminRoute
