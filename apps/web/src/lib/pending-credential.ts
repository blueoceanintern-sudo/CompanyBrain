'use client'

// Ephemeral, in-memory carrier for an invited user's temporary password so the
// forced first-login change screen can prefill "Current Password" without them
// retyping it. Deliberately NOT persisted — no localStorage/sessionStorage, no
// URL, no cookie. It lives only in this module's memory for the soft client-side
// navigation from /login → /change-password and is cleared once consumed or on
// any full page reload. Real (already-set) passwords are never put here; only
// the temporary invite password, and only during the forced-change flow.
let pendingTempPassword: string | null = null

export function stashTempPassword(password: string): void {
  pendingTempPassword = password
}

export function peekTempPassword(): string | null {
  return pendingTempPassword
}

export function clearTempPassword(): void {
  pendingTempPassword = null
}
