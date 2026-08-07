import { db, rolePermissions, auditLogs, eq, and } from '@company-brain/db'
import {
  ROLE_PERMISSIONS,
  EDITABLE_ROLES,
  EDITABLE_PERMISSIONS,
  LOCKED_PERMISSIONS,
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

// Locked permissions are resolver-controlled: they are never stored as editable
// rows and are pinned by fixed policy so editing a role's editable permissions
// can neither grant nor strip a locked capability. A role's locked set is
// derived from its code defaults (e.g. org_admin keeps `roles:manage`;
// dept_admin gets none), so editing org_admin's matrix — an editable role —
// can't accidentally remove its non-editable `roles:manage`.
function pinLockedPermissions(role: UserRole, perms: Permission[]): Permission[] {
  const editable = perms.filter((p) => !LOCKED_PERMISSIONS.includes(p))
  const lockedForRole = ROLE_PERMISSIONS[role].filter((p) => LOCKED_PERMISSIONS.includes(p))
  return [...editable, ...lockedForRole]
}

// Builds a matrix from stored rows. An org with no rows is treated as unseeded
// and falls back to the code defaults; once seeded, a role with zero rows
// genuinely has no permissions. super_admin is always pinned to the defaults
// regardless of stored rows (platform-operator invariant); every other role has
// its locked permissions pinned by fixed policy. Pure — no DB.
export function buildMatrix(rows: { role: UserRole; permission: string }[]): RoleMatrix {
  const matrix = rows.length === 0 ? defaultsCopy() : emptyMatrix()
  for (const row of rows) {
    if (matrix[row.role]) matrix[row.role].push(row.permission as Permission)
  }
  matrix.super_admin = [...ROLE_PERMISSIONS.super_admin]
  for (const role of EDITABLE_ROLES) {
    matrix[role] = pinLockedPermissions(role, matrix[role])
  }
  return matrix
}

function emptyMatrix(): RoleMatrix {
  return Object.fromEntries(ALL_ROLES.map((r) => [r, [] as Permission[]])) as RoleMatrix
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
}

// The editing guardrails, factored out so they are testable without a DB:
//  - super_admin (and any non-editable role) is locked
//  - only EDITABLE_PERMISSIONS may be assigned (locked permissions —
//    orgs:manage, roles:manage — are resolver-pinned, never editable)
// No self-lockout guard is needed: editing the matrix is gated by the locked,
// non-editable `roles:manage`, which an actor can neither grant nor strip here.
// Returns an error object to surface, or null when the update is allowed.
export function validateRoleUpdate({
  role,
  permissions,
}: RoleUpdate): { code: string; message: string } | null {
  if (!EDITABLE_ROLES.includes(role)) {
    return { code: 'ROLE_LOCKED', message: 'This role is not editable' }
  }

  const invalid = permissions.filter((p) => !EDITABLE_PERMISSIONS.includes(p))
  if (invalid.length > 0) {
    return { code: 'INVALID_PERMISSION', message: `Not editable: ${invalid.join(', ')}` }
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
}: SetRolePermissionsParams): Promise<ServiceResult<{ role: UserRole; permissions: Permission[] }>> {
  const violation = validateRoleUpdate({ role, permissions })
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

// Seeds the default permission rows for a freshly-provisioned org. Only editable
// permissions are stored — locked permissions (orgs:manage, roles:manage) are
// resolver-pinned, never rows. Call inside the org-creation transaction.
export function seedRolePermissionsValues(orgId: string) {
  return EDITABLE_ROLES.flatMap((role) =>
    ROLE_PERMISSIONS[role]
      .filter((permission) => EDITABLE_PERMISSIONS.includes(permission))
      .map((permission) => ({ orgId, role, permission }))
  )
}
