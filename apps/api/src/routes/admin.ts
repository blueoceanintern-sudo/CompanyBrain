import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { compartments, users, auditLogs, orgs, documents, chunks, groups, groupMembers, compartmentGrants } from '@company-brain/db'
import { eq, and, ne, count, inArray, sql } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import { canPublishExternal } from '@company-brain/access-control'
import type { AuthVars } from '../middleware/auth'
import { sendOrgAdminWelcome, sendUserInvite } from '../lib/email'

const adminRoute = new Hono<AuthVars>()

// ─── Compartments ─────────────────────────────────────────────────────────────

const compartmentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  restricted: z.boolean().optional(),
  // One level of nesting; the parent is fixed at creation (no re-parenting)
  parentId: z.string().uuid().optional(),
  // Required for a top-level compartment; ignored for a sub-compartment,
  // which always inherits its parent's tier — a folder holds one plane only.
  accessTier: z.enum(['internal', 'external']).optional(),
})

const compartmentUpdateSchema = compartmentCreateSchema.omit({ parentId: true, accessTier: true }).partial()

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const

adminRoute.get('/compartments', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const rows = await db
    .select({
      id: compartments.id,
      orgId: compartments.orgId,
      name: compartments.name,
      description: compartments.description,
      restricted: compartments.restricted,
      accessTier: compartments.accessTier,
      parentCompartmentId: compartments.parentCompartmentId,
      grantCount: count(compartmentGrants.id),
      createdAt: compartments.createdAt,
      updatedAt: compartments.updatedAt,
    })
    .from(compartments)
    .leftJoin(compartmentGrants, eq(compartmentGrants.compartmentId, compartments.id))
    .where(eq(compartments.orgId, orgId))
    .groupBy(compartments.id)
    .orderBy(compartments.name)
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

  let accessTier: 'internal' | 'external'

  if (body.parentId) {
    const [parent] = await db
      .select({ id: compartments.id, parentCompartmentId: compartments.parentCompartmentId, accessTier: compartments.accessTier })
      .from(compartments)
      .where(and(eq(compartments.id, body.parentId), eq(compartments.orgId, orgId)))
      .limit(1)

    if (!parent) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Parent compartment not found' } }, 404)
    }
    if (parent.parentCompartmentId) {
      return c.json(
        { success: false, error: { code: 'MAX_DEPTH', message: 'Sub-compartments cannot have their own sub-compartments' } },
        400
      )
    }
    // A sub-compartment always inherits its parent's tier — never mixed.
    accessTier = parent.accessTier
  } else {
    if (!body.accessTier) {
      return c.json(
        { success: false, error: { code: 'MISSING_TIER', message: 'accessTier is required for a top-level compartment' } },
        400
      )
    }
    accessTier = body.accessTier
  }

  if (accessTier === 'external') {
    const [orgRow] = await db.select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
    if (!canPublishExternal(orgRow?.plan ?? 'free')) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'External publishing requires a paid plan' } },
        403
      )
    }
  }

  const [compartment] = await db
    .insert(compartments)
    .values({
      orgId,
      name: body.name,
      accessTier,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.restricted !== undefined ? { restricted: body.restricted } : {}),
      ...(body.parentId !== undefined ? { parentCompartmentId: body.parentId } : {}),
    })
    .returning()

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'compartment.create',
    resourceType: 'compartment',
    resourceId: compartment?.id ?? null,
    metadata: { name: body.name, ...(body.parentId ? { parentCompartmentId: body.parentId } : {}) },
  })

  return c.json({ success: true, data: compartment }, 201)
})

