import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { orgs, users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const orgsRoute = new Hono<AuthVars>()

const createOrgSchema = z.object({
  orgName: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  adminTemporaryPassword: z.string().min(8),
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

  const { org, admin } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(orgs).values({ name: orgName }).returning()
    if (!org) throw new Error('Failed to create organisation')

    const [admin] = await tx
      .insert(users)
      .values({ orgId: org.id, email: adminEmail, passwordHash, role: 'org_admin' })
      .returning({ id: users.id, email: users.email, role: users.role })

    return { org, admin: admin! }
  })

  return c.json(
    { success: true, data: { orgId: org.id, orgName: org.name, admin } },
    201
  )
})

export default orgsRoute
