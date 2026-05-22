import type { VisibilityPolicy, UserRole, AccessTier, ServiceResult } from "../shared/types"
import { ok, err } from "../shared/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkWithVisibility {
  id:          string
  org_id:      string
  access_tier: AccessTier
  visibility:  VisibilityPolicy | null
  [key: string]: unknown
}

export interface UserPermissions {
  userId:     string
  orgId:      string
  role:       UserRole
  groups:     string[]
  accessTier: AccessTier
}

// ─── Role → group mapping ─────────────────────────────────────────────────────

const ROLE_GROUPS: Record<UserRole, string[]> = {
  super_admin:     ["super_admin", "org_admin", "dept_admin", "staff", "external_client"],
  org_admin:       ["org_admin", "dept_admin", "staff"],
  dept_admin:      ["dept_admin", "staff"],
  staff:           ["staff"],
  external_client: ["external_client"],
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveUserPermissions(
  userId: string,
  orgId: string,
  role: UserRole,
  accessTier: AccessTier,
): UserPermissions {
  return {
    userId,
    orgId,
    role,
    groups: ROLE_GROUPS[role] ?? [],
    accessTier,
  }
}

/**
 * Evaluates whether a user can see a chunk based on its visibility JSONB.
 *
 * Rules (applied in order):
 * 1. Null / missing visibility → deny all non-super_admin
 * 2. Empty allowedGroups + empty allowedPrincipals → deny everyone
 * 3. User's role group in deniedGroups → deny
 * 4. User's role group in allowedGroups OR userId in allowedPrincipals → allow
 * 5. Otherwise → deny
 */
export function evaluateVisibility(
  visibility: VisibilityPolicy | null,
  user: UserPermissions,
): boolean {
  if (visibility === null || visibility === undefined) {
    return user.role === "super_admin"
  }

  const { allowedGroups, deniedGroups, allowedPrincipals } = visibility

  if (allowedGroups.length === 0 && allowedPrincipals.length === 0) {
    return false
  }

  const userGroups = ROLE_GROUPS[user.role] ?? []

  for (const group of userGroups) {
    if (deniedGroups.includes(group)) return false
  }

  for (const group of userGroups) {
    if (allowedGroups.includes(group)) return true
  }

  if (allowedPrincipals.includes(user.userId)) return true

  return false
}

/**
 * Filters a list of chunks by:
 * 1. org_id scoping
 * 2. access_tier enforcement (external users cannot see internal chunks)
 * 3. visibility JSONB policy
 */
export function filterChunksByVisibility<T extends ChunkWithVisibility>(
  chunks: T[],
  user: UserPermissions,
): T[] {
  return chunks.filter(chunk => {
    if (chunk.org_id !== user.orgId) return false

    if (user.accessTier === "external" && chunk.access_tier === "internal") return false

    return evaluateVisibility(chunk.visibility, user)
  })
}

// ─── Service wrapper (for use in route handlers) ──────────────────────────────

export function checkOrgAccess(
  requestedOrgId: string,
  tokenOrgId: string,
): ServiceResult<void> {
  if (requestedOrgId !== tokenOrgId) {
    return err("FORBIDDEN", "Access denied to this organisation.")
  }
  return ok(undefined)
}

export function checkRole(
  userRole: UserRole,
  requiredRoles: UserRole[],
): ServiceResult<void> {
  if (!requiredRoles.includes(userRole)) {
    return err("FORBIDDEN", "Your role does not permit this action.")
  }
  return ok(undefined)
}
