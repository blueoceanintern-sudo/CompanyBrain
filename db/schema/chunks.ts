import { pgTable, text, uuid, timestamp, integer, customType } from 'drizzle-orm/pg-core'
import { jsonb } from 'drizzle-orm/pg-core'
import { accessTierEnum, sourceTypeEnum, chunkStatusEnum } from './enums'
import { orgs } from './orgs'
import { documents } from './documents'
import { compartments } from './compartments'
import type { VisibilityPolicy } from '@company-brain/shared'

const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => 'vector(1536)',
  toDriver: (value: number[]) => `[${value.join(',')}]`,
  fromDriver: (value: string) => value.slice(1, -1).split(',').map(Number),
})

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  compartmentId: uuid('compartment_id')
    .notNull()
    .references(() => compartments.id),
  content: text('content').notNull(),
  embedding: vector('embedding').notNull(),
  contentHash: text('content_hash').notNull(),
  visibility: jsonb('visibility').$type<VisibilityPolicy>().notNull(),
  accessTier: accessTierEnum('access_tier').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  parentChunkId: uuid('parent_chunk_id'),
  status: chunkStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Chunk = typeof chunks.$inferSelect
export type NewChunk = typeof chunks.$inferInsert
