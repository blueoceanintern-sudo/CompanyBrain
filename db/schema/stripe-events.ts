import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"

export const stripeEvents = pgTable("stripe_events", {
  id:              text("id").primaryKey(),
  org_id:          text("org_id").references(() => orgs.id, { onDelete: "set null" }),
  stripe_event_id: text("stripe_event_id").notNull().unique(),
  event_type:      text("event_type").notNull(),
  payload:         jsonb("payload").notNull(),
  processed_at:    timestamp("processed_at").notNull().defaultNow(),
})

export type StripeEvent = typeof stripeEvents.$inferSelect
export type NewStripeEvent = typeof stripeEvents.$inferInsert
