import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import { db } from '@company-brain/db'
import { users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import { signJwt } from '../lib/jwt'
import { SESSION_TTL_SECONDS } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const accountRoute = new Hono<AuthVars>()

const COOKIE_NAME = 'auth_token'

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
  const invalidatedAt = new Date()
  // Clearing mustChangePassword here is what lifts the forced-change gate for
  // invited users; a no-op for anyone who already had it false. Bumping
  // sessionInvalidatedAt revokes any *other* sessions this account has open.
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false, sessionInvalidatedAt: invalidatedAt, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Re-issue the caller's own session with a fresh token so this request's
  // client stays logged in (its old token predates the invalidation we just
  // wrote). This matters for the forced first-login password change.
  const token = signJwt(
    { sub: userId, orgId: c.get('orgId'), role: c.get('role') },
    process.env.JWT_SECRET!,
    SESSION_TTL_SECONDS
  )
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  })

  return c.json({ success: true, data: null })
})

export default accountRoute
