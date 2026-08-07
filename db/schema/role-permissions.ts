import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { userRoleEnum } from './enums'
import { orgs } from './orgs'

// Per-org role → permission grants. Seeded from the ROLE_PERMISSIONS defaults
// when an org is provisioned, then editable by users:manage holders. An org is
// considered "seeded" when it has at least one row here; until then the resolver
// falls back to the code defaults (see services/access-control/role-permissions).
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    permission: text('permission').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgRolePermUnique: unique().on(t.orgId, t.role, t.permission),
  })
)

export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert
