import { db, rolePermissions, auditLogs, eq, and } from '@company-brain/db'
import {
  ROLE_PERMISSIONS,
  EDITABLE_ROLES,
  EDITABLE_PERMISSIONS,
  type UserRole,
  type Permission,
  type ServiceResult,
} from '@company-brain/shared'

type RoleMatrix = Record<UserRole, Permission[]>

const ALL_ROLES: UserRole[] = ['super_admin', 'org_admin', 'dept_admin', 'staff', 'external_client']

// Per-org matrices are cached for the lifetime of the API process and busted on
// every write. Permission changes therefore take effect on the next request
// without a token refresh (the JWT carries only the role, never permissions).
const cache = new Map<string, RoleMatrix>()

function defaultsCopy(): RoleMatrix {
  return Object.fromEntries(
    ALL_ROLES.map((r) => [r, [...ROLE_PERMISSIONS[r]]])
  ) as RoleMatrix
}

export function invalidateRolePermissions(orgId: string): void {
  cache.delete(orgId)
}

// Builds a matrix from stored rows. An org with no rows is treated as unseeded
// and falls back to the code defaults; once seeded, a role with zero rows
// genuinely has no permissions. super_admin is always pinned to the defaults
// regardless of stored rows (platform-operator invariant). Pure — no DB.
export function buildMatrix(rows: { role: UserRole; permission: string }[]): RoleMatrix {
  if (rows.length === 0) return defaultsCopy()

  const matrix = Object.fromEntries(ALL_ROLES.map((r) => [r, [] as Permission[]])) as RoleMatrix
  for (const row of rows) {
    if (matrix[row.role]) matrix[row.role].push(row.permission as Permission)
  }
  matrix.super_admin = [...ROLE_PERMISSIONS.super_admin]
  return matrix
}

// Resolves the effective role → permission matrix for an org, cached.
export async function getRolePermissions(orgId: string): Promise<RoleMatrix> {
  const cached = cache.get(orgId)
  if (cached) return cached

  const rows = await db
    .select({ role: rolePermissions.role, permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.orgId, orgId))

  const matrix = buildMatrix(rows as { role: UserRole; permission: string }[])
  cache.set(orgId, matrix)
  return matrix
}

export async function hasPermission(
  orgId: string,
  role: UserRole,
  permission: Permission
): Promise<boolean> {
  const matrix = await getRolePermissions(orgId)
  return matrix[role]?.includes(permission) ?? false
}

interface RoleUpdate {
  role: UserRole
  permissions: Permission[]
  actorRole: UserRole
}

// The editing guardrails, factored out so they are testable without a DB:
//  - super_admin (and any non-editable role) is locked
//  - only EDITABLE_PERMISSIONS may be assigned (orgs:manage stays super-admin-only)
//  - the actor may not strip access:manage from their own role (self-lockout) —
//    access:manage is what gates editing this matrix
// Returns an error object to surface, or null when the update is allowed.
export function validateRoleUpdate({
  role,
  permissions,
  actorRole,
}: RoleUpdate): { code: string; message: string } | null {
  if (!EDITABLE_ROLES.includes(role)) {
    return { code: 'ROLE_LOCKED', message: 'This role is not editable' }
  }

  const invalid = permissions.filter((p) => !EDITABLE_PERMISSIONS.includes(p))
  if (invalid.length > 0) {
    return { code: 'INVALID_PERMISSION', message: `Not editable: ${invalid.join(', ')}` }
  }

  if (role === actorRole && !permissions.includes('access:manage')) {
    return {
      code: 'SELF_LOCKOUT',
      message: 'You cannot remove "Manage permissions & groups" from your own role',
    }
  }

  return null
}

interface SetRolePermissionsParams extends RoleUpdate {
  orgId: string
  actorUserId: string
}

// Replaces the permission set for a single role. Enforces the editing
// guardrails and records an audit entry atomically with the change.
export async function setRolePermissions({
  orgId,
  role,
  permissions,
  actorUserId,
  actorRole,
}: SetRolePermissionsParams): Promise<ServiceResult<{ role: UserRole; permissions: Permission[] }>> {
  const violation = validateRoleUpdate({ role, permissions, actorRole })
  if (violation) {
    return { success: false, error: violation }
  }

  const deduped = [...new Set(permissions)]
  const before = (await getRolePermissions(orgId))[role]

  await db.transaction(async (tx) => {
    await tx
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.orgId, orgId), eq(rolePermissions.role, role)))
    if (deduped.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(deduped.map((permission) => ({ orgId, role, permission })))
    }
    await tx.insert(auditLogs).values({
      orgId,
      userId: actorUserId,
      action: 'role.permissions_update',
      resourceType: 'role',
      resourceId: role,
      metadata: { role, before, after: deduped },
    })
  })

  invalidateRolePermissions(orgId)
  return { success: true, data: { role, permissions: deduped } }
}

// Seeds the default permission rows for a freshly-provisioned org. Call inside
// the org-creation transaction (pass the tx as `runner`).
export function seedRolePermissionsValues(orgId: string) {
  return EDITABLE_ROLES.flatMap((role) =>
    ROLE_PERMISSIONS[role].map((permission) => ({ orgId, role, permission }))
  )
}
