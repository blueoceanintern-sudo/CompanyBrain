import { pgTable, text, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { jsonb } from './jsonb'
import { orgs } from './orgs'

export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'set null' }),
    stripeEventId: text('stripe_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => ({
    stripeEventIdUnique: unique().on(t.stripeEventId),
  })
)

export type StripeEvent = typeof stripeEvents.$inferSelect
export type NewStripeEvent = typeof stripeEvents.$inferInsert
