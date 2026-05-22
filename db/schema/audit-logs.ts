import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { users } from "./users"

export const auditLogs = pgTable("audit_logs", {
  id:            text("id").primaryKey(),
  org_id:        text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  user_id:       text("user_id").references(() => users.id),
  action:        text("action").notNull(),
  resource_type: text("resource_type"),
  resource_id:   text("resource_id"),
  metadata:      jsonb("metadata"),
  created_at:    timestamp("created_at").notNull().defaultNow(),
})

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
