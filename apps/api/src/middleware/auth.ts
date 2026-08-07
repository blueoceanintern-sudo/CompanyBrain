import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../lib/jwt'
import { getCookie } from 'hono/cookie'
import { db, users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import type { UserRole } from '@company-brain/shared'

export type AuthVars = {
  Variables: {
    userId: string
    orgId: string
    role: UserRole
  }
}

// A token is revoked if it was issued (iat, in seconds) before the account's
// session_invalidated_at instant. Compared at 1-second granularity so a token
// minted in the same second as the invalidation (e.g. the fresh cookie handed
// back by the password-change route) is not caught by its own bump.
export function isSessionRevoked(iat: unknown, sessionInvalidatedAt: Date | null): boolean {
  if (!sessionInvalidatedAt || typeof iat !== 'number') return false
  return iat < Math.floor(sessionInvalidatedAt.getTime() / 1000)
}

export const authMiddleware = createMiddleware<AuthVars>(async (c, next) => {
  const cookie = getCookie(c, 'auth_token')
  const authHeader = c.req.header('Authorization')
  const token = cookie ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

  if (!token) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } },
      401
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = verifyJwt(token, process.env.JWT_SECRET!)
  } catch {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      401
    )
  }

  // The JWT is only the first gate. Look the user up every request so that a
  // deleted user, a revoked session (password reset/change, role change), or a
  // demotion takes effect immediately rather than lingering until the token
  // expires. The role is taken from the DB, not the token, so role-based checks
  // (including the Layer-2 admin bypasses) always reflect the current role.
  const userId = payload['sub'] as string
  const [user] = await db
    .select({ role: users.role, orgId: users.orgId, sessionInvalidatedAt: users.sessionInvalidatedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Session no longer valid' } },
      401
    )
  }

  if (isSessionRevoked(payload['iat'], user.sessionInvalidatedAt)) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Session no longer valid' } },
      401
    )
  }

  c.set('userId', userId)
  c.set('orgId', user.orgId)
  c.set('role', user.role)

  await next()
})

// Cross-org, the super admin is a platform operator, not a tenant member:
// org-lifecycle routes only (user management for support/break-glass, read-only
// subscription state). Tenant content — documents, queries, compartments,
// groups, grants, analytics — is never accessible across orgs.
const SUPER_ADMIN_CROSS_ORG = [
  { pattern: /^\/api\/v1\/orgs\/[^/]+\/users(\/|$)/, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { pattern: /^\/api\/v1\/orgs\/[^/]+\/subscriptions$/, methods: ['GET'] },
]

export function isSuperAdminCrossOrgAllowed(method: string, path: string): boolean {
  return SUPER_ADMIN_CROSS_ORG.some((rule) => rule.pattern.test(path) && rule.methods.includes(method))
}

export const orgIsolationMiddleware = createMiddleware<AuthVars>(async (c, next) => {
  const requestedOrgId = c.req.param('id')
  const tokenOrgId = c.get('orgId')
  const role = c.get('role')

  if (requestedOrgId !== tokenOrgId) {
    if (role !== 'super_admin') {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this organisation' } },
        403
      )
    }

    if (!isSuperAdminCrossOrgAllowed(c.req.method, c.req.path)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Platform administrators cannot access organisation content. Join the organisation as an admin for support access.',
          },
        },
        403
      )
    }
  }

  await next()
})
