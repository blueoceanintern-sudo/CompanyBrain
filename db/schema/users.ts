import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { userRoleEnum } from './enums'
import { orgs } from './orgs'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('staff'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    subscriptionStatus: text('subscription_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: unique().on(t.email),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
