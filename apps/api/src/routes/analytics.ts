import { Hono } from 'hono'
import { db } from '@company-brain/db'
import { queries, auditLogs } from '@company-brain/db'
import { eq, and, gte, sql, count } from 'drizzle-orm'
import { hasPermission, CONFIDENCE_GATE_THRESHOLD } from '@company-brain/shared'
import type { AuthVars } from '../middleware/auth'

const analyticsRoute = new Hono<AuthVars>()

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

// GET /orgs/:id/analytics/overview
analyticsRoute.get('/overview', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const days = Number(c.req.query('days') ?? '30')

  if (!hasPermission(role, 'analytics:view')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const since = daysAgoDate(days)

  const [totalResult, answeredResult, citedResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(queries)
      .where(and(eq(queries.orgId, orgId), gte(queries.createdAt, since))),
    db
      .select({ answered: count() })
      .from(queries)
      .where(
        and(
          eq(queries.orgId, orgId),
          gte(queries.createdAt, since),
          sql`confidence >= ${CONFIDENCE_GATE_THRESHOLD}`
        )
      ),
    db
      .select({ cited: count() })
      .from(queries)
      .where(
        and(
          eq(queries.orgId, orgId),
          gte(queries.createdAt, since),
          sql`jsonb_array_length(citations) > 0`
        )
      ),
  ])

  const total = totalResult[0]?.total ?? 0
  const answered = answeredResult[0]?.answered ?? 0
  const cited = citedResult[0]?.cited ?? 0

  return c.json({
    success: true,
    data: {
      kbCoverage: total > 0 ? Math.round((answered / total) * 100) : 0,
      queryVolume: total,
      citationHitRate: answered > 0 ? Math.round((cited / answered) * 100) : 0,
      iDontKnowRate: total > 0 ? Math.round(((total - answered) / total) * 100) : 0,
    },
  })
})

// GET /orgs/:id/analytics/queries (top unanswered)
analyticsRoute.get('/queries', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  const days = Number(c.req.query('days') ?? '30')

  if (!hasPermission(role, 'analytics:view')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const since = daysAgoDate(days)

  const rows = await db.execute(sql`
    SELECT
      query_text,
      COUNT(*) AS count,
      MAX(created_at) AS last_asked
    FROM queries
    WHERE org_id = ${orgId}
      AND created_at >= ${since}
      AND confidence < ${CONFIDENCE_GATE_THRESHOLD}
    GROUP BY query_text
    ORDER BY count DESC
    LIMIT 20
  `)

  return c.json({
    success: true,
    data: (rows as unknown[]).map((r: unknown) => {
      const row = r as Record<string, unknown>
      return {
        queryText: row['query_text'] as string,
        count: Number(row['count']),
        lastAsked: row['last_asked'] as string,
      }
    }),
  })
})

// GET /orgs/:id/analytics/export (audit log CSV)
analyticsRoute.get('/export', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')

  if (!hasPermission(role, 'analytics:view')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(auditLogs.createdAt)

  const header = 'timestamp,actor_id,action,resource_type,resource_id\n'
  const body = rows
    .map(
      (r) =>
        `${r.createdAt.toISOString()},${r.userId ?? ''},${r.action},${r.resourceType},${r.resourceId ?? ''}`
    )
    .join('\n')

  c.header('Content-Type', 'text/csv')
  c.header('Content-Disposition', `attachment; filename="audit-${orgId}.csv"`)
  return c.body(header + body)
})

export default analyticsRoute
