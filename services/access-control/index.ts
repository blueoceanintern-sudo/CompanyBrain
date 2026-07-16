import { db } from '@company-brain/db'
import { sql } from 'drizzle-orm'
import type { VisibilityPolicy, UserRole, OrgPlan } from '@company-brain/shared'

export { hasPermission } from '@company-brain/shared'

interface CanAccessParams {
  visibility: VisibilityPolicy
  userRole: UserRole
  userId: string
}

export function canAccessChunk({ visibility, userRole, userId }: CanAccessParams): boolean {
  if (!visibility) return true
  if (visibility.allowedPrincipals?.includes(userId)) return true
  if (visibility.deniedRoles?.includes(userRole)) return false
  if (!visibility.allowedRoles?.length) return true
  return visibility.allowedRoles.includes(userRole)
}

export function canPublishExternal(orgPlan: OrgPlan): boolean {
  return orgPlan === 'paid'
}

interface CompartmentAccessParams {
  orgId: string
  compartmentId: string
  userId: string
  userRole: UserRole
}

// A restricted compartment is usable only with a grant — held directly or via
// group membership. Unrestricted compartments are open to all internal roles;
// org_admin and super_admin bypass grants entirely.
//
// Access narrows down the hierarchy: a sub-compartment is usable only by users
// who can also use its parent. A grant on a sub never bypasses the parent, so
// revoking parent access cuts off the whole subtree.
export async function canUseCompartment({
  orgId,
  compartmentId,
  userId,
  userRole,
}: CompartmentAccessParams): Promise<boolean> {
  if (userRole === 'super_admin' || userRole === 'org_admin') return true

  const rows = await db.execute(sql`
    SELECT 1
    FROM compartments cp
    LEFT JOIN compartments pp ON pp.id = cp.parent_compartment_id
    WHERE cp.id = ${compartmentId}
      AND cp.org_id = ${orgId}
      AND (
        NOT cp.restricted
        OR EXISTS (
          SELECT 1 FROM compartment_grants g
          WHERE g.compartment_id = cp.id
            AND (
              g.user_id = ${userId}
              OR g.group_id IN (
                SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
              )
            )
        )
      )
      AND (
        pp.id IS NULL
        OR NOT pp.restricted
        OR EXISTS (
          SELECT 1 FROM compartment_grants g
          WHERE g.compartment_id = pp.id
            AND (
              g.user_id = ${userId}
              OR g.group_id IN (
                SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ${userId}
              )
            )
        )
      )
    LIMIT 1
  `)
  return (rows as unknown[]).length > 0
}

export function defaultVisibility(userRole: UserRole): VisibilityPolicy {
  const isExternal = userRole === 'external_client'
  return {
    allowedRoles: isExternal
      ? ['external_client']
      : ['super_admin', 'org_admin', 'dept_admin', 'staff'],
    deniedRoles: [],
    allowedPrincipals: [],
    classification: isExternal ? 'public' : 'restricted',
  }
}
