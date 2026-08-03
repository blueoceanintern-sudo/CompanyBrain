import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  hasPermission,
  getRolePermissions,
  setRolePermissions,
} from '@company-brain/access-control'
import { EDITABLE_ROLES, EDITABLE_PERMISSIONS, type UserRole } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

// Per-org role → permission matrix editing. Read/write both require
// roles:manage — a locked, non-editable capability held only by super_admin and
// org_admin, kept separate from access:manage (groups + compartment grants).
const rolesRoute = new Hono<AuthVars>()

const FORBIDDEN = { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } } as const

rolesRoute.use('*', async (c, next) => {
  if (!(await hasPermission(c.get('orgId'), c.get('role'), 'roles:manage'))) {
    return c.json(FORBIDDEN, 403)
  }
  await next()
})

// GET /api/v1/orgs/:id/roles — full matrix plus what the UI may edit
rolesRoute.get('/', async (c) => {
  const matrix = await getRolePermissions(c.get('orgId'))
  return c.json({
    success: true,
    data: { matrix, editableRoles: EDITABLE_ROLES, editablePermissions: EDITABLE_PERMISSIONS },
  })
})

const updateSchema = z.object({
  permissions: z.array(z.string()),
})

const STATUS: Record<string, 400 | 403> = {
  ROLE_LOCKED: 403,
  INVALID_PERMISSION: 400,
}

// PUT /api/v1/orgs/:id/roles/:role — replace one role's permission set
rolesRoute.put('/:role', zValidator('json', updateSchema), async (c) => {
  const role = c.req.param('role') as UserRole
  const { permissions } = c.req.valid('json')

  const result = await setRolePermissions({
    orgId: c.get('orgId'),
    role,
    permissions: permissions as Parameters<typeof setRolePermissions>[0]['permissions'],
    actorUserId: c.get('userId'),
  })

  if (!result.success) {
    return c.json(result, STATUS[result.error.code] ?? 400)
  }
  return c.json(result)
})

export default rolesRoute
