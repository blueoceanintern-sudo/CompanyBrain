import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"

export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "org_admin", "dept_admin", "staff", "external_client",
])

export const users = pgTable("users", {
  id:         text("id").primaryKey(),
  org_id:     text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  email:      text("email").notNull().unique(),
  role:       userRoleEnum("role").notNull().default("staff"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
