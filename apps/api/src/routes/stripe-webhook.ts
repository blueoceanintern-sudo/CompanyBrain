import { Hono } from 'hono'
import { handleStripeWebhook } from '@company-brain/payments'

const stripeWebhookRoute = new Hono()

// POST /webhooks/stripe — no auth middleware, Stripe signature validated inside
stripeWebhookRoute.post('/', async (c) => {
  const signature = c.req.header('Stripe-Signature')
  if (!signature) {
    return c.json({ success: false, error: { code: 'MISSING_SIGNATURE', message: 'No Stripe-Signature header' } }, 400)
  }

  const payload = await c.req.text()

  const result = await handleStripeWebhook({ payload, signature })
  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400)
  }

  return c.json({ success: true, data: { received: true } })
})

export default stripeWebhookRoute
