import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { compartments } from "./compartments"
import { users } from "./users"

export const accessTierEnum  = pgEnum("access_tier",  ["internal", "external"])
export const sourceTypeEnum  = pgEnum("source_type",  ["hr_policy", "sop", "faq", "case_note", "compliance", "product_doc", "other"])
export const chunkStatusEnum = pgEnum("chunk_status", ["active", "processing", "error", "archived"])

export const documents = pgTable("documents", {
  id:                  text("id").primaryKey(),
  org_id:              text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  compartment_id:      text("compartment_id").notNull().references(() => compartments.id),
  filename:            text("filename").notNull(),
  access_tier:         accessTierEnum("access_tier").notNull(),
  source_type:         sourceTypeEnum("source_type").notNull(),
  content_hash:        text("content_hash").notNull(),
  status:              chunkStatusEnum("status").notNull().default("processing"),
  uploaded_by:         text("uploaded_by").references(() => users.id),
  version:             integer("version").notNull().default(1),
  previous_version_id: text("previous_version_id"),
  created_at:          timestamp("created_at").notNull().defaultNow(),
  updated_at:          timestamp("updated_at").notNull().defaultNow(),
})

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
