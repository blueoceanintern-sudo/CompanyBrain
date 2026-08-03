/**
 * One-time backfill for the role_permissions table (Phase 1 of editable
 * role permissions). Run once after `bun db:migrate` applies the migration:
 *
 *   bun run scripts/backfill-role-permissions.ts
 *
 * Every org created before this feature has no role_permissions rows, so the
 * resolver falls back to code defaults. This seeds those orgs with the same
 * defaults as explicit rows so admins can start editing them. Orgs that already
 * have any rows (created after the feature landed) are left untouched. Safe to
 * re-run.
 */
import { db, orgs, rolePermissions, eq } from '../db'
import { seedRolePermissionsValues } from '../services/access-control'

async function main() {
  const allOrgs = await db.select({ id: orgs.id, name: orgs.name }).from(orgs)
  let seeded = 0

  for (const org of allOrgs) {
    const existing = await db
      .select({ id: rolePermissions.id })
      .from(rolePermissions)
      .where(eq(rolePermissions.orgId, org.id))
      .limit(1)

    if (existing.length > 0) {
      console.log(`[skip] ${org.name} (${org.id}) already has role permissions`)
      continue
    }

    await db.insert(rolePermissions).values(seedRolePermissionsValues(org.id))
    seeded++
    console.log(`[seed] ${org.name} (${org.id})`)
  }

  console.log(`\nDone. Seeded ${seeded} of ${allOrgs.length} org(s).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
