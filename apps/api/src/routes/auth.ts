import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomBytes, createHash } from 'node:crypto'
import { signJwt } from '../lib/jwt'
import { setCookie, deleteCookie } from 'hono/cookie'
import { db } from '@company-brain/db'
import { users, orgs, passwordResetTokens } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import { sendPasswordReset } from '../lib/email'

const authRoute = new Hono()

const COOKIE_NAME = 'auth_token'
const SHORT_SESSION_SECONDS = 8 * 60 * 60
const REMEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60
const RESET_TOKEN_TTL_SECONDS = 60 * 60

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
})

authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, rememberMe } = c.req.valid('json')
  const sessionSeconds = rememberMe ? REMEMBER_SESSION_SECONDS : SHORT_SESSION_SECONDS

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
    sessionSeconds
  )

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: sessionSeconds,
    secure: false,
  })

  const orgRows = await db
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.id, user.orgId))
    .limit(1)

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        orgName: orgRows[0]?.name ?? '',
      },
    },
  })
})

authRoute.post('/logout', (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
  return c.json({ success: true, data: null })
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

// Always returns the same generic response whether or not the email exists —
// otherwise this endpoint becomes a way to enumerate registered accounts.
authRoute.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json')
  const GENERIC_RESPONSE = { success: true, data: null } as const

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  const user = rows[0]
  if (!user) return c.json(GENERIC_RESPONSE)

  const rawToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000)

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  })

  const resetUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`
  // Fire-and-forget, like the invite emails in admin.ts — nodemailer's SMTP
  // transport has generous default timeouts (connection: 2 min, socket: up
  // to 10 min), so awaiting the send here would leave the request hanging
  // for however long the SMTP server takes to respond. Not awaiting also
  // keeps this response's timing independent of whether the send succeeds,
  // which matters for the same reason it's a generic response in the first
  // place — the token is already stored, so a failed send just costs the
  // user a retry.
  sendPasswordReset({ to: user.email, resetUrl }).catch((err) =>
    console.error('[forgot-password] failed to send reset email', err)
  )

  return c.json(GENERIC_RESPONSE)
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

authRoute.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, newPassword } = c.req.valid('json')

  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
    .limit(1)

  const resetRow = rows[0]
  const invalid = !resetRow || resetRow.usedAt !== null || resetRow.expiresAt < new Date()
  if (invalid) {
    return c.json(
      { success: false, error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired.' } },
      400
    )
  }

  const passwordHash = await Bun.password.hash(newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, resetRow.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRow.id))

  return c.json({ success: true, data: null })
})

export default authRoute
