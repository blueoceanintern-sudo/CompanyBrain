import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core"

export const orgPlanEnum = pgEnum("org_plan", ["free", "paid"])
export const compartmentModeEnum = pgEnum("compartment_mode", ["autonomous", "schema_driven"])

export const orgs = pgTable("orgs", {
  id:                     text("id").primaryKey(),
  name:                   text("name").notNull(),
  plan:                   orgPlanEnum("plan").notNull().default("free"),
  stripe_customer_id:     text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  compartment_mode:       compartmentModeEnum("compartment_mode").notNull().default("autonomous"),
  cancelled_at:           timestamp("cancelled_at"),
  created_at:             timestamp("created_at").notNull().defaultNow(),
  updated_at:             timestamp("updated_at").notNull().defaultNow(),
})

export type Org = typeof orgs.$inferSelect
export type NewOrg = typeof orgs.$inferInsert
