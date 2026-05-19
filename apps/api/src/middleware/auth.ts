import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import type { UserRole } from '@company-brain/shared'

export type AuthVars = {
  Variables: {
    userId: string
    orgId: string
    role: UserRole
  }
}

export const authMiddleware = createMiddleware<AuthVars>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

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
