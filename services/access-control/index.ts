import type { VisibilityPolicy, UserRole } from '@company-brain/shared'

interface CanAccessParams {
  visibility: VisibilityPolicy
  userRole: UserRole
  userId: string
}

export function canAccessChunk({ visibility, userRole, userId }: CanAccessParams): boolean {
  // Explicit principal allow-list takes priority
  if (visibility.allowedPrincipals.includes(userId)) return true

  // Denied group check
  if (visibility.deniedGroups.includes(userRole)) return false

  // Allowed group check
  if (visibility.allowedGroups.length === 0) return true
  return visibility.allowedGroups.includes(userRole)
}

export function defaultVisibility(userRole: UserRole): VisibilityPolicy {
  const internalRoles: UserRole[] = ['super_admin', 'org_admin', 'dept_admin', 'staff']
  const externalRoles: UserRole[] = ['external_client']

  const isExternal = externalRoles.includes(userRole)

  return {
    allowedGroups: isExternal ? ['external_client'] : internalRoles,
    deniedGroups: [],
    allowedPrincipals: [],
    classification: isExternal ? 'public' : 'restricted',
  }
}

export function canManageDocuments(role: UserRole): boolean {
  return role === 'super_admin' || role === 'org_admin' || role === 'dept_admin'
}

export function canViewAnalytics(role: UserRole): boolean {
  return role === 'super_admin' || role === 'org_admin'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'super_admin' || role === 'org_admin'
}

export function canManageBilling(role: UserRole): boolean {
  return role === 'super_admin' || role === 'org_admin'
}
