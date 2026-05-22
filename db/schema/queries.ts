import { pgTable, text, real, timestamp, jsonb } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { users } from "./users"
import { accessTierEnum } from "./documents"

export const queries = pgTable("queries", {
  id:          text("id").primaryKey(),
  org_id:      text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  user_id:     text("user_id").references(() => users.id),
  query_text:  text("query_text").notNull(),
  answer:      text("answer"),
  citations:   jsonb("citations"),
  confidence:  real("confidence"),
  missing:     jsonb("missing"),
  access_tier: accessTierEnum("access_tier").notNull().default("internal"),
  created_at:  timestamp("created_at").notNull().defaultNow(),
})

export type Query = typeof queries.$inferSelect
export type NewQuery = typeof queries.$inferInsert
