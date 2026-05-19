import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authMiddleware, orgIsolationMiddleware } from './middleware/auth'
import authRoute from './routes/auth'
import documentsRoute from './routes/documents'
import queryRoute from './routes/query'
import adminRoute from './routes/admin'
import paymentsRoute from './routes/payments'
import analyticsRoute from './routes/analytics'
import stripeWebhookRoute from './routes/stripe-webhook'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  })
)

app.get('/health', (c) => c.json({ status: 'ok' }))

// Public routes
app.route('/api/v1/auth', authRoute)
app.route('/api/v1/webhooks/stripe', stripeWebhookRoute)

// Protected org-scoped routes
const orgApp = new Hono()
orgApp.use('*', authMiddleware)
orgApp.use('*', orgIsolationMiddleware)

orgApp.route('/documents', documentsRoute)
orgApp.route('/query', queryRoute)
orgApp.route('/', adminRoute)
orgApp.route('/', paymentsRoute)
orgApp.route('/analytics', analyticsRoute)

app.route('/api/v1/orgs/:id', orgApp)

const port = Number(process.env.PORT ?? 3002)
console.log(`API listening on port ${port}`)

export default { port, fetch: app.fetch }
