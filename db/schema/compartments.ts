import { pgTable, text, uuid, timestamp, boolean, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const compartments = pgTable('compartments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  restricted: boolean('restricted').notNull().default(false),
  // One level of nesting only (a parent cannot itself have a parent) —
  // enforced in the admin route. RESTRICT backs up the "delete subs first"
  // rule at the DB level. Access narrows down the tree: reaching a
  // sub-compartment always requires access to its parent.
  parentCompartmentId: uuid('parent_compartment_id').references((): AnyPgColumn => compartments.id, {
    onDelete: 'restrict',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Compartment = typeof compartments.$inferSelect
export type NewCompartment = typeof compartments.$inferInsert
