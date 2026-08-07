import { describe, expect, test } from 'bun:test'
import { validateRoleAssignment, ROLE_RANK } from './constants'

// Guardrails for role assignment on invite and role-change (P0 privilege-
// escalation fix). Each test maps to one of the four rules the guard enforces.
describe('validateRoleAssignment', () => {
  describe('(c) an actor cannot change their own role', () => {
    test('blocks a self role change even to a lower role', () => {
      const v = validateRoleAssignment({
        actorRole: 'org_admin',
        newRole: 'staff',
        targetCurrentRole: 'org_admin',
        isSelf: true,
      })
      expect(v?.code).toBe('SELF_ROLE_CHANGE')
    })
  })

  describe('(d) super_admin targets cannot be modified', () => {
    test('blocks modifying a super_admin, even by a super_admin actor', () => {
      const v = validateRoleAssignment({
        actorRole: 'super_admin',
        newRole: 'staff',
        targetCurrentRole: 'super_admin',
      })
      expect(v?.code).toBe('TARGET_PROTECTED')
    })
  })

  describe('(a) an actor can only modify a target ranked strictly below them', () => {
    test('blocks an org_admin modifying a peer org_admin', () => {
      const v = validateRoleAssignment({
        actorRole: 'org_admin',
        newRole: 'staff',
        targetCurrentRole: 'org_admin',
      })
      expect(v?.code).toBe('FORBIDDEN_TARGET')
    })

    test('allows an org_admin modifying a dept_admin', () => {
      const v = validateRoleAssignment({
        actorRole: 'org_admin',
        newRole: 'staff',
        targetCurrentRole: 'dept_admin',
      })
      expect(v).toBeNull()
    })
  })

  describe('(a)/(b) an actor can only assign a role strictly below their own', () => {
    test('blocks a dept_admin promoting a staff to org_admin (escalation attempt)', () => {
      const v = validateRoleAssignment({
        actorRole: 'dept_admin',
        newRole: 'org_admin',
        targetCurrentRole: 'staff',
      })
      expect(v?.code).toBe('FORBIDDEN_ASSIGN')
    })

    test('blocks an org_admin creating another org_admin (only super_admin may)', () => {
      // Invite path: no targetCurrentRole.
      const v = validateRoleAssignment({ actorRole: 'org_admin', newRole: 'org_admin' })
      expect(v?.code).toBe('FORBIDDEN_ASSIGN')
    })

    test('allows super_admin creating an org_admin', () => {
      const v = validateRoleAssignment({ actorRole: 'super_admin', newRole: 'org_admin' })
      expect(v).toBeNull()
    })

    test('allows an org_admin inviting a staff member', () => {
      const v = validateRoleAssignment({ actorRole: 'org_admin', newRole: 'staff' })
      expect(v).toBeNull()
    })
  })

  describe('ROLE_RANK ordering', () => {
    test('is strictly descending super_admin > org_admin > dept_admin > staff > external_client', () => {
      expect(ROLE_RANK.super_admin).toBeGreaterThan(ROLE_RANK.org_admin)
      expect(ROLE_RANK.org_admin).toBeGreaterThan(ROLE_RANK.dept_admin)
      expect(ROLE_RANK.dept_admin).toBeGreaterThan(ROLE_RANK.staff)
      expect(ROLE_RANK.staff).toBeGreaterThan(ROLE_RANK.external_client)
    })
  })
})
