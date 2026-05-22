import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { seedDb, clearDb, authedRequest, request } from "../../helpers/setup"
import {
  ORG_A_ID,
  userOrgAAdmin,
  userOrgADeptAdmin,
  userOrgAStaff,
  userOrgAExternal,
  compartmentAHr,
  compartmentALegal,
} from "../../helpers/fixtures"

beforeAll(async () => { await seedDb() })
afterAll(async () => { await clearDb() })

// ─── Compartments — create ─────────────────────────────────────────────────────

describe("POST /orgs/:id/compartments — create", () => {
  test("org_admin can create a compartment and receives 201 with compartment data", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin, {
      method: "POST",
      body: { name: "Finance", description: "Finance documents" },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("id")
    expect(body.data.name).toBe("Finance")
    expect(body.data.org_id).toBe(ORG_A_ID)
  })

  test("created compartment is scoped to the correct org_id", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin, {
      method: "POST",
      body: { name: "Scoping Test", description: "verify org scope" },
    })
    const body = await res.json()
    expect(body.data.org_id).toBe(ORG_A_ID)
  })

  test("missing name returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin, {
      method: "POST",
      body: { description: "no name given" },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toHaveProperty("code")
  })

  test("empty name string returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin, {
      method: "POST",
      body: { name: "", description: "blank name" },
    })
    expect(res.status).toBe(400)
  })

  test("dept_admin cannot create a compartment — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgADeptAdmin, {
      method: "POST",
      body: { name: "Rogue", description: "should not be created" },
    })
    expect(res.status).toBe(403)
  })

  test("staff cannot create a compartment — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAStaff, {
      method: "POST",
      body: { name: "Rogue", description: "should not be created" },
    })
    expect(res.status).toBe(403)
  })
})

// ─── Compartments — list ───────────────────────────────────────────────────────

describe("GET /orgs/:id/compartments — list", () => {
  test("org_admin receives 200 with array of compartments", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test("all returned compartments belong to the scoped org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAAdmin)
    const body = await res.json()
    const compartments: Array<{ org_id: string }> = body.data ?? []
    compartments.forEach(c => expect(c.org_id).toBe(ORG_A_ID))
  })

  test("staff cannot list compartments — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/compartments`, userOrgAStaff)
    expect(res.status).toBe(403)
  })

  test("unauthenticated request returns 401", async () => {
    const res = await request(`/api/v1/orgs/${ORG_A_ID}/compartments`)
    expect(res.status).toBe(401)
  })
})

// ─── Compartments — update ────────────────────────────────────────────────────

