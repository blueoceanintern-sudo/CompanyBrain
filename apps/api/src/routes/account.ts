import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import type { AuthVars } from '../middleware/auth'

const accountRoute = new Hono<AuthVars>()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
})

// PATCH /orgs/:id/account/password — self-service only. Operates on the
// caller's own userId from the JWT rather than a URL param, so no permission
// check is needed: this route can never touch anyone else's account.
accountRoute.patch('/password', zValidator('json', changePasswordSchema), async (c) => {
  const userId = c.get('userId')
  const { currentPassword, newPassword } = c.req.valid('json')

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = rows[0]
  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const valid = await Bun.password.verify(currentPassword, user.passwordHash)
  if (!valid) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } },
      401
    )
  }

  const passwordHash = await Bun.password.hash(newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))

  return c.json({ success: true, data: null })
})

export default accountRoute
