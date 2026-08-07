import { db } from '@company-brain/db'
import { queries, orgs } from '@company-brain/db'
import { eq, lt, and, isNotNull } from 'drizzle-orm'
import { QUERY_LOG_RETENTION_DAYS, ORG_QUARANTINE_DAYS } from '@company-brain/shared'
import { deletePrefix } from '@company-brain/storage'

export async function runQueryLogPurge(): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - QUERY_LOG_RETENTION_DAYS)

  await db.delete(queries).where(lt(queries.createdAt, cutoff))
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

    // Original files live outside Postgres, so no cascade reaches them. The
    // 30-day quarantine promises permanent deletion (PDPA/GDPR) — that is only
    // true if the stored originals go too.
    const purged = await deletePrefix(org.id)
    if (!purged.success) {
      console.error(
        `[retention] Org ${org.id} rows deleted but stored files remain: ${purged.error.message}`
      )
    }

    console.log(`[retention] Permanently deleted org ${org.id} after ${ORG_QUARANTINE_DAYS}-day quarantine`)
  }

  if (expiredOrgs.length === 0) {
    console.log('[retention] No expired orgs to purge')
  }
}
