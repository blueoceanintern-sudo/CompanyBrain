import Stripe from 'stripe'
import { db } from '@company-brain/db'
import { orgs, stripeEvents, users } from '@company-brain/db'
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

// ─── Stripe Connect onboarding (org's own connected account) ────────────────

export async function ensureConnectOnboardingLink(
  orgId: string
): Promise<ServiceResult<{ url: string }>> {
  try {
    const org = await db
      .select({ stripeConnectAccountId: orgs.stripeConnectAccountId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    if (!org[0]) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Organisation not found' } }
    }

    let accountId = org[0].stripeConnectAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { orgId },
      })
      accountId = account.id

      await db
        .update(orgs)
        .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
        .where(eq(orgs.id, orgId))
    }

    const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${webUrl}/settings?connect=refresh`,
      return_url: `${webUrl}/settings?connect=success`,
      type: 'account_onboarding',
    })

    return { success: true, data: { url: accountLink.url } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Stripe Connect onboarding link'
    return { success: false, error: { code: 'STRIPE_CONNECT_ERROR', message } }
  }
}

export async function getConnectStatus(
  orgId: string
): Promise<ServiceResult<{ connected: boolean; chargesEnabled: boolean }>> {
  try {
    const org = await db
      .select({
        stripeConnectAccountId: orgs.stripeConnectAccountId,
        stripeConnectChargesEnabled: orgs.stripeConnectChargesEnabled,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    if (!org[0]) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Organisation not found' } }
    }

    return {
      success: true,
      data: {
        connected: org[0].stripeConnectAccountId !== null,
        chargesEnabled: org[0].stripeConnectChargesEnabled,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Stripe Connect status'
    return { success: false, error: { code: 'STRIPE_CONNECT_STATUS_ERROR', message } }
  }
}

// ─── Get subscription status ──────────────────────────────────────────────────

export async function getSubscriptionStatus(
  orgId: string
): Promise<ServiceResult<{
  plan: string
  subscriptionId: string | null
  status: string | null
  externalPriceCents: number | null
}>> {
  try {
    const org = await db
      .select({
        plan: orgs.plan,
        stripeSubscriptionId: orgs.stripeSubscriptionId,
        externalPriceCents: orgs.externalPriceCents,
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
        externalPriceCents: o.externalPriceCents,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscription'
    return { success: false, error: { code: 'STRIPE_STATUS_ERROR', message } }
  }
}

// ─── Cancel subscription ──────────────────────────────────────────────────────

export async function cancelOrgSubscription(
  orgId: string
): Promise<ServiceResult<null>> {
  try {
    const org = await db
      .select({ stripeSubscriptionId: orgs.stripeSubscriptionId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    const subId = org[0]?.stripeSubscriptionId
    if (subId) {
      await stripe.subscriptions.cancel(subId)
    }

    await db
      .update(orgs)
      .set({ plan: 'free', stripeSubscriptionId: null, cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(orgs.id, orgId))

    return { success: true, data: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancellation failed'
    return { success: false, error: { code: 'STRIPE_CANCEL_ERROR', message } }
  }
}

// ─── External client checkout (subscribe to an org's external knowledge plane) ──

export async function ensureClientStripeCustomer(
  userId: string,
  email: string
): Promise<ServiceResult<{ customerId: string }>> {
  try {
    const userRow = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (userRow[0]?.stripeCustomerId) {
      return { success: true, data: { customerId: userRow[0].stripeCustomerId } }
    }

    const customer = await stripe.customers.create({ email })

    await db
      .update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(users.id, userId))

    return { success: true, data: { customerId: customer.id } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe customer creation failed'
    return { success: false, error: { code: 'STRIPE_CUSTOMER_ERROR', message } }
  }
}

export async function createClientCheckoutSession(params: {
  orgId: string
  userId: string
  userEmail: string
}): Promise<ServiceResult<{ url: string }>> {
  const { orgId, userId, userEmail } = params

  try {
    const orgRow = await db
      .select({
        name: orgs.name,
        externalPriceCents: orgs.externalPriceCents,
        stripeConnectAccountId: orgs.stripeConnectAccountId,
        stripeConnectChargesEnabled: orgs.stripeConnectChargesEnabled,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1)

    const org = orgRow[0]
    if (!org) {
      return { success: false, error: { code: 'ORG_NOT_FOUND', message: 'Organisation not found' } }
    }
    if (!org.externalPriceCents) {
      return {
        success: false,
        error: { code: 'PRICING_NOT_SET', message: 'This organisation has not set a price for external access' },
      }
    }
    if (!org.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
      return {
        success: false,
        error: { code: 'CONNECT_NOT_READY', message: 'This organisation has not completed payment setup' },
      }
    }

    const customerResult = await ensureClientStripeCustomer(userId, userEmail)
    if (!customerResult.success) return customerResult

    const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerResult.data.customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${org.name} — External Knowledge Access` },
            unit_amount: org.externalPriceCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        application_fee_percent: platformFeePercent * 100,
        transfer_data: { destination: org.stripeConnectAccountId },
        metadata: { orgId, userId },
      },
      metadata: { orgId, userId },
      success_url: `${webUrl}/chat?checkout=success`,
      cancel_url: `${webUrl}/chat?checkout=cancel`,
    })

    if (!session.url) {
      return { success: false, error: { code: 'STRIPE_CHECKOUT_ERROR', message: 'Failed to create checkout session URL' } }
    }

    return { success: true, data: { url: session.url } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return { success: false, error: { code: 'STRIPE_CHECKOUT_ERROR', message } }
  }
}

// ─── Handle Stripe webhook ────────────────────────────────────────────────────

export async function handleStripeWebhook(params: {
  payload: string
  signature: string
}): Promise<ServiceResult<{ eventType: string }>> {
  const { payload, signature } = params

  try {
    const event = await stripe.webhooks.constructEventAsync(
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
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      if (sub.status === 'active' || sub.status === 'trialing') {
        await db
          .update(orgs)
          .set({ plan: 'paid', stripeSubscriptionId: sub.id, cancelledAt: null, updatedAt: new Date() })
          .where(eq(orgs.stripeCustomerId, sub.customer as string))
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      await db
        .update(orgs)
        .set({ plan: 'free', stripeSubscriptionId: null, cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(orgs.stripeSubscriptionId, sub.id))
    }

    // Client subscription lifecycle (external_client subscribing to an org's external knowledge plane).
    // Matches on stripeCustomerId, which only exists on a user row for client-side subscriptions —
    // so this is a no-op for the org-level subscription events handled above.
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as Stripe.Subscription
      await db
        .update(users)
        .set({ stripeSubscriptionId: sub.id, subscriptionStatus: sub.status, updatedAt: new Date() })
        .where(eq(users.stripeCustomerId, sub.customer as string))
    }

    // Connect account onboarding status (org's own connected account)
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account
      await db
        .update(orgs)
        .set({ stripeConnectChargesEnabled: account.charges_enabled ?? false, updatedAt: new Date() })
        .where(eq(orgs.stripeConnectAccountId, account.id))
    }

    return { success: true, data: { eventType: event.type } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handling failed'
    return { success: false, error: { code: 'STRIPE_WEBHOOK_ERROR', message } }
  }
}
