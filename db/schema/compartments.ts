import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { compartmentModeEnum } from "./orgs"

export const compartments = pgTable("compartments", {
  id:          text("id").primaryKey(),
  org_id:      text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  mode:        compartmentModeEnum("mode").notNull().default("autonomous"),
  created_at:  timestamp("created_at").notNull().defaultNow(),
  updated_at:  timestamp("updated_at").notNull().defaultNow(),
})

export type Compartment = typeof compartments.$inferSelect
export type NewCompartment = typeof compartments.$inferInsert
