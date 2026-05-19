import cron from 'node-cron'
import { runIngestionRetry } from './ingestion-retry'

// Ingest retry — daily at 3am
cron.schedule('0 3 * * *', async () => {
  try {
    await runIngestionRetry()
  } catch (err) {
    console.error('[worker] ingestion-retry failed:', err)
  }
})

console.log('[workers] All cron jobs registered')
console.log('  - ingestion-retry: daily at 03:00')
