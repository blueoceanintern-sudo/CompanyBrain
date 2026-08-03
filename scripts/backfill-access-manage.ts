/**
 * One-time backfill for the users:manage → access:manage permission split.
 * Run once after deploying the split:
 *
 *   bun run scripts/backfill-access-manage.ts
 *
 * Before the split, `users:manage` covered user management, group/grant
 * management, and role-permission editing. It is now split into `users:manage`
 * (invite/roles/remove) and `access:manage` (permissions, groups, grants). To
 * preserve existing behavior, every (org, role) that currently has users:manage
 * also gets access:manage. Idempotent — the unique constraint skips duplicates.
 */
import { db, rolePermissions, eq } from '../db'

async function main() {
  const holders = await db
    .select({ orgId: rolePermissions.orgId, role: rolePermissions.role })
    .from(rolePermissions)
    .where(eq(rolePermissions.permission, 'users:manage'))

  let added = 0
  for (const { orgId, role } of holders) {
    const res = await db
      .insert(rolePermissions)
      .values({ orgId, role, permission: 'access:manage' })
      .onConflictDoNothing()
    // postgres.js exposes affected row count on .count for inserts
    if ((res as unknown as { count?: number }).count) added++
    console.log(`[grant] access:manage → ${role} (org ${orgId})`)
  }

  console.log(`\nDone. Processed ${holders.length} role(s).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
