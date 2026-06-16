import { db } from '@company-brain/db'
import { ingestionJobs, documents } from '@company-brain/db'
import { eq, and, lt } from 'drizzle-orm'
import { ingestDocument } from '@company-brain/ingestion'
import type { AccessTier, SourceType, VisibilityPolicy } from '@company-brain/shared'

export async function runIngestionRetry(): Promise<void> {
  console.log('[ingestion-retry] Starting retry pass')

  const failedJobs = await db
    .select({
      jobId: ingestionJobs.id,
      documentId: ingestionJobs.documentId,
      orgId: ingestionJobs.orgId,
      retryCount: ingestionJobs.retryCount,
      maxRetries: ingestionJobs.maxRetries,
    })
    .from(ingestionJobs)
    .where(
      and(
        eq(ingestionJobs.status, 'failed'),
        lt(ingestionJobs.retryCount, ingestionJobs.maxRetries)
      )
    )

  console.log(`[ingestion-retry] Found ${failedJobs.length} failed jobs to retry`)

  for (const job of failedJobs) {
    // Mark as running
    await db
      .update(ingestionJobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(ingestionJobs.id, job.jobId))

    // Fetch document to get metadata needed for re-ingestion
    const docRows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, job.documentId))
      .limit(1)

    const doc = docRows[0]
    if (!doc) {
      await db
        .update(ingestionJobs)
        .set({ status: 'failed', errorMessage: 'Document not found' })
        .where(eq(ingestionJobs.id, job.jobId))
      continue
    }

    // Re-ingestion requires the original file. In v1 we skip if no file is cached.
    // In production, store the file in object storage and retrieve it here.
    console.log(`[ingestion-retry] Skipping job ${job.jobId} — file re-fetch not implemented in v1`)

    await db
      .update(ingestionJobs)
      .set({
        status: 'failed',
        retryCount: job.retryCount + 1,
        errorMessage: 'File re-fetch not available in v1; manual re-upload required',
      })
      .where(eq(ingestionJobs.id, job.jobId))
  }

  console.log('[ingestion-retry] Retry pass complete')
}
