'use client'

import type { AuthUser } from './api'

export function setAuth(user: AuthUser): void {
  localStorage.setItem('auth_user', JSON.stringify(user))
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
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
}

export function isAuthenticated(): boolean {
  return !!getAuthUser()
}
