import Stripe from 'stripe'
import { db } from '@company-brain/db'
import { orgs, stripeEvents } from '@company-brain/db'
import { eq } from 'drizzle-orm'
import type { ServiceResult } from '@company-brain/shared'
import { STRIPE_PLATFORM_FEE_PERCENT } from '@company-brain/shared'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const platformFeePercent =
  Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? STRIPE_PLATFORM_FEE_PERCENT) / 100

// ─── Create or retrieve a Stripe customer ────────────────────────────────────

export async function ensureStripeCustomer(
  orgId: string,
  orgName: string,
  email: string
): Promise<ServiceResult<{ customerId: string }>> {
  try {
    const org = await db
      .select({ stripeCustomerId: orgs.stripeCustomerId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    if (org[0]?.stripeCustomerId) {
      return { success: true, data: { customerId: org[0].stripeCustomerId } }
    }

    const customer = await stripe.customers.create({ name: orgName, email })

    await db
      .update(orgs)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(orgs.id, orgId))

    return { success: true, data: { customerId: customer.id } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe customer creation failed'
    return { success: false, error: { code: 'STRIPE_CUSTOMER_ERROR', message } }
  }
}

// ─── Create subscription (Stripe Connect with platform fee) ──────────────────

export async function createSubscription(params: {
  orgId: string
  customerId: string
  priceId: string
  connectedAccountId: string
}): Promise<ServiceResult<{ subscriptionId: string; status: string }>> {
  const { orgId, customerId, priceId, connectedAccountId } = params

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      application_fee_percent: platformFeePercent * 100,
      transfer_data: { destination: connectedAccountId },
      expand: ['latest_invoice.payment_intent'],
    })

    await db
      .update(orgs)
      .set({
        stripeSubscriptionId: subscription.id,
        plan: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId))

    return {
      success: true,
      data: { subscriptionId: subscription.id, status: subscription.status },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Subscription creation failed'
    return { success: false, error: { code: 'STRIPE_SUBSCRIPTION_ERROR', message } }
  }
}

// ─── Get subscription status ──────────────────────────────────────────────────

export async function getSubscriptionStatus(
  orgId: string
): Promise<ServiceResult<{ plan: string; subscriptionId: string | null; status: string | null }>> {
  try {
    const org = await db
      .select({
        plan: orgs.plan,
        stripeSubscriptionId: orgs.stripeSubscriptionId,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    if (!org[0]) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Organisation not found' } }
    }

    const o = org[0]
    let status: string | null = null

    if (o.stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(o.stripeSubscriptionId)
      status = sub.status
    }

    return {
      success: true,
      data: {
        plan: o.plan,
        subscriptionId: o.stripeSubscriptionId,
        status,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscription'
    return { success: false, error: { code: 'STRIPE_STATUS_ERROR', message } }
  }
}

// ─── Handle Stripe webhook ────────────────────────────────────────────────────

export async function handleStripeWebhook(params: {
  payload: string
  signature: string
}): Promise<ServiceResult<{ eventType: string }>> {
  const { payload, signature } = params

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Idempotency: skip if already processed
    const existing = await db
      .select({ id: stripeEvents.id })
      .from(stripeEvents)
      .where(eq(stripeEvents.stripeEventId, event.id))
      .limit(1)

    if (existing.length > 0) {
      return { success: true, data: { eventType: event.type } }
    }

    // Determine orgId from event metadata
    let orgId: string | null = null
    const obj = event.data.object as Record<string, unknown>
    if (typeof obj['metadata'] === 'object' && obj['metadata'] !== null) {
      orgId = (obj['metadata'] as Record<string, string>)['orgId'] ?? null
    }

    await db.insert(stripeEvents).values({
      orgId,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event.data.object as Record<string, unknown>,
      processedAt: new Date(),
    })

    // Handle subscription lifecycle events
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      await db
        .update(orgs)
        .set({ plan: 'free', stripeSubscriptionId: null, updatedAt: new Date() })
        .where(eq(orgs.stripeSubscriptionId, sub.id))
    }

    return { success: true, data: { eventType: event.type } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handling failed'
    return { success: false, error: { code: 'STRIPE_WEBHOOK_ERROR', message } }
  }
}
