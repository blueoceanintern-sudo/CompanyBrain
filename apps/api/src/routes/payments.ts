import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createSubscription,
  getSubscriptionStatus,
  handleStripeWebhook,
  ensureStripeCustomer,
} from '@company-brain/payments'
import { db } from '@company-brain/db'
import { orgs, users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import type { AuthVars } from '../middleware/auth'

const paymentsRoute = new Hono<AuthVars>()

const subscriptionCreateSchema = z.object({
  priceId: z.string(),
  connectedAccountId: z.string(),
})

// POST /orgs/:id/subscriptions
paymentsRoute.post(
  '/subscriptions',
  zValidator('json', subscriptionCreateSchema),
  async (c) => {
    const orgId = c.req.param('id')
    const userId = c.get('userId')
    const { priceId, connectedAccountId } = c.req.valid('json')

    const orgRows = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)
    const userRows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const orgName = orgRows[0]?.name ?? 'Unknown Org'
    const email = userRows[0]?.email ?? ''

    const customerResult = await ensureStripeCustomer(orgId, orgName, email)
    if (!customerResult.success) {
      return c.json({ success: false, error: customerResult.error }, 500)
    }

    const result = await createSubscription({
      orgId,
      customerId: customerResult.data.customerId,
      priceId,
      connectedAccountId,
    })

    if (!result.success) return c.json({ success: false, error: result.error }, 500)
    return c.json({ success: true, data: result.data }, 201)
  }
)

// GET /orgs/:id/subscriptions
paymentsRoute.get('/subscriptions', async (c) => {
  const orgId = c.req.param('id')
  const result = await getSubscriptionStatus(orgId)
  if (!result.success) return c.json({ success: false, error: result.error }, 500)
  return c.json({ success: true, data: result.data })
})

export default paymentsRoute
