import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { groups, groupMembers, compartmentGrants, compartments, users, auditLogs } from '@company-brain/db'
import { eq, and, count, inArray, ne } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

// Groups + compartment grants — the org admin's "who can access what" surface
const accessRoute = new Hono<AuthVars>()

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const
const FORBIDDEN = { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } } as const

accessRoute.use('*', async (c, next) => {
  if (!hasPermission(c.get('role'), 'users:manage')) {
    return c.json(FORBIDDEN, 403)
  }
  await next()
})

// ─── Groups ───────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

accessRoute.get('/groups', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)

  const rows = await db
    .select({
      id: groups.id,
      orgId: groups.orgId,
      name: groups.name,
      description: groups.description,
      memberCount: count(groupMembers.id),
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
    })
    .from(groups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groups.orgId, orgId))
    .groupBy(groups.id)
    .orderBy(groups.name)

  return c.json({ success: true, data: rows })
})

accessRoute.post('/groups', zValidator('json', groupSchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const body = c.req.valid('json')

  let group: { id: string } | undefined
  try {
    ;[group] = await db
      .insert(groups)
      .values({
        orgId,
        name: body.name,
        ...(body.description !== undefined ? { description: body.description } : {}),
      })
      .returning({ id: groups.id })
  } catch (err) {
    const pg = err as { code?: string }
    if (pg.code === '23505') {
      return c.json(
        { success: false, error: { code: 'NAME_TAKEN', message: `A group named "${body.name}" already exists` } },
        409
      )
    }
    throw err
  }

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'group.create',
    resourceType: 'group',
    resourceId: group?.id ?? null,
    metadata: { name: body.name },
  })

  return c.json({ success: true, data: group }, 201)
})

accessRoute.patch('/groups/:gId', zValidator('json', groupSchema.partial()), async (c) => {
  const orgId = c.req.param('id')
  const gId = c.req.param('gId')
  if (!orgId || !gId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const updates = c.req.valid('json')

  const [updated] = await db
    .update(groups)
    .set({
      updatedAt: new Date(),
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
    })
    .where(and(eq(groups.id, gId), eq(groups.orgId, orgId)))
    .returning({ id: groups.id })

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404)
  }

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'group.update',
    resourceType: 'group',
    resourceId: gId,
    metadata: updates,
  })

  return c.json({ success: true, data: null })
})

accessRoute.delete('/groups/:gId', async (c) => {
  const orgId = c.req.param('id')
  const gId = c.req.param('gId')
  if (!orgId || !gId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')

  // Members and grants cascade via FKs
  const [deleted] = await db
    .delete(groups)
    .where(and(eq(groups.id, gId), eq(groups.orgId, orgId)))
    .returning({ name: groups.name })

  if (!deleted) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404)
  }

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'group.delete',
    resourceType: 'group',
    resourceId: gId,
    metadata: { name: deleted.name },
  })

  return c.json({ success: true, data: null })
})

// ─── Group members ────────────────────────────────────────────────────────────

const membersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
})

accessRoute.get('/groups/:gId/members', async (c) => {
  const orgId = c.req.param('id')
  const gId = c.req.param('gId')
  if (!orgId || !gId) return c.json(BAD_ORG, 400)

  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, gId), eq(groupMembers.orgId, orgId)))

  return c.json({ success: true, data: rows })
})

accessRoute.put('/groups/:gId/members', zValidator('json', membersSchema), async (c) => {
  const orgId = c.req.param('id')
  const gId = c.req.param('gId')
  if (!orgId || !gId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const { userIds } = c.req.valid('json')

  const [group] = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(eq(groups.id, gId), eq(groups.orgId, orgId)))
    .limit(1)

  if (!group) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404)
  }

  // Every member must be an internal user of this org
  if (userIds.length > 0) {
    const validUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), inArray(users.id, userIds), ne(users.role, 'external_client')))
    if (validUsers.length !== new Set(userIds).size) {
      return c.json(
        { success: false, error: { code: 'INVALID_USERS', message: 'One or more users are not internal members of this organisation' } },
        400
      )
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, gId), eq(groupMembers.orgId, orgId)))
    if (userIds.length > 0) {
      await tx.insert(groupMembers).values(userIds.map((uid) => ({ orgId, groupId: gId, userId: uid })))
    }
  })

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'group.members_update',
    resourceType: 'group',
    resourceId: gId,
    metadata: { name: group.name, userIds },
  })

  return c.json({ success: true, data: null })
})

