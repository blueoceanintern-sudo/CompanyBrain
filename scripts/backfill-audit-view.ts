/**
 * One-time backfill for the analytics:view → audit:view split. Run once after
 * deploying the split:
 *
 *   bun run scripts/backfill-audit-view.ts
 *
 * Before the split, analytics:view gated both the analytics dashboards and the
 * audit log + export. Audit reading is now its own permission (audit:view). To
 * preserve existing behavior, every (org, role) that currently has analytics:view
 * also gets audit:view. Idempotent — the unique constraint skips duplicates.
 */
import { db, rolePermissions, eq } from '../db'

async function main() {
  const holders = await db
    .select({ orgId: rolePermissions.orgId, role: rolePermissions.role })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, 'analytics:view'))

  for (const { orgId, role } of holders) {
    await db
      .insert(rolePermissions)
      .values({ orgId, role, permission: 'audit:view' })
      .onConflictDoNothing()
    console.log(`[grant] audit:view → ${role} (org ${orgId})`)
  }

  console.log(`\nDone. Processed ${holders.length} role(s).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
