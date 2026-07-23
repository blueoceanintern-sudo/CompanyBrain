import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { queries, orgs, users } from '@company-brain/db'
import { eq, desc } from 'drizzle-orm'
import { retrieveChunks } from '@company-brain/retrieval'
import { synthesizeAnswer, contextualizeQuery } from '@company-brain/synthesis'
import { CONFIDENCE_GATE_THRESHOLD } from '@company-brain/shared'
import { canPublishExternal } from '@company-brain/access-control'
import type { AuthVars } from '../middleware/auth'

const queryRoute = new Hono<AuthVars>()

const SOURCE_TYPES = ['hr_policy', 'sop', 'faq', 'case_note', 'compliance', 'product_doc', 'other'] as const

const conversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const querySchema = z.object({
  query: z.string().min(1).max(2000),
  accessTier: z.enum(['internal', 'external']).default('internal'),
  sourceTypes: z.array(z.enum(SOURCE_TYPES)).optional(),
  history: z.array(conversationTurnSchema).max(40).optional(),
})

// POST /orgs/:id/query
queryRoute.post('/', zValidator('json', querySchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } }, 400)
  const userId = c.get('userId')
  const userRole = c.get('role')
  const { query, accessTier, sourceTypes, history } = c.req.valid('json')

  if (userRole === 'external_client' && accessTier !== 'external') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'External clients can only access the external knowledge plane' } },
      403
    )
  }

  if (accessTier === 'external') {
    const orgRow = await db.select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
    if (!canPublishExternal(orgRow[0]?.plan ?? 'free')) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'External knowledge plane is not available on the free plan' } },
        403
      )
    }

    if (userRole === 'external_client') {
      const clientRow = await db.select({ subscriptionStatus: users.subscriptionStatus }).from(users).where(eq(users.id, userId)).limit(1)
      const status = clientRow[0]?.subscriptionStatus
      if (status !== 'active' && status !== 'trialing') {
        return c.json(
          { success: false, error: { code: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required to access this knowledge base' } },
          403
        )
      }
    }
  }

  try {
    // For follow-up questions, rewrite the query into a standalone search query
    // so retrieval finds relevant chunks even for short contextual questions.
    const retrievalQuery = history?.length
      ? await contextualizeQuery(query, history)
      : query

    // Retrieve
    const retrievalResult = await retrieveChunks({
      orgId,
      userId,
      query: retrievalQuery,
      accessTier,
      userRole,
      ...(sourceTypes !== undefined ? { sourceTypes } : {}),
    })

    if (!retrievalResult.success) {
      return c.json({ success: false, error: retrievalResult.error }, 500)
    }

    const { chunks, confidence } = retrievalResult.data

    // Confidence gate — skip when there is conversation history so follow-up
    // questions ("reframe that", "tell me more") reach synthesis instead of
    // short-circuiting here with "I don't know".
    const isFollowUp = history && history.length > 0
    if (!isFollowUp && (confidence < CONFIDENCE_GATE_THRESHOLD || chunks.length === 0)) {
      const response = {
        answer: "I don't know — this question is not in the knowledge base.",
        citations: [] as never[],
        confidence,
        missing: [query],
      }

      await db.insert(queries).values({
        orgId, userId, queryText: query,
        answer: response.answer, citations: [], confidence, missing: [query], accessTier,
      })

      return c.json({ success: true, data: response })
    }

    // Synthesize
    const synthesisResult = await synthesizeAnswer({ query, chunks, ...(history ? { history } : {}) })

    if (!synthesisResult.success) {
      return c.json({ success: false, error: synthesisResult.error }, 500)
    }

    const { answer, citations, missing } = synthesisResult.data

    await db.insert(queries).values({
      orgId, userId, queryText: query, answer, citations, confidence, missing, accessTier,
    })

    return c.json({ success: true, data: { answer, citations, confidence, missing } })
  } catch (err) {
    console.error('[query]', err)
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Query failed unexpectedly' } },
      500
    )
  }
})

// GET /orgs/:id/queries
queryRoute.get('/', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } }, 400)

  try {
    const rows = await db
      .select()
      .from(queries)
      .where(eq(queries.orgId, orgId))
      .orderBy(desc(queries.createdAt))
      .limit(100)

    return c.json({ success: true, data: rows })
  } catch (err) {
    console.error('[query list]', err)
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch queries' } },
      500
    )
  }
})

export default queryRoute
