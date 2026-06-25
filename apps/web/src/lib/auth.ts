'use client'

import type { AuthUser } from './api'

const SESSION_FLAG = 'session_active'

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
