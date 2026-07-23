/**
 * One-time setup script. Run after `bun install` and `bun db:migrate`:
 *   bun run scripts/setup.ts
 *
 * Creates the first org + super_admin user so you can log in.
 */
import { eq } from '../db'
import { db } from '../db/client'
import { orgs, users } from '../db/schema'

async function main() {
  const adminEmail = process.env.SETUP_ADMIN_EMAIL ?? 'admin@equest.edu.au'

  const orgName = process.env.SETUP_ORG_NAME ?? 'Equest School Network'
  const adminPassword = process.env.SETUP_ADMIN_PASSWORD ?? 'changeme123'
  // The pilot org is comped, not a paying customer — grant the paid plan
  // directly so external-plane upload/query works without ever going
  // through Stripe checkout. `orgs.plan` is the only thing canPublishExternal
  // checks; it doesn't require a stripe_subscription_id to be set.
  const orgPlan = (process.env.SETUP_ORG_PLAN as 'free' | 'paid' | undefined) ?? 'paid'

  const [existing] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1)
  if (existing) {
    console.log(`[setup] Admin ${adminEmail} already exists, skipping.`)
    return
  }

  console.log(`Creating org: ${orgName} (${orgPlan} plan)`)
  const [org] = await db.insert(orgs).values({ name: orgName, plan: orgPlan }).returning()
  if (!org) throw new Error('Failed to create org')

  console.log(`Creating admin: ${adminEmail}`)
  const passwordHash = await Bun.password.hash(adminPassword)
  await db.insert(users).values({
    orgId: org.id,
    email: adminEmail,
    passwordHash,
    role: 'super_admin',
  })

  console.log(`
Setup complete!
  Org ID:  ${org.id}
  Email:   ${adminEmail}
  Password: ${adminPassword}

Change the admin password after first login.
`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
