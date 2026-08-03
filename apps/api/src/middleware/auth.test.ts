import { describe, expect, test } from 'bun:test'
import { isSuperAdminCrossOrgAllowed, isSessionRevoked } from './auth'

const ORG = '/api/v1/orgs/11111111-2222-3333-4444-555555555555'

describe('isSuperAdminCrossOrgAllowed', () => {
  test('allows cross-org user management (support / break-glass path)', () => {
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/users`)).toBe(true)
    expect(isSuperAdminCrossOrgAllowed('POST', `${ORG}/users`)).toBe(true)
    expect(isSuperAdminCrossOrgAllowed('PATCH', `${ORG}/users/abc/role`)).toBe(true)
    expect(isSuperAdminCrossOrgAllowed('DELETE', `${ORG}/users/abc`)).toBe(true)
  })

  test('allows read-only cross-org subscription state', () => {
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/subscriptions`)).toBe(true)
    expect(isSuperAdminCrossOrgAllowed('POST', `${ORG}/subscriptions`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('DELETE', `${ORG}/subscriptions`)).toBe(false)
  })

  test('blocks all cross-org tenant content', () => {
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/documents`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('POST', `${ORG}/query`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/queries`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/compartments`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/groups`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('PUT', `${ORG}/compartments/abc/grants`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/analytics/overview`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/analytics/export`)).toBe(false)
  })

  test('does not match look-alike paths', () => {
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/users-export`)).toBe(false)
    expect(isSuperAdminCrossOrgAllowed('GET', `${ORG}/subscriptions/history`)).toBe(false)
  })
})

describe('isSessionRevoked', () => {
  // A token issued at this instant (seconds).
  const iat = 1_700_000_000

  test('is not revoked when the account has never invalidated a session', () => {
    expect(isSessionRevoked(iat, null)).toBe(false)
  })

  test('revokes a token issued before the invalidation instant', () => {
    const invalidatedAt = new Date((iat + 60) * 1000) // 60s after the token
    expect(isSessionRevoked(iat, invalidatedAt)).toBe(true)
  })

  test('keeps a token issued after the invalidation instant (fresh re-login)', () => {
    const invalidatedAt = new Date((iat - 60) * 1000) // 60s before the token
    expect(isSessionRevoked(iat, invalidatedAt)).toBe(false)
  })

  test('keeps a token minted in the same second as the invalidation (re-issued cookie)', () => {
    // The password-change route bumps sessionInvalidatedAt and hands back a
    // fresh token in the same second; sub-second precision must not revoke it.
    const invalidatedAt = new Date(iat * 1000 + 500)
    expect(isSessionRevoked(iat, invalidatedAt)).toBe(false)
  })

  test('treats a token with no iat as not revoked (nothing to compare)', () => {
    expect(isSessionRevoked(undefined, new Date())).toBe(false)
  })
})
