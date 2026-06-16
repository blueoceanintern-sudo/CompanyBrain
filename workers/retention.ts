import { db } from '@company-brain/db'
import { queries, orgs } from '@company-brain/db'
import { eq, lt, and, isNotNull } from 'drizzle-orm'
import { QUERY_LOG_RETENTION_DAYS, ORG_QUARANTINE_DAYS } from '@company-brain/shared'

export async function runQueryLogPurge(): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - QUERY_LOG_RETENTION_DAYS)

  const result = await db.delete(queries).where(lt(queries.createdAt, cutoff))
  console.log(`[retention] Query log purge complete (cutoff: ${cutoff.toISOString()})`)
}

export async function runOrgDataPurge(): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ORG_QUARANTINE_DAYS)

  const expiredOrgs = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(and(isNotNull(orgs.cancelledAt), lt(orgs.cancelledAt, cutoff)))

  for (const org of expiredOrgs) {
    // CASCADE on all FK references handles users, documents, chunks, queries, audit_logs, etc.
    await db.delete(orgs).where(eq(orgs.id, org.id))
    console.log(`[retention] Permanently deleted org ${org.id} after ${ORG_QUARANTINE_DAYS}-day quarantine`)
  }

  if (expiredOrgs.length === 0) {
    console.log('[retention] No expired orgs to purge')
  }
}
