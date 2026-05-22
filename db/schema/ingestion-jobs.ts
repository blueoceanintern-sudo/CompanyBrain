import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { documents } from "./documents"

export const ingestionStatusEnum = pgEnum("ingestion_status", ["queued", "running", "complete", "failed"])

export const ingestionJobs = pgTable("ingestion_jobs", {
  id:            text("id").primaryKey(),
  org_id:        text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  document_id:   text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  status:        ingestionStatusEnum("status").notNull().default("queued"),
  error_message: text("error_message"),
  retry_count:   integer("retry_count").notNull().default(0),
  max_retries:   integer("max_retries").notNull().default(3),
  started_at:    timestamp("started_at"),
  completed_at:  timestamp("completed_at"),
  created_at:    timestamp("created_at").notNull().defaultNow(),
})

export type IngestionJob = typeof ingestionJobs.$inferSelect
export type NewIngestionJob = typeof ingestionJobs.$inferInsert
