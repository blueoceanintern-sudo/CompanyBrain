import { describe, expect, test } from 'bun:test'
import { isSuperAdminCrossOrgAllowed } from './auth'

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
