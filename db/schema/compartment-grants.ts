import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { orgs } from './orgs'
import { users } from './users'
import { compartments } from './compartments'
import { groups } from './groups'

// Grants access to a restricted compartment for exactly one subject: a user
// OR a group. The one-of constraint is a SQL CHECK added in the migration
// (drizzle-orm 0.31 has no check() builder).
export const compartmentGrants = pgTable(
  'compartment_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    compartmentId: uuid('compartment_id')
      .notNull()
      .references(() => compartments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userGrantUnique: unique().on(t.compartmentId, t.userId),
    groupGrantUnique: unique().on(t.compartmentId, t.groupId),
  })
)

export type CompartmentGrant = typeof compartmentGrants.$inferSelect
export type NewCompartmentGrant = typeof compartmentGrants.$inferInsert