adminRoute.patch('/compartments/:cId', zValidator('json', compartmentUpdateSchema), async (c) => {
  const orgId = c.req.param('id')
  const cId = c.req.param('cId')
  if (!orgId || !cId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const userId = c.get('userId')
  const updates = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const [updated] = await db
    .update(compartments)
    .set({
      updatedAt: new Date(),
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.restricted !== undefined ? { restricted: updates.restricted } : {}),
    })
    .where(and(eq(compartments.id, cId), eq(compartments.orgId, orgId)))
    .returning({ name: compartments.name })

  // Toggling restriction is a permission change — always audit it
  if (updated && updates.restricted !== undefined) {
    await db.insert(auditLogs).values({
      orgId, userId,
      action: 'compartment.restricted_update',
      resourceType: 'compartment',
      resourceId: cId,
      metadata: { name: updated.name, restricted: updates.restricted },
    })
  }

  return c.json({ success: true, data: null })
})

const deleteCompartmentSchema = z.object({
  targetCompartmentId: z.string().uuid().optional(),
})

adminRoute.delete('/compartments/:cId', zValidator('json', deleteCompartmentSchema), async (c) => {
  const orgId = c.req.param('id')
  const cId = c.req.param('cId')
  if (!orgId || !cId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const userId = c.get('userId')
  const { targetCompartmentId } = c.req.valid('json')

  if (!hasPermission(role, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  // A parent cannot be deleted while sub-compartments exist — the admin must
  // delete (or empty) each sub first. The RESTRICT FK backs this up in the DB.
  const [subRow] = await db
    .select({ subCount: count() })
    .from(compartments)
    .where(and(eq(compartments.parentCompartmentId, cId), eq(compartments.orgId, orgId)))

  if ((subRow?.subCount ?? 0) > 0) {
    return c.json(
      {
        success: false,
        error: {
          code: 'HAS_SUBCOMPARTMENTS',
          message: 'This compartment has sub-compartments. Delete them first.',
        },
      },
      400
    )
  }

  if (targetCompartmentId) {
    const [sourceRow] = await db
      .select({ accessTier: compartments.accessTier })
      .from(compartments)
      .where(and(eq(compartments.id, cId), eq(compartments.orgId, orgId)))
      .limit(1)
    const [targetRow] = await db
      .select({ id: compartments.id, accessTier: compartments.accessTier })
      .from(compartments)
      .where(and(eq(compartments.id, targetCompartmentId), eq(compartments.orgId, orgId)))
      .limit(1)

    if (!targetRow) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Target compartment not found' } }, 404)
    }
    if (sourceRow && targetRow.accessTier !== sourceRow.accessTier) {
      return c.json(
        {
          success: false,
          error: { code: 'TIER_MISMATCH', message: 'Documents can only be reassigned to a compartment of the same access tier' },
        },
        400
      )
    }

    await db.update(documents)
      .set({ compartmentId: targetCompartmentId })
      .where(and(eq(documents.compartmentId, cId), eq(documents.orgId, orgId)))

    await db.update(chunks)
      .set({ compartmentId: targetCompartmentId })
      .where(and(eq(chunks.compartmentId, cId), eq(chunks.orgId, orgId)))
  } else {
    await db.delete(chunks).where(and(eq(chunks.compartmentId, cId), eq(chunks.orgId, orgId)))
    await db.delete(documents).where(and(eq(documents.compartmentId, cId), eq(documents.orgId, orgId)))
  }

  const [deleted] = await db
    .delete(compartments)
    .where(and(eq(compartments.id, cId), eq(compartments.orgId, orgId)))
    .returning({ name: compartments.name })

  if (!deleted) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Compartment not found' } }, 404)
  }

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'compartment.delete',
    resourceType: 'compartment',
    resourceId: cId,
    metadata: { name: deleted.name, targetCompartmentId: targetCompartmentId ?? null },
  })

  return c.json({ success: true, data: null })
})

// ─── Users ────────────────────────────────────────────────────────────────────

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
  temporaryPassword: z.string().min(8),
  groupIds: z.array(z.string().uuid()).max(100).optional(),
})

const updateRoleSchema = z.object({
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
})

adminRoute.get('/users', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      groups: sql<string[]>`coalesce(array_agg(${groups.name} ORDER BY ${groups.name}) FILTER (WHERE ${groups.name} IS NOT NULL), '{}')`,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(groupMembers, eq(groupMembers.userId, users.id))
    .leftJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(users.orgId, orgId))
    .groupBy(users.id)
  return c.json({ success: true, data: rows })
})

