/**
 * One-time setup script. Run after `bun install` and `bun db:migrate`:
 *   bun run scripts/setup.ts
 *
 * Creates the first org + super_admin user so you can log in.
 */
import { db } from '../db/client'
import { orgs, users } from '../db/schema'

async function main() {
  const adminEmail = process.env.SETUP_ADMIN_EMAIL ?? 'admin@equest.edu.au'

  const orgName = process.env.SETUP_ORG_NAME ?? 'Equest School Network'
  const adminPassword = process.env.SETUP_ADMIN_PASSWORD ?? 'changeme123'

  try {
    console.log(`Creating org: ${orgName}`)
    const [org] = await db.insert(orgs).values({ name: orgName }).returning()
    if (!org) throw new Error('Failed to create org')

    console.log(`Creating admin: ${adminEmail}`)
    const passwordHash = await Bun.password.hash(adminPassword)
    await db.insert(users).values({
      orgId: org.id,
      email: adminEmail,
      passwordHash,
      role: 'super_admin',
    })
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505') {
      console.log(`[setup] Admin ${adminEmail} already exists, skipping.`)
      return
    }
    throw e
  }

  console.log(`
Setup complete!
  Org ID:  ${org.id}
  Email:   ${adminEmail}
  Password: ${adminPassword}

Change the admin password after first login.
`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
