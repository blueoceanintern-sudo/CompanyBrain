import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import { getCookie } from 'hono/cookie'
import type { UserRole } from '@company-brain/shared'

export type AuthVars = {
  Variables: {
    userId: string
    orgId: string
    role: UserRole
  }
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

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)

    c.set('userId', payload['sub'] as string)
    c.set('orgId', payload['orgId'] as string)
    c.set('role', payload['role'] as UserRole)

    await next()
  } catch {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      401
    )
  }
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
