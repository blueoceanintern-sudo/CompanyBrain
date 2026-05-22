import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { evaluateVisibility, filterChunksByVisibility, resolveUserPermissions } from "../../../services/access-control"
import { seedDb, clearDb } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgADeptAdmin,
  userOrgAStaff,
  userOrgAExternal,
  chunkOrgAInternal,
  chunkOrgAExternal,
  chunkOrgARestricted,
  chunkNullVisibility,
  chunkEmptyAllowedGroups,
  type VisibilityPolicy,
  type UserRole,
  type AccessTier,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

type UserContext = {
  id: string
  org_id: string
  role: UserRole
  groups?: string[]
}

// ─── evaluateVisibility — core policy resolution ───────────────────────────────

describe("evaluateVisibility — allowedGroups", () => {
  test("user whose role matches an allowedGroup is permitted", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["org_admin"],
      deniedGroups: [],
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    expect(evaluateVisibility(user, policy)).toBe(true)
  })

  test("user whose role is NOT in allowedGroups is denied", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["org_admin"],
      deniedGroups: [],
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })

  test("multiple allowed groups — any matching role grants access", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["org_admin", "dept_admin", "staff"],
      deniedGroups: [],
      allowedPrincipals: [],
      classification: "public",
    }
    const users: UserContext[] = [
      { id: userOrgAAdmin.id,     org_id: ORG_A_ID, role: "org_admin" },
      { id: userOrgADeptAdmin.id, org_id: ORG_A_ID, role: "dept_admin" },
      { id: userOrgAStaff.id,     org_id: ORG_A_ID, role: "staff" },
    ]
    users.forEach(u => expect(evaluateVisibility(u, policy)).toBe(true))
  })

  test("external_client not in allowedGroups is denied", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["staff", "org_admin"],
      deniedGroups: [],
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAExternal.id, org_id: ORG_A_ID, role: "external_client" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })
})

describe("evaluateVisibility — deniedGroups override", () => {
  test("user in deniedGroups is denied even if their role is in allowedGroups", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["staff", "org_admin"],
      deniedGroups: ["staff"],          // staff explicitly denied
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })

  test("user NOT in deniedGroups keeps their allowedGroup access", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["staff", "org_admin"],
      deniedGroups: ["staff"],
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    expect(evaluateVisibility(user, policy)).toBe(true)
  })

  test("deniedGroups takes priority over allowedPrincipals for group-role matching", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: ["staff"],
      deniedGroups: ["staff"],
      allowedPrincipals: [],           // no individual override
      classification: "confidential",
    }
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })
})

describe("evaluateVisibility — allowedPrincipals (individual user access)", () => {
  test("user listed in allowedPrincipals is permitted regardless of role", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: [],                // no group access
      deniedGroups: [],
      allowedPrincipals: [userOrgAStaff.id],
      classification: "confidential",
    }
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    expect(evaluateVisibility(user, policy)).toBe(true)
  })

  test("user NOT listed in allowedPrincipals and not in allowedGroups is denied", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: [],
      deniedGroups: [],
      allowedPrincipals: ["some-other-user-id"],
      classification: "confidential",
    }
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })
})

describe("evaluateVisibility — null and empty policy edge cases", () => {
  test("null visibility policy denies access", () => {
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    expect(evaluateVisibility(user, null)).toBe(false)
  })

  test("empty allowedGroups and empty allowedPrincipals denies everyone", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: [],
      deniedGroups: [],
      allowedPrincipals: [],
      classification: "confidential",
    }
    const users: UserContext[] = [
      { id: userOrgAAdmin.id,     org_id: ORG_A_ID, role: "org_admin" },
      { id: userOrgAStaff.id,     org_id: ORG_A_ID, role: "staff" },
      { id: userOrgAExternal.id,  org_id: ORG_A_ID, role: "external_client" },
    ]
    users.forEach(u => expect(evaluateVisibility(u, policy)).toBe(false))
  })

  test("policy with only deniedGroups and no allowedGroups denies everyone", () => {
    const policy: VisibilityPolicy = {
      allowedGroups: [],
      deniedGroups: ["staff"],
      allowedPrincipals: [],
      classification: "restricted",
    }
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    expect(evaluateVisibility(user, policy)).toBe(false)
  })
})

// ─── filterChunksByVisibility ─────────────────────────────────────────────────

