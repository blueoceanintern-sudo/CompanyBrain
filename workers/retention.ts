import { lt, and, isNotNull } from "drizzle-orm"
import { db, queries } from "../db/index"
import type { ServiceResult } from "../shared/types"
import { ok, err } from "../shared/types"

export interface PurgeInput {
  referenceDate: Date
  orgId?:        string
}

export interface PurgeResult {
  purged_count: number
}

/**
 * Purges query logs older than 90 days.
 * Audit logs are NOT purged — only the queries table.
 */
export async function runQueryLogPurge(input: PurgeInput): Promise<ServiceResult<PurgeResult>> {
  try {
    const cutoff = new Date(input.referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000)

    const conditions = [lt(queries.created_at, cutoff)]
    if (input.orgId) {
      const { eq } = await import("drizzle-orm")
      conditions.push(eq(queries.org_id, input.orgId))
    }

    const deleted = await db.delete(queries).where(and(...conditions)).returning({ id: queries.id })

    return ok({ purged_count: deleted.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Purge error"
    return err("PURGE_ERROR", message)
  }
}
