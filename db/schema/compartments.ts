import { pgTable, text, uuid, timestamp, boolean } from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const compartments = pgTable('compartments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  restricted: boolean('restricted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Compartment = typeof compartments.$inferSelect
export type NewCompartment = typeof compartments.$inferInsert
