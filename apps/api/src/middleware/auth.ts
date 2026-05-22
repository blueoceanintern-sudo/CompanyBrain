import { createMiddleware } from "hono/factory"
import type { UserRole } from "../../../../shared/types"

export interface AuthUser {
  sub:    string
  org_id: string
  role:   UserRole
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export const auth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization")
  if (!header?.startsWith("Bearer ")) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing auth token." } }, 401)
  }

  const token = header.slice(7)
  let payload: AuthUser

  try {
    // Decode the base64 test token (replace with real JWT in production)
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    payload = JSON.parse(decoded) as AuthUser
    if (!payload.sub || !payload.org_id || !payload.role) throw new Error("Invalid")
  } catch {
    return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid auth token." } }, 401)
  }

  c.set("user", payload)
  await next()
})

export function requireOrgAccess(c: Parameters<typeof createMiddleware>[0], orgId: string): boolean {
  const user = c.get("user")
  return user.org_id === orgId
}
