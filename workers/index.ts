import cron from 'node-cron'
import { runIngestionRetry } from './ingestion-retry'
import { runQueryLogPurge, runOrgDataPurge } from './retention'

// Ingest retry — daily at 3am
cron.schedule('0 3 * * *', async () => {
  try {
    await runIngestionRetry()
  } catch (err) {
    console.error('[worker] ingestion-retry failed:', err)
  }
})

// Query log purge (90-day retention) — daily at 3:30am
cron.schedule('30 3 * * *', async () => {
  try {
    await runQueryLogPurge()
  } catch (err) {
    console.error('[worker] query-log-purge failed:', err)
  }
})

// Org data purge (30-day quarantine after cancellation) — daily at 4am
cron.schedule('0 4 * * *', async () => {
  try {
    await runOrgDataPurge()
  } catch (err) {
    console.error('[worker] org-data-purge failed:', err)
  }
})

console.log('[workers] All cron jobs registered')
console.log('  - ingestion-retry:  daily at 03:00')
console.log('  - query-log-purge:  daily at 03:30')
console.log('  - org-data-purge:   daily at 04:00')
