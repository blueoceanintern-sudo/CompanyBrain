import { describe, expect, test } from 'bun:test'
import { visibilityForTier } from './documents'

// A document's visibility policy is now always derived from its compartment's
// tier (never chosen independently) — this is the single source of truth for
// that mapping, used at upload and whenever a document moves compartments.
describe('visibilityForTier', () => {
  test('internal tier is restricted to internal roles', () => {
    const policy = visibilityForTier('internal')
    expect(policy.allowedRoles).toEqual(['super_admin', 'org_admin', 'dept_admin', 'staff'])
    expect(policy.allowedRoles).not.toContain('external_client')
    expect(policy.classification).toBe('restricted')
  })

  test('external tier is open to external clients too', () => {
    const policy = visibilityForTier('external')
    expect(policy.allowedRoles).toContain('external_client')
    expect(policy.classification).toBe('public')
  })
})
