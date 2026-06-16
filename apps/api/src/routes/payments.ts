import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  createSubscription,
  getSubscriptionStatus,
  cancelOrgSubscription,
  ensureStripeCustomer,
  ensureConnectOnboardingLink,
  getConnectStatus,
  createClientCheckoutSession,
} from '@company-brain/payments'
import { db } from '@company-brain/db'
import { orgs, users } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import { hasPermission } from '@company-brain/shared'
import { canPublishExternal } from '@company-brain/access-control'
import type { AuthVars } from '../middleware/auth'

const paymentsRoute = new Hono<AuthVars>()

const BAD_ORG = { success: false, error: { code: 'BAD_REQUEST', message: 'Missing org ID' } } as const

const subscriptionCreateSchema = z.object({
  priceId: z.string(),
  connectedAccountId: z.string(),
})

const externalPricingSchema = z.object({
  priceCents: z.number().int().positive(),
})

// POST /orgs/:id/subscriptions
paymentsRoute.post(
  '/subscriptions',
  zValidator('json', subscriptionCreateSchema),
  async (c) => {
    const orgId = c.req.param('id')
    if (!orgId) return c.json(BAD_ORG, 400)
    const role = c.get('role')
    if (!hasPermission(role, 'billing:manage')) {
      return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
    }
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
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'billing:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }
  const result = await getSubscriptionStatus(orgId)
  if (!result.success) return c.json({ success: false, error: result.error }, 500)
  return c.json({ success: true, data: result.data })
})

// DELETE /orgs/:id/subscriptions
paymentsRoute.delete('/subscriptions', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'billing:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }
  const result = await cancelOrgSubscription(orgId)
  if (!result.success) return c.json({ success: false, error: result.error }, 500)
  return c.json({ success: true, data: null })
})

// POST /orgs/:id/connect-account — create (if needed) and return an onboarding link
paymentsRoute.post('/connect-account', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'billing:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }
  const result = await ensureConnectOnboardingLink(orgId)
  if (!result.success) return c.json({ success: false, error: result.error }, 500)
  return c.json({ success: true, data: result.data })
})

// GET /orgs/:id/connect-account — current onboarding status
paymentsRoute.get('/connect-account', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'billing:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }
  const result = await getConnectStatus(orgId)
  if (!result.success) return c.json({ success: false, error: result.error }, 500)
  return c.json({ success: true, data: result.data })
})

// PATCH /orgs/:id/external-pricing — set the flat fee external clients pay
paymentsRoute.patch('/external-pricing', zValidator('json', externalPricingSchema), async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'billing:manage')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const orgRow = await db.select({ plan: orgs.plan }).from(orgs).where(eq(orgs.id, orgId)).limit(1)
  if (!canPublishExternal(orgRow[0]?.plan ?? 'free')) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'External publishing requires a paid plan' } },
      403
    )
  }

  const { priceCents } = c.req.valid('json')

  await db
    .update(orgs)
    .set({ externalPriceCents: priceCents, updatedAt: new Date() })
    .where(eq(orgs.id, orgId))

  return c.json({ success: true, data: null })
})

// POST /orgs/:id/checkout — external_client subscribes to this org's external knowledge plane
paymentsRoute.post('/checkout', async (c) => {
  const orgId = c.req.param('id')
  if (!orgId) return c.json(BAD_ORG, 400)
  const role = c.get('role')
  if (!hasPermission(role, 'external-access:subscribe')) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
  }

  const userId = c.get('userId')
  const userRows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  const email = userRows[0]?.email
  if (!email) {
    return c.json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } }, 404)
  }

  const result = await createClientCheckoutSession({ orgId, userId, userEmail: email })
  if (!result.success) return c.json({ success: false, error: result.error }, 400)
  return c.json({ success: true, data: result.data })
})

export default paymentsRoute
