import { db, users, orgs } from './index'
import { sql } from 'drizzle-orm'

const EMAIL = 'admin@companybrain.com'
const PASSWORD = 'Admin@123456'

const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
const count = row?.count ?? 0

if (count === 0) {
  const passwordHash = await Bun.password.hash(PASSWORD)
  const [org] = await db.insert(orgs).values({ name: 'Root' }).returning()
  if (!org) throw new Error('[seed] Failed to create root org')
  await db.insert(users).values({ orgId: org.id, email: EMAIL, passwordHash, role: 'super_admin' })
  console.log(`[seed] Root user created — email: ${EMAIL}  password: ${PASSWORD}`)
} else {
  console.log('[seed] Users already exist, skipping.')
}

process.exit(0)