describe("PATCH /orgs/:id/compartments/:cId — update", () => {
  test("org_admin can update compartment name and receives updated data", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/compartments/${compartmentAHr.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { name: "Human Resources" } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.name).toBe("Human Resources")
  })

  test("org_admin can update compartment description", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/compartments/${compartmentAHr.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { description: "Updated HR description" } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.description).toBe("Updated HR description")
  })

  test("patching a non-existent compartment returns 404", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/compartments/does-not-exist`,
      userOrgAAdmin,
      { method: "PATCH", body: { name: "Ghost" } }
    )
    expect(res.status).toBe(404)
  })

  test("staff cannot update a compartment — returns 403", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/compartments/${compartmentAHr.id}`,
      userOrgAStaff,
      { method: "PATCH", body: { name: "Hijacked" } }
    )
    expect(res.status).toBe(403)
  })

  test("patching with empty name returns 400", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/compartments/${compartmentAHr.id}`,
      userOrgAAdmin,
      { method: "PATCH", body: { name: "" } }
    )
    expect(res.status).toBe(400)
  })
})

// ─── Users — invite ────────────────────────────────────────────────────────────

describe("POST /orgs/:id/users — invite", () => {
  test("org_admin can invite a user and receives 201 with user data", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "newuser@orga.test", role: "staff" },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("id")
    expect(body.data.email).toBe("newuser@orga.test")
    expect(body.data.org_id).toBe(ORG_A_ID)
    expect(body.data.role).toBe("staff")
  })

  test("invited user is scoped to the correct org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "orgscope@orga.test", role: "staff" },
    })
    const body = await res.json()
    expect(body.data.org_id).toBe(ORG_A_ID)
  })

  test("inviting an email that already exists in the org returns 409", async () => {
    // First invite
    await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "duplicate@orga.test", role: "staff" },
    })
    // Duplicate invite
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "duplicate@orga.test", role: "staff" },
    })
    expect(res.status).toBe(409)
  })

  test("missing email returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { role: "staff" },
    })
    expect(res.status).toBe(400)
  })

  test("invalid email format returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "not-an-email", role: "staff" },
    })
    expect(res.status).toBe(400)
  })

  test("missing role returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "norole@orga.test" },
    })
    expect(res.status).toBe(400)
  })

  test("invalid role value returns 400", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "badrole@orga.test", role: "god_mode" },
    })
    expect(res.status).toBe(400)
  })

  test("org_admin cannot invite a super_admin — returns 400 or 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin, {
      method: "POST",
      body: { email: "superadmin@orga.test", role: "super_admin" },
    })
    expect([400, 403]).toContain(res.status)
  })

  test("staff cannot invite users — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAStaff, {
      method: "POST",
      body: { email: "sneaky@orga.test", role: "staff" },
    })
    expect(res.status).toBe(403)
  })

  test("external_client cannot invite users — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAExternal, {
      method: "POST",
      body: { email: "sneaky@orga.test", role: "external_client" },
    })
    expect(res.status).toBe(403)
  })
})

// ─── Users — list ─────────────────────────────────────────────────────────────

describe("GET /orgs/:id/users — list", () => {
  test("org_admin receives 200 with array of users", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test("all returned users belong to the scoped org", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin)
    const body = await res.json()
    const users: Array<{ org_id: string }> = body.data ?? []
    users.forEach(u => expect(u.org_id).toBe(ORG_A_ID))
  })

  test("user records include id, email, role, org_id", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin)
    const body = await res.json()
    if (body.data.length > 0) {
      const user = body.data[0]
      expect(user).toHaveProperty("id")
      expect(user).toHaveProperty("email")
      expect(user).toHaveProperty("role")
      expect(user).toHaveProperty("org_id")
    }
  })

  test("staff cannot list users — returns 403", async () => {
    const res = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAStaff)
    expect(res.status).toBe(403)
  })
})

// ─── Users — role update ──────────────────────────────────────────────────────

describe("PATCH /orgs/:id/users/:userId/role — role update", () => {
  test("org_admin can change another user's role and receives updated data", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "dept_admin" } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.role).toBe("dept_admin")
  })

  test("role change is reflected in the users list after the update", async () => {
    await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAExternal.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "staff" } }
    )
    const listRes = await authedRequest(`/api/v1/orgs/${ORG_A_ID}/users`, userOrgAAdmin)
    const body = await listRes.json()
    const updated = body.data.find((u: { id: string }) => u.id === userOrgAExternal.id)
    expect(updated?.role).toBe("staff")
  })

  test("org_admin cannot elevate a user to super_admin — returns 400 or 403", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "super_admin" } }
    )
    expect([400, 403]).toContain(res.status)
  })

  test("staff cannot change their own role — returns 403", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAStaff,
      { method: "PATCH", body: { role: "org_admin" } }
    )
    expect(res.status).toBe(403)
  })

  test("invalid role value returns 400", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "janitor" } }
    )
    expect(res.status).toBe(400)
  })

  test("updating role of a non-existent user returns 404", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/does-not-exist/role`,
      userOrgAAdmin,
      { method: "PATCH", body: { role: "staff" } }
    )
    expect(res.status).toBe(404)
  })

  test("missing role field in body returns 400", async () => {
    const res = await authedRequest(
      `/api/v1/orgs/${ORG_A_ID}/users/${userOrgAStaff.id}/role`,
      userOrgAAdmin,
      { method: "PATCH", body: {} }
    )
    expect(res.status).toBe(400)
  })
})
