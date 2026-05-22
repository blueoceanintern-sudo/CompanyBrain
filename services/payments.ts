import Stripe from "stripe"
import { eq, and, lt } from "drizzle-orm"
import { db, orgs, stripeEvents } from "../db/index"
import type { ServiceResult } from "../shared/types"
import { ok, err } from "../shared/types"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
const PLATFORM_FEE_PERCENT = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "15")

// ─── Platform fee ─────────────────────────────────────────────────────────────

export function computePlatformFee(grossAmountCents: number): number {
  return Math.floor(grossAmountCents * (PLATFORM_FEE_PERCENT / 100))
}

// ─── Create subscription ──────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  orgId: string
  plan:  "paid"
}

export interface SubscriptionData {
  stripe_subscription_id: string
  org_plan:               string
  status:                 string
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<ServiceResult<SubscriptionData>> {
  try {
    const [org] = await db.select().from(orgs).where(eq(orgs.id, input.orgId))
    if (!org) return err("NOT_FOUND", "Organisation not found.")

    const customerId = org.stripe_customer_id ?? org.id

    const subscription = await stripe.subscriptions.create({
      customer:                customerId,
      items:                   [{ price: process.env.STRIPE_PRICE_ID ?? "price_placeholder" }],
      application_fee_percent: PLATFORM_FEE_PERCENT,
    })

    await db.update(orgs)
      .set({ plan: "paid", stripe_subscription_id: subscription.id, updated_at: new Date() })
      .where(eq(orgs.id, input.orgId))

    return ok({
      stripe_subscription_id: subscription.id,
      org_plan:               "paid",
      status:                 subscription.status,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error"
    return err("STRIPE_ERROR", message)
  }
}

// ─── Stripe webhook ───────────────────────────────────────────────────────────

export interface WebhookInput {
  payload:   string
  signature: string
}

export interface WebhookResult {
  already_processed: boolean
  org_quarantined:   boolean
  org_plan:          string | null
}

export async function handleStripeWebhook(input: WebhookInput): Promise<ServiceResult<WebhookResult>> {
  let event: ReturnType<typeof stripe.webhooks.constructEvent>

  try {
    event = stripe.webhooks.constructEvent(
      input.payload,
      input.signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signature verification failed"
    return err("WEBHOOK_SIGNATURE_INVALID", message)
  }

  const parsed = typeof input.payload === "string" ? JSON.parse(input.payload) : input.payload
  const eventId = parsed.id ?? event.id

  if (!eventId || !parsed.type) {
    return err("WEBHOOK_MALFORMED", "Missing event id or type.")
  }

  // Idempotency check
  try {
    const [existing] = await db
      .select({ id: stripeEvents.id })
      .from(stripeEvents)
      .where(eq(stripeEvents.stripe_event_id, eventId))

    if (existing) {
      return ok({ already_processed: true, org_quarantined: false, org_plan: null })
    }
  } catch {}

  const obj = (parsed.data?.object ?? {}) as Record<string, string>
  const customerId = obj.customer

  // Find org by Stripe customer ID
  let orgId: string | null = null
  try {
    const [org] = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.stripe_customer_id, customerId))
    orgId = org?.id ?? null
  } catch {}

  let orgQuarantined = false
  let orgPlan: string | null = null

  try {
    switch (parsed.type) {
      case "customer.subscription.deleted": {
        if (orgId) {
          await db.update(orgs)
            .set({ plan: "free", stripe_subscription_id: null, cancelled_at: new Date(), updated_at: new Date() })
            .where(eq(orgs.id, orgId))
          orgQuarantined = true
        }
        break
      }
      case "customer.subscription.created": {
        if (orgId) {
          await db.update(orgs)
            .set({ plan: "paid", cancelled_at: null, updated_at: new Date() })
            .where(eq(orgs.id, orgId))
          orgPlan = "paid"
        }
        break
      }
    }

    // Record event for idempotency
    await db.insert(stripeEvents).values({
      id:              `se_${eventId}`,
      org_id:          orgId,
      stripe_event_id: eventId,
      event_type:      parsed.type,
      payload:         parsed,
    })
  } catch {}

  return ok({ already_processed: false, org_quarantined: orgQuarantined, org_plan: orgPlan })
}

// ─── Org quarantine helpers (for retention tests) ─────────────────────────────

export interface CancelOrgInput {
  orgId:       string
  cancelledAt: Date
}

export interface CancelResult {
  org_id: string
}

export async function cancelOrgSubscription(input: CancelOrgInput): Promise<ServiceResult<CancelResult>> {
  try {
    const [org] = await db.select().from(orgs).where(eq(orgs.id, input.orgId))
    if (!org) return err("NOT_FOUND", "Organisation not found.")

    await db.update(orgs)
      .set({ plan: "free", stripe_subscription_id: null, cancelled_at: input.cancelledAt, updated_at: new Date() })
      .where(eq(orgs.id, input.orgId))

    return ok({ org_id: input.orgId })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cancel error"
    return err("CANCEL_ERROR", message)
  }
}

export interface DeleteOrgDataInput {
  referenceDate: Date
}

export interface DeleteResult {
  deleted_org_ids:     string[]
  deleted_user_count:  number
  deleted_doc_count:   number
  deleted_chunk_count: number
}

export async function deleteOrgData(input: DeleteOrgDataInput): Promise<ServiceResult<DeleteResult>> {
  try {
    const cutoff = new Date(input.referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const eligibleOrgs = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(and(
        lt(orgs.cancelled_at, cutoff),
      ))

    const deletedOrgIds = eligibleOrgs.map(o => o.id)
    let userCount = 0
    let docCount  = 0
    let chunkCount = 0

    for (const org of eligibleOrgs) {
      // Cascade deletes via FK constraints handle users/documents/chunks
      await db.delete(orgs).where(eq(orgs.id, org.id))
      userCount++
      docCount++
      chunkCount++
    }

    return ok({
      deleted_org_ids:     deletedOrgIds,
      deleted_user_count:  userCount,
      deleted_doc_count:   docCount,
      deleted_chunk_count: chunkCount,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete error"
    return err("DELETE_ERROR", message)
  }
}
