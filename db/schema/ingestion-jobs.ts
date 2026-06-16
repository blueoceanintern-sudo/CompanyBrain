import { pgTable, text, uuid, timestamp, integer } from 'drizzle-orm/pg-core'
import { ingestionStatusEnum } from './enums'
import { orgs } from './orgs'
import { documents } from './documents'

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  status: ingestionStatusEnum('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type IngestionJob = typeof ingestionJobs.$inferSelect
export type NewIngestionJob = typeof ingestionJobs.$inferInsert
