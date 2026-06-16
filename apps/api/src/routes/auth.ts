import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { SignJWT } from 'jose'
import { db } from '@company-brain/db'
import { users } from '@company-brain/db'
import { eq } from 'drizzle-orm'

const authRoute = new Hono()

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

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = await new SignJWT({
    sub: user.id,
    orgId: user.orgId,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
    },
  })
})

export default authRoute
