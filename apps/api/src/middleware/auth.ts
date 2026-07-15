import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../lib/jwt'
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
    const payload = verifyJwt(token, process.env.JWT_SECRET!)

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

export const orgIsolationMiddleware = createMiddleware<AuthVars>(async (c, next) => {
  const requestedOrgId = c.req.param('id')
  const tokenOrgId = c.get('orgId')
  const role = c.get('role')

  if (role !== 'super_admin' && requestedOrgId !== tokenOrgId) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied to this organisation' } },
      403
    )
  }

  await next()
})
