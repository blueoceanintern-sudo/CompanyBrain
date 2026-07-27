import { pgTable, text, uuid, timestamp, unique, boolean } from 'drizzle-orm/pg-core'
import { userRoleEnum } from './enums'
import { orgs } from './orgs'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    // Nullable: only collected on invite (POST /orgs/:id/users); users created
    // via org provisioning (POST /orgs) predate this field and have none.
    name: text('name'),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('staff'),
    // Set true when an admin invites the user with a temporary password; the
    // web app forces a password change before granting access, then clears it
    // (see PATCH /orgs/:id/account/password). Users provisioned via POST /orgs
    // keep the default false.
    mustChangePassword: boolean('must_change_password').notNull().default(false),
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