describe("filterChunksByVisibility", () => {
  const allChunks = [
    chunkOrgAInternal,      // allowedGroups: ["hr", "org_admin"]
    chunkOrgAExternal,      // allowedGroups: ["external_client", "staff", "org_admin"]
    chunkOrgARestricted,    // allowedGroups: ["org_admin"], deniedGroups: ["staff", "external_client"]
    chunkNullVisibility,    // null visibility → deny all
    chunkEmptyAllowedGroups, // empty allowedGroups → deny all
  ]

  test("org_admin receives chunks where their role matches allowedGroups", () => {
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    const visible = filterChunksByVisibility(allChunks, user)
    const visibleIds = visible.map(c => c.id)

    expect(visibleIds).toContain(chunkOrgAInternal.id)
    expect(visibleIds).toContain(chunkOrgAExternal.id)
    expect(visibleIds).toContain(chunkOrgARestricted.id)
  })

  test("org_admin never receives null-visibility or empty-allowed-groups chunks", () => {
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    const visible = filterChunksByVisibility(allChunks, user)
    const visibleIds = visible.map(c => c.id)

    expect(visibleIds).not.toContain(chunkNullVisibility.id)
    expect(visibleIds).not.toContain(chunkEmptyAllowedGroups.id)
  })

  test("staff sees external and public chunks but not restricted or null-visibility", () => {
    const user: UserContext = { id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" }
    const visible = filterChunksByVisibility(allChunks, user)
    const visibleIds = visible.map(c => c.id)

    expect(visibleIds).toContain(chunkOrgAExternal.id)      // staff in allowedGroups
    expect(visibleIds).not.toContain(chunkOrgARestricted.id) // staff in deniedGroups
    expect(visibleIds).not.toContain(chunkNullVisibility.id)
    expect(visibleIds).not.toContain(chunkEmptyAllowedGroups.id)
  })

  test("external_client only receives chunks with access_tier: external in their allowedGroups", () => {
    const user: UserContext = { id: userOrgAExternal.id, org_id: ORG_A_ID, role: "external_client" }
    const visible = filterChunksByVisibility(allChunks, user)
    const visibleIds = visible.map(c => c.id)

    expect(visibleIds).toContain(chunkOrgAExternal.id)
    expect(visibleIds).not.toContain(chunkOrgAInternal.id)
    expect(visibleIds).not.toContain(chunkOrgARestricted.id)
  })

  test("empty input array returns empty output", () => {
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    expect(filterChunksByVisibility([], user)).toHaveLength(0)
  })

  test("chunk order is preserved after filtering", () => {
    const user: UserContext = { id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" }
    const ordered = [chunkOrgAExternal, chunkOrgAInternal]
    const visible = filterChunksByVisibility(ordered, user)
    expect(visible[0].id).toBe(chunkOrgAExternal.id)
    expect(visible[1].id).toBe(chunkOrgAInternal.id)
  })
})

// ─── resolveUserPermissions ───────────────────────────────────────────────────

describe("resolveUserPermissions", () => {
  test("org_admin has access to internal access tier", () => {
    const perms = resolveUserPermissions({ id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" })
    expect(perms.allowedAccessTiers).toContain("internal")
  })

  test("org_admin has access to external access tier", () => {
    const perms = resolveUserPermissions({ id: userOrgAAdmin.id, org_id: ORG_A_ID, role: "org_admin" })
    expect(perms.allowedAccessTiers).toContain("external")
  })

  test("external_client is restricted to external access tier only", () => {
    const perms = resolveUserPermissions({ id: userOrgAExternal.id, org_id: ORG_A_ID, role: "external_client" })
    expect(perms.allowedAccessTiers).toContain("external")
    expect(perms.allowedAccessTiers).not.toContain("internal")
  })

  test("staff has access to internal access tier", () => {
    const perms = resolveUserPermissions({ id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" })
    expect(perms.allowedAccessTiers).toContain("internal")
  })

  test("resolveUserPermissions always includes the user's own role group", () => {
    const roles: UserRole[] = ["org_admin", "dept_admin", "staff", "external_client"]
    roles.forEach(role => {
      const perms = resolveUserPermissions({ id: "some-user", org_id: ORG_A_ID, role })
      expect(perms.groups).toContain(role)
    })
  })

  test("return value always has allowedAccessTiers and groups arrays", () => {
    const perms = resolveUserPermissions({ id: userOrgAStaff.id, org_id: ORG_A_ID, role: "staff" })
    expect(Array.isArray(perms.allowedAccessTiers)).toBe(true)
    expect(Array.isArray(perms.groups)).toBe(true)
  })
})
