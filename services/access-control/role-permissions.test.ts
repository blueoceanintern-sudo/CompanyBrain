import { describe, it, expect } from 'bun:test'
import { buildMatrix, validateRoleUpdate, seedRolePermissionsValues } from './role-permissions'
import { ROLE_PERMISSIONS, EDITABLE_ROLES } from '@company-brain/shared'
import type { UserRole } from '@company-brain/shared'

describe('buildMatrix', () => {
  it('falls back to code defaults when the org has no rows (unseeded)', () => {
    const matrix = buildMatrix([])
    expect(matrix).toEqual(ROLE_PERMISSIONS)
  })

  it('reflects stored rows once the org is seeded', () => {
    const matrix = buildMatrix([
      { role: 'staff', permission: 'queries:submit' },
      { role: 'staff', permission: 'documents:view' },
      { role: 'dept_admin', permission: 'documents:manage' },
    ])
    expect(matrix.staff.sort()).toEqual(['documents:view', 'queries:submit'])
    expect(matrix.dept_admin).toEqual(['documents:manage'])
  })

  it('treats a seeded role with no rows as genuinely empty, not defaulted', () => {
    // org has rows (seeded) but none for staff → staff has no permissions
    const matrix = buildMatrix([{ role: 'org_admin', permission: 'users:manage' }])
    expect(matrix.staff).toEqual([])
  })

  it('pins super_admin to defaults even if rows try to change it', () => {
    const matrix = buildMatrix([{ role: 'super_admin', permission: 'queries:submit' }])
    expect(matrix.super_admin).toEqual(ROLE_PERMISSIONS.super_admin)
  })
})

describe('validateRoleUpdate', () => {
  it('allows a normal edit to an editable role', () => {
    const err = validateRoleUpdate({
      role: 'staff',
      permissions: ['documents:view', 'queries:submit'],
      actorRole: 'org_admin',
    })
    expect(err).toBeNull()
  })

  it('rejects editing super_admin', () => {
    const err = validateRoleUpdate({
      role: 'super_admin',
      permissions: ['queries:submit'],
      actorRole: 'super_admin',
    })
    expect(err?.code).toBe('ROLE_LOCKED')
  })

  it('rejects granting the platform-only orgs:manage permission', () => {
    const err = validateRoleUpdate({
      role: 'org_admin',
      permissions: ['orgs:manage', 'users:manage'],
      actorRole: 'super_admin',
    })
    expect(err?.code).toBe('INVALID_PERMISSION')
  })

  it('rejects an actor stripping access:manage from their own role (self-lockout)', () => {
    const err = validateRoleUpdate({
      role: 'org_admin',
      permissions: ['users:manage', 'documents:view'],
      actorRole: 'org_admin',
    })
    expect(err?.code).toBe('SELF_LOCKOUT')
  })

  it('allows an actor to remove users:manage from their own role (only access:manage is protected)', () => {
    const err = validateRoleUpdate({
      role: 'org_admin',
      permissions: ['access:manage', 'documents:view'],
      actorRole: 'org_admin',
    })
    expect(err).toBeNull()
  })

  it('allows removing access:manage from a role that is not the actor’s own', () => {
    const err = validateRoleUpdate({
      role: 'dept_admin',
      permissions: ['documents:view'],
      actorRole: 'org_admin',
    })
    expect(err).toBeNull()
  })
})

describe('seedRolePermissionsValues', () => {
  it('emits default rows for every editable role and never for super_admin', () => {
    const rows = seedRolePermissionsValues('org-1')
    const roles = new Set(rows.map((r) => r.role))
    expect(roles.has('super_admin' as UserRole)).toBe(false)
    for (const role of EDITABLE_ROLES) {
      const perms = rows.filter((r) => r.role === role).map((r) => r.permission).sort()
      expect(perms).toEqual([...ROLE_PERMISSIONS[role]].sort())
    }
    expect(rows.every((r) => r.orgId === 'org-1')).toBe(true)
  })
})
