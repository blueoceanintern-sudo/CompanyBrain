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
import { getRolePermissions } from '@company-brain/access-control'
import { SESSION_TTL_SECONDS } from '@company-brain/shared'
import { isRateLimited, recordFailure, clearRateLimit, pruneRateLimit, type RateWindow } from '../lib/rate-limit'

const authRoute = new Hono()

const COOKIE_NAME = 'auth_token'
const RESET_TOKEN_TTL_SECONDS = 60 * 60

// Login brute-force / password-spraying guard. Failed attempts are counted per
// account (email) and per source IP over a fixed window; a successful login
// clears the account counter. In-memory, single-instance (see CLAUDE.md).
const loginAttempts = new Map<string, RateWindow>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_PER_EMAIL = 10
const LOGIN_MAX_PER_IP = 30

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const RATE_LIMITED = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' },
} as const

authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  // Every session is short-lived (8h) regardless of role — see SESSION_TTL_SECONDS.
  const sessionSeconds = SESSION_TTL_SECONDS

  // The client IP is forwarded by the Next.js login proxy via x-forwarded-for;
  // fall back to a shared bucket when it is absent (e.g. local dev).
  const now = Date.now()
  pruneRateLimit(loginAttempts, now)
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const emailKey = `email:${email.toLowerCase()}`
  const ipKey = `ip:${ip}`

  const emailCheck = isRateLimited(loginAttempts, emailKey, now, LOGIN_MAX_PER_EMAIL)
  const ipCheck = isRateLimited(loginAttempts, ipKey, now, LOGIN_MAX_PER_IP)
  if (emailCheck.limited || ipCheck.limited) {
    c.header('Retry-After', String(Math.max(emailCheck.retryAfterSeconds, ipCheck.retryAfterSeconds)))
    return c.json(RATE_LIMITED, 429)
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = rows[0]
  if (!user) {
    recordFailure(loginAttempts, emailKey, now, LOGIN_WINDOW_MS)
    recordFailure(loginAttempts, ipKey, now, LOGIN_WINDOW_MS)
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    )
  }

  const valid = await Bun.password.verify(password, user.passwordHash)
  if (!valid) {
    recordFailure(loginAttempts, emailKey, now, LOGIN_WINDOW_MS)
    recordFailure(loginAttempts, ipKey, now, LOGIN_WINDOW_MS)
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    )
  }

  // Successful login — clear the account counter so earlier typos don't count
  // against a legitimate user. The IP counter is kept (spraying protection).
  clearRateLimit(loginAttempts, emailKey)

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
    secure: process.env.NODE_ENV === 'production',
  })

  const orgRows = await db
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.id, user.orgId))
    .limit(1)

  // Resolve the effective permissions for this user's role so the web client can
  // gate UI without a second request. Enforcement still happens server-side.
  const permissions = (await getRolePermissions(user.orgId))[user.role] ?? []

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
        mustChangePassword: user.mustChangePassword,
        permissions,
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
  // Revoke every existing session for this account — a reset often follows a
  // suspected compromise, so any tokens already out there must stop working.
  await db
    .update(users)
    .set({ passwordHash, sessionInvalidatedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, resetRow.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRow.id))

  return c.json({ success: true, data: null })
})

export default authRoute
