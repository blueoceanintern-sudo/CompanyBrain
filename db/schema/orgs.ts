import { pgTable, text, uuid, timestamp, integer, boolean } from 'drizzle-orm/pg-core'
import { orgPlanEnum } from './enums'

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: orgPlanEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  stripeConnectChargesEnabled: boolean('stripe_connect_charges_enabled').notNull().default(false),
  externalPriceCents: integer('external_price_cents'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Org = typeof orgs.$inferSelect
export type NewOrg = typeof orgs.$inferInsert
