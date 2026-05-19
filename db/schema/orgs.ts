import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core'
import { orgPlanEnum, compartmentModeEnum } from './enums'

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: orgPlanEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  compartmentMode: compartmentModeEnum('compartment_mode').notNull().default('autonomous'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Org = typeof orgs.$inferSelect
export type NewOrg = typeof orgs.$inferInsert
