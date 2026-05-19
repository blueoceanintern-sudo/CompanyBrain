/**
 * One-time setup script. Run after `bun install` and `bun db:migrate`:
 *   bun run scripts/setup.ts
 *
 * Creates the first org + super_admin user so you can log in.
 */
import { db } from '../db/client'
import { orgs, users } from '../db/schema'

async function main() {
  const orgName = process.env.SETUP_ORG_NAME ?? 'Equest School Network'
  const adminEmail = process.env.SETUP_ADMIN_EMAIL ?? 'admin@equest.edu.au'
  const adminPassword = process.env.SETUP_ADMIN_PASSWORD ?? 'changeme123'

  console.log(`Creating org: ${orgName}`)
  const [org] = await db.insert(orgs).values({ name: orgName }).returning()
  if (!org) throw new Error('Failed to create org')

  console.log(`Creating admin: ${adminEmail}`)
  const passwordHash = await Bun.password.hash(adminPassword)
  await db.insert(users).values({
    orgId: org.id,
    email: adminEmail,
    passwordHash,
    role: 'org_admin',
  })

  console.log(`
Setup complete!
  Org ID:  ${org.id}
  Email:   ${adminEmail}
  Password: ${adminPassword}

Change the admin password after first login.
`)
}

main().catch((e) => { console.error(e); process.exit(1) })
