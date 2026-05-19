import { pgTable, text, uuid, timestamp, real } from 'drizzle-orm/pg-core'
import { jsonb } from 'drizzle-orm/pg-core'
import { accessTierEnum } from './enums'
import { orgs } from './orgs'
import { users } from './users'
import type { Citation } from '@company-brain/shared'

export const queries = pgTable('queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  queryText: text('query_text').notNull(),
  answer: text('answer'),
  citations: jsonb('citations').$type<Citation[]>(),
  confidence: real('confidence'),
  missing: jsonb('missing').$type<string[]>(),
  accessTier: accessTierEnum('access_tier').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Query = typeof queries.$inferSelect
export type NewQuery = typeof queries.$inferInsert
