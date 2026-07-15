import { describe, expect, test } from 'bun:test'
import { canAccessChunk, canPublishExternal, defaultVisibility } from './index'
import type { VisibilityPolicy } from '@company-brain/shared'

const basePolicy: VisibilityPolicy = {
  allowedRoles: ['org_admin', 'staff'],
  deniedRoles: [],
  allowedPrincipals: [],
  classification: 'restricted',
}

describe('canAccessChunk', () => {
  test('allows a role listed in allowedRoles', () => {
    expect(canAccessChunk({ visibility: basePolicy, userRole: 'staff', userId: 'u1' })).toBe(true)
  })

  test('denies a role not listed in allowedRoles', () => {
    expect(canAccessChunk({ visibility: basePolicy, userRole: 'external_client', userId: 'u1' })).toBe(false)
  })

  test('deniedRoles wins over allowedRoles', () => {
    const policy: VisibilityPolicy = { ...basePolicy, deniedRoles: ['staff'] }
    expect(canAccessChunk({ visibility: policy, userRole: 'staff', userId: 'u1' })).toBe(false)
  })

  test('allowedPrincipals grants access even when the role is denied', () => {
    const policy: VisibilityPolicy = { ...basePolicy, deniedRoles: ['staff'], allowedPrincipals: ['u1'] }
    expect(canAccessChunk({ visibility: policy, userRole: 'staff', userId: 'u1' })).toBe(true)
    expect(canAccessChunk({ visibility: policy, userRole: 'staff', userId: 'u2' })).toBe(false)
  })

  test('empty allowedRoles means open to everyone not denied', () => {
    const policy: VisibilityPolicy = { ...basePolicy, allowedRoles: [] }
    expect(canAccessChunk({ visibility: policy, userRole: 'external_client', userId: 'u1' })).toBe(true)
  })

  test('missing visibility means open', () => {
    expect(
      canAccessChunk({ visibility: null as unknown as VisibilityPolicy, userRole: 'staff', userId: 'u1' })
    ).toBe(true)
  })
})

describe('defaultVisibility', () => {
  test('internal roles get the internal default', () => {
    const policy = defaultVisibility('staff')
    expect(policy.allowedRoles).toEqual(['super_admin', 'org_admin', 'dept_admin', 'staff'])
    expect(policy.classification).toBe('restricted')
  })

  test('external clients get the external default', () => {
    const policy = defaultVisibility('external_client')
    expect(policy.allowedRoles).toEqual(['external_client'])
    expect(policy.classification).toBe('public')
  })
})

describe('canPublishExternal', () => {
  test('only the paid plan can publish externally', () => {
    expect(canPublishExternal('paid')).toBe(true)
    expect(canPublishExternal('free')).toBe(false)
  })
})