adminRoute.post('/users', zValidator('json', inviteUserSchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const actorRole = c.get('role')
  const body = c.req.valid('json')

  if (!hasPermission(actorRole, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const groupIds = [...new Set(body.groupIds ?? [])]
  if (groupIds.length > 0) {
    if (body.role === 'external_client') {
      return c.json(
        { success: false, error: { code: 'INVALID_GROUPS', message: 'External clients cannot be added to groups' } },
        400
      )
    }
    const validGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.orgId, orgId), inArray(groups.id, groupIds)))
    if (validGroups.length !== groupIds.length) {
      return c.json(
        { success: false, error: { code: 'INVALID_GROUPS', message: 'One or more groups do not belong to this organisation' } },
        400
      )
    }
  }

  const [orgRow] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
  const orgName = orgRow?.name ?? 'your organisation'

  const passwordHash = await Bun.password.hash(body.temporaryPassword)

  let newUser: { id: string; email: string; role: string } | undefined
  try {
    ;[newUser] = await db
      .insert(users)
      .values({ orgId, email: body.email, passwordHash, role: body.role })
      .returning({ id: users.id, email: users.email, role: users.role })
  } catch (err) {
    const pg = err as { code?: string }
    if (pg.code === '23505') {
      return c.json(
        { success: false, error: { code: 'EMAIL_TAKEN', message: `${body.email} is already registered` } },
        409
      )
    }
    throw err
  }

  if (groupIds.length > 0 && newUser) {
    await db
      .insert(groupMembers)
      .values(groupIds.map((gid) => ({ orgId, groupId: gid, userId: newUser!.id })))
  }

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'user.invite',
    resourceType: 'user',
    resourceId: newUser?.id ?? null,
    metadata: { email: body.email, role: body.role, groupIds },
  })

  // Fire-and-forget — a failed email does not roll back the user creation
  const emailParams = { to: body.email, orgName, temporaryPassword: body.temporaryPassword }
  if (actorRole === 'super_admin') {
    sendOrgAdminWelcome(emailParams).catch((err) =>
      console.error('Failed to send org admin welcome email', { to: body.email, err })
    )
  } else {
    sendUserInvite(emailParams).catch((err) =>
      console.error('Failed to send user invite email', { to: body.email, err })
    )
  }

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

adminRoute.delete('/users/:userId', async (c) => {
  const orgId = c.req.param('id')
  const targetUserId = c.req.param('userId')
  if (!orgId || !targetUserId) return c.json(BAD_ORG, 400)
  const actorUserId = c.get('userId')
  const actorRole = c.get('role')

  if (!hasPermission(actorRole, 'users:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }
  if (targetUserId === actorUserId) {
    return c.json({ success: false, error: { code: 'SELF_DELETE', message: 'You cannot remove yourself' } }, 400)
  }

  const [target] = await db
    .select({ role: users.role, email: users.email })
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)))
    .limit(1)

  if (!target) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }
  if (target.role === 'super_admin') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Super admin accounts cannot be removed' } }, 403)
  }

  if (target.role === 'org_admin' && actorRole !== 'super_admin') {
    const [row] = await db
      .select({ adminCount: count() })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, 'org_admin')))
    if ((row?.adminCount ?? 0) <= 1) {
      return c.json(
        { success: false, error: { code: 'LAST_ADMIN', message: 'At least one admin must remain in the organisation' } },
        400
      )
    }
  }

  // audit_logs, documents, queries FKs use onDelete: 'set null' so Postgres nulls them automatically
  await db.delete(users).where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)))

  await db.insert(auditLogs).values({
    orgId,
    userId: actorUserId,
    action: 'user.remove',
    resourceType: 'user',
    resourceId: targetUserId,
    metadata: { email: target.email, removedRole: target.role },
  })

  return c.json({ success: true, data: null })
})

export default adminRoute
