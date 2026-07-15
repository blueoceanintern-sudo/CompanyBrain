import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { signJwt } from '../lib/jwt'
import { setCookie, deleteCookie } from 'hono/cookie'
import { db } from '@company-brain/db'
import { users } from '@company-brain/db'
import { eq } from 'drizzle-orm'

const authRoute = new Hono()

const COOKIE_NAME = 'auth_token'
const COOKIE_MAX_AGE = 8 * 60 * 60

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = rows[0]
  if (!user) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    )
  }

  const valid = await Bun.password.verify(password, user.passwordHash)
  if (!valid) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    )
  }

  const token = signJwt(
    { sub: user.id, orgId: user.orgId, role: user.role },
    process.env.JWT_SECRET!,
    8 * 60 * 60
  )

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  })

  return c.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
    },
  })
})

authRoute.post('/logout', (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ success: true, data: null })
})


export default authRoute
