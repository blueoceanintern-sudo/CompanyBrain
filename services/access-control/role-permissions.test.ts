import { describe, it, expect } from 'bun:test'
import { buildMatrix, validateRoleUpdate, seedRolePermissionsValues } from './role-permissions'
import { ROLE_PERMISSIONS, EDITABLE_ROLES, EDITABLE_PERMISSIONS, LOCKED_PERMISSIONS } from '@company-brain/shared'
import type { UserRole } from '@company-brain/shared'

const sorted = (xs: readonly string[]) => [...xs].sort()

describe('buildMatrix', () => {
  it('falls back to code defaults when the org has no rows (unseeded)', () => {
    const matrix = buildMatrix([])
    // Compared per-role and order-insensitively: pinning may reorder locked
    // permissions to the end, but the effective set is the code default.
    for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
      expect(sorted(matrix[role])).toEqual(sorted(ROLE_PERMISSIONS[role]))
    }
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

  it('pins roles:manage onto org_admin regardless of stored rows', () => {
    // Seeded org with org_admin rows that omit roles:manage — the resolver
    // pins it back so editing the matrix can never strip it.
    const matrix = buildMatrix([{ role: 'org_admin', permission: 'users:manage' }])
    expect(matrix.org_admin).toContain('roles:manage')
  })

  it('never grants a locked permission to a lower role, even if a stray row exists', () => {
    const matrix = buildMatrix([
      { role: 'dept_admin', permission: 'roles:manage' },
      { role: 'staff', permission: 'orgs:manage' },
    ])
    expect(matrix.dept_admin).not.toContain('roles:manage')
    expect(matrix.staff).not.toContain('orgs:manage')
  })
})

describe('validateRoleUpdate', () => {
  it('allows a normal edit to an editable role', () => {
    const err = validateRoleUpdate({
      role: 'staff',
      permissions: ['documents:view', 'queries:submit'],
    })
    expect(err).toBeNull()
  })

  it('rejects editing super_admin', () => {
    const err = validateRoleUpdate({
      role: 'super_admin',
      permissions: ['queries:submit'],
    })
    expect(err?.code).toBe('ROLE_LOCKED')
  })

  it('rejects granting the platform-only orgs:manage permission', () => {
    const err = validateRoleUpdate({
      role: 'org_admin',
      permissions: ['orgs:manage', 'users:manage'],
    })
    expect(err?.code).toBe('INVALID_PERMISSION')
  })

  it('rejects granting the locked roles:manage permission', () => {
    const err = validateRoleUpdate({
      role: 'dept_admin',
      permissions: ['roles:manage', 'documents:view'],
    })
    expect(err?.code).toBe('INVALID_PERMISSION')
  })

  it('allows removing access:manage from a role (no self-lockout — the editor is gated by locked roles:manage)', () => {
    const err = validateRoleUpdate({
      role: 'org_admin',
      permissions: ['users:manage', 'documents:view'],
    })
    expect(err).toBeNull()
  })
})

describe('seedRolePermissionsValues', () => {
  it('emits editable default rows for every editable role and never for super_admin', () => {
    const rows = seedRolePermissionsValues('org-1')
    const roles = new Set(rows.map((r) => r.role))
    expect(roles.has('super_admin' as UserRole)).toBe(false)
    for (const role of EDITABLE_ROLES) {
      const perms = rows.filter((r) => r.role === role).map((r) => r.permission).sort()
      const expected = ROLE_PERMISSIONS[role].filter((p) => EDITABLE_PERMISSIONS.includes(p)).sort()
      expect(perms).toEqual(expected)
    }
    expect(rows.every((r) => r.orgId === 'org-1')).toBe(true)
  })

  it('never seeds a locked permission as an editable row', () => {
    const rows = seedRolePermissionsValues('org-1')
    for (const locked of LOCKED_PERMISSIONS) {
      expect(rows.some((r) => r.permission === locked)).toBe(false)
    }
  })
})
