'use client'

import type { AuthUser } from './api'
import { hasPermission, type Permission } from '@company-brain/shared'

const SESSION_FLAG = 'session_active'

// Gates UI on the user's effective permissions. New sessions carry the resolved
// per-org permission list from login; sessions cached before that field existed
// fall back to the static role defaults (matching what they saw previously).
// Enforcement always happens server-side regardless of what this returns.
export function userCan(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) return false
  if (user.permissions) return user.permissions.includes(permission)
  return hasPermission(user.role, permission)
}

// True when the user holds ANY of the given permissions. Accepts a single
// permission or a list (used for surfaces reachable via more than one grant).
export function userCanAny(user: AuthUser | null | undefined, permissions: Permission | Permission[]): boolean {
  const list = Array.isArray(permissions) ? permissions : [permissions]
  return list.some((p) => userCan(user, p))
}

export function setAuth(user: AuthUser): void {
  localStorage.setItem('auth_user', JSON.stringify(user))
  sessionStorage.setItem(SESSION_FLAG, '1')
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  if (!sessionStorage.getItem(SESSION_FLAG)) return null
  const raw = localStorage.getItem('auth_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuth(): void {
  localStorage.removeItem('auth_user')
  sessionStorage.removeItem(SESSION_FLAG)
}

export function isAuthenticated(): boolean {
  return !!getAuthUser()
}
