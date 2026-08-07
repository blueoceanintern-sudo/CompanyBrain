import { pgTable, text, uuid, timestamp, integer, unique } from 'drizzle-orm/pg-core'
import { accessTierEnum, sourceTypeEnum, ingestionStatusEnum } from './enums'
import { orgs } from './orgs'
import { compartments } from './compartments'
import { users } from './users'

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    compartmentId: uuid('compartment_id')
      .notNull()
      .references(() => compartments.id),
    filename: text('filename').notNull(),
    accessTier: accessTierEnum('access_tier').notNull().default('internal'),
    sourceType: sourceTypeEnum('source_type').notNull().default('other'),
    contentHash: text('content_hash').notNull(),
    // Original file in object storage. Relative key ({orgId}/{documentId}) so
    // it stays valid across storage backends — see services/storage. Null for
    // documents uploaded before original-file storage existed; those fall back
    // to the stitched-chunk text preview.
    storageKey: text('storage_key'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    status: ingestionStatusEnum('status').notNull().default('queued'),
    uploadedBy: uuid('uploaded_by')
      .references(() => users.id, { onDelete: 'set null' }),
    version: integer('version').notNull().default(1),
    previousVersionId: uuid('previous_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contentHashOrgUnique: unique().on(t.contentHash, t.orgId),
  })
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
