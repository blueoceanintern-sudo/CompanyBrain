import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '@company-brain/db'
import { queries } from '@company-brain/db'
import { eq, desc } from 'drizzle-orm'
import { retrieveChunks } from '@company-brain/retrieval'
import { synthesizeAnswer } from '@company-brain/synthesis'
import { CONFIDENCE_GATE_THRESHOLD } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const queryRoute = new Hono<AuthVars>()

const querySchema = z.object({
  query: z.string().min(1).max(2000),
  accessTier: z.enum(['internal', 'external']).default('internal'),
})

// POST /orgs/:id/query
queryRoute.post('/', zValidator('json', querySchema), async (c) => {
  const orgId = c.req.param('id')
  const userId = c.get('userId')
  const userRole = c.get('role')
  const { query, accessTier } = c.req.valid('json')

  // Retrieve
  const retrievalResult = await retrieveChunks({
    orgId,
    userId,
    query,
    accessTier,
    userRole,
  })

  if (!retrievalResult.success) {
    return c.json(
      { success: false, error: retrievalResult.error },
      500
    )
  }

  const { chunks, confidence } = retrievalResult.data

  // Confidence gate
  if (confidence < CONFIDENCE_GATE_THRESHOLD || chunks.length === 0) {
    const response = {
      answer: "I don't know — this question is not in the knowledge base.",
      citations: [],
      confidence,
      missing: [query],
    }

    await db.insert(queries).values({
      orgId,
      userId,
      queryText: query,
      answer: response.answer,
      citations: [],
      confidence,
      missing: [query],
      accessTier,
    })

    return c.json({ success: true, data: response })
  }

  // Synthesize
  const synthesisResult = await synthesizeAnswer({ query, chunks })

  if (!synthesisResult.success) {
    return c.json({ success: false, error: synthesisResult.error }, 500)
  }

  const { answer, citations, missing } = synthesisResult.data

  await db.insert(queries).values({
    orgId,
    userId,
    queryText: query,
    answer,
    citations,
    confidence,
    missing,
    accessTier,
  })

  return c.json({ success: true, data: { answer, citations, confidence, missing } })
})

// GET /orgs/:id/queries
queryRoute.get('/', async (c) => {
  const orgId = c.req.param('id')

  const rows = await db
    .select()
    .from(queries)
    .where(eq(queries.orgId, orgId))
    .orderBy(desc(queries.createdAt))
    .limit(100)

  return c.json({ success: true, data: rows })
})

export default queryRoute
