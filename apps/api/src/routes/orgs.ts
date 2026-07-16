import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { orgs, users, auditLogs } from '@company-brain/db'
import { eq, desc, sql } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const orgsRoute = new Hono<AuthVars>()

const createOrgSchema = z.object({
  orgName: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  adminTemporaryPassword: z.string().min(8),
})

// GET /api/v1/orgs — list orgs (platform-level, not org-scoped)
orgsRoute.get('/', async (c) => {
  const role = c.get('role')
  if (!hasPermission(role, 'orgs:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  // Aggregate counts only — never expose another org's content (documents, queries, answers)
  const rows = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      plan: orgs.plan,
      createdAt: orgs.createdAt,
      userCount: sql<number>`(select count(*)::int from users u where u.org_id = orgs.id)`,
      documentCount: sql<number>`(select count(*)::int from documents d where d.org_id = orgs.id and d.status != 'archived')`,
      queryCount30d: sql<number>`(select count(*)::int from queries q where q.org_id = orgs.id and q.created_at > now() - interval '30 days')`,
    })
    .from(orgs)
    .orderBy(desc(orgs.createdAt))

  return c.json({ success: true, data: rows })
})

// POST /api/v1/orgs — provisions a new org and its first org_admin
orgsRoute.post('/', zValidator('json', createOrgSchema), async (c) => {
  const role = c.get('role')
  if (!hasPermission(role, 'orgs:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const { orgName, adminEmail, adminTemporaryPassword } = c.req.valid('json')

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1)

  if (existing.length > 0) {
    return c.json(
      { success: false, error: { code: 'EMAIL_TAKEN', message: 'A user with this email already exists' } },
      409
    )
  }

  const passwordHash = await Bun.password.hash(adminTemporaryPassword)
  const actorUserId = c.get('userId')
  const actorOrgId = c.get('orgId')

  const { org, admin } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(orgs).values({ name: orgName }).returning()
    if (!org) throw new Error('Failed to create organisation')

    const [admin] = await tx
      .insert(users)
      .values({ orgId: org.id, email: adminEmail, passwordHash, role: 'org_admin' })
      .returning({ id: users.id, email: users.email, role: users.role })

    // Audit trails are org-scoped, so record provisioning twice: once in the
    // platform operator's own trail, once as the new org's founding event.
    await tx.insert(auditLogs).values([
      {
        orgId: actorOrgId,
        userId: actorUserId,
        action: 'org.create',
        resourceType: 'org',
        resourceId: org.id,
        metadata: { orgName, adminEmail },
      },
      {
        orgId: org.id,
        userId: actorUserId,
        action: 'org.create',
        resourceType: 'org',
        resourceId: org.id,
        metadata: { orgName, adminEmail },
      },
    ])

    return { org, admin: admin! }
  })

  return c.json(
    { success: true, data: { orgId: org.id, orgName: org.name, admin } },
    201
  )
})

export default orgsRoute
