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
  if (visibility.deniedGroups?.includes(userRole)) return false
  if (!visibility.allowedGroups?.length) return true
  return visibility.allowedGroups.includes(userRole)
}

export function canPublishExternal(orgPlan: OrgPlan): boolean {
  return orgPlan === 'paid'
}

export function defaultVisibility(userRole: UserRole): VisibilityPolicy {
  const isExternal = userRole === 'external_client'
  return {
    allowedGroups: isExternal
      ? ['external_client']
      : ['super_admin', 'org_admin', 'dept_admin', 'staff'],
    deniedGroups: [],
    allowedPrincipals: [],
    classification: isExternal ? 'public' : 'restricted',
  }
}