// ─── Per-user group membership (users page) ───────────────────────────────────

const userGroupsSchema = z.object({
  groupIds: z.array(z.string().uuid()).max(100),
})

accessRoute.put('/users/:userId/groups', zValidator('json', userGroupsSchema), async (c) => {
  const orgId = c.req.param('id')
  const targetUserId = c.req.param('userId')
  if (!orgId || !targetUserId) return c.json(BAD_ORG, 400)
  const actorId = c.get('userId')
  const groupIds = [...new Set(c.req.valid('json').groupIds)]

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, targetUserId), eq(users.orgId, orgId)))
    .limit(1)

  if (!target) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }
  if (target.role === 'external_client') {
    return c.json(
      { success: false, error: { code: 'INVALID_USERS', message: 'External clients cannot be added to groups' } },
      400
    )
  }

  if (groupIds.length > 0) {
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

  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.userId, targetUserId), eq(groupMembers.orgId, orgId)))
    if (groupIds.length > 0) {
      await tx.insert(groupMembers).values(groupIds.map((gid) => ({ orgId, groupId: gid, userId: targetUserId })))
    }
  })

  await db.insert(auditLogs).values({
    orgId,
    userId: actorId,
    action: 'user.groups_update',
    resourceType: 'user',
    resourceId: targetUserId,
    metadata: { email: target.email, groupIds },
  })

  return c.json({ success: true, data: null })
})

// ─── Compartment grants ───────────────────────────────────────────────────────

const grantsSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
  groupIds: z.array(z.string().uuid()).max(500),
})

accessRoute.get('/compartments/:cId/grants', async (c) => {
  const orgId = c.req.param('id')
  const cId = c.req.param('cId')
  if (!orgId || !cId) return c.json(BAD_ORG, 400)

  const rows = await db
    .select({ userId: compartmentGrants.userId, groupId: compartmentGrants.groupId })
    .from(compartmentGrants)
    .where(and(eq(compartmentGrants.compartmentId, cId), eq(compartmentGrants.orgId, orgId)))

  return c.json({
    success: true,
    data: {
      userIds: rows.map((r) => r.userId).filter((v): v is string => v !== null),
      groupIds: rows.map((r) => r.groupId).filter((v): v is string => v !== null),
    },
  })
})

accessRoute.put('/compartments/:cId/grants', zValidator('json', grantsSchema), async (c) => {
  const orgId = c.req.param('id')
  const cId = c.req.param('cId')
  if (!orgId || !cId) return c.json(BAD_ORG, 400)
  const userId = c.get('userId')
  const { userIds, groupIds } = c.req.valid('json')

  const [compartment] = await db
    .select({ id: compartments.id, name: compartments.name })
    .from(compartments)
    .where(and(eq(compartments.id, cId), eq(compartments.orgId, orgId)))
    .limit(1)

  if (!compartment) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Compartment not found' } }, 404)
  }

  if (userIds.length > 0) {
    const validUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), inArray(users.id, userIds)))
    if (validUsers.length !== new Set(userIds).size) {
      return c.json(
        { success: false, error: { code: 'INVALID_USERS', message: 'One or more users do not belong to this organisation' } },
        400
      )
    }
  }

  if (groupIds.length > 0) {
    const validGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.orgId, orgId), inArray(groups.id, groupIds)))
    if (validGroups.length !== new Set(groupIds).size) {
      return c.json(
        { success: false, error: { code: 'INVALID_GROUPS', message: 'One or more groups do not belong to this organisation' } },
        400
      )
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(compartmentGrants).where(and(eq(compartmentGrants.compartmentId, cId), eq(compartmentGrants.orgId, orgId)))
    const values = [
      ...userIds.map((uid) => ({ orgId, compartmentId: cId, userId: uid, grantedBy: userId })),
      ...groupIds.map((gid) => ({ orgId, compartmentId: cId, groupId: gid, grantedBy: userId })),
    ]
    if (values.length > 0) {
      await tx.insert(compartmentGrants).values(values)
    }
  })

  await db.insert(auditLogs).values({
    orgId, userId,
    action: 'compartment.grants_update',
    resourceType: 'compartment',
    resourceId: cId,
    metadata: { name: compartment.name, userIds, groupIds },
  })

  return c.json({ success: true, data: null })
})

export default accessRoute
