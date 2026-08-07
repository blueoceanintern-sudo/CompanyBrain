import { db } from '@company-brain/db'
import { ingestionJobs, documents, chunks } from '@company-brain/db'
import { eq, and, lt } from 'drizzle-orm'
import { ingestDocument } from '@company-brain/ingestion'
import { getObjectBuffer } from '@company-brain/storage'
import { visibilityForTier } from '@company-brain/shared'

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

    // Documents uploaded before original-file storage existed have no bytes to
    // re-parse — those still need a manual re-upload.
    if (!doc.storageKey) {
      console.log(`[ingestion-retry] Skipping job ${job.jobId} — no stored original`)
      await db
        .update(ingestionJobs)
        .set({
          status: 'failed',
          retryCount: job.retryCount + 1,
          errorMessage: 'No original file stored for this document; manual re-upload required',
        })
        .where(eq(ingestionJobs.id, job.jobId))
      continue
    }

    const stored = await getObjectBuffer(doc.storageKey)
    if (!stored.success) {
      console.error(`[ingestion-retry] Job ${job.jobId} could not read original:`, stored.error.message)
      await db
        .update(ingestionJobs)
        .set({
          status: 'failed',
          retryCount: job.retryCount + 1,
          errorMessage: `Could not read the stored original: ${stored.error.message}`,
        })
        .where(eq(ingestionJobs.id, job.jobId))
      continue
    }

    // A previous attempt may have stored some chunks before failing; clear them
    // so a retry cannot leave the document with a partial, duplicated set.
    await db.delete(chunks).where(eq(chunks.documentId, doc.id))

    const result = await ingestDocument({
      orgId: doc.orgId,
      documentId: doc.id,
      compartmentId: doc.compartmentId,
      accessTier: doc.accessTier,
      sourceType: doc.sourceType,
      visibility: visibilityForTier(doc.accessTier),
      fileBuffer: stored.data,
      filename: doc.filename,
      uploadedBy: doc.uploadedBy ?? '',
    })

    if (!result.success) {
      console.error(`[ingestion-retry] Job ${job.jobId} failed again:`, result.error.message)
      await db
        .update(ingestionJobs)
        .set({
          status: 'failed',
          retryCount: job.retryCount + 1,
          errorMessage: result.error.message,
        })
        .where(eq(ingestionJobs.id, job.jobId))
      continue
    }

    console.log(`[ingestion-retry] Job ${job.jobId} succeeded — ${result.data.chunksCreated} chunks`)
    await db
      .update(ingestionJobs)
      .set({
        status: 'complete',
        retryCount: job.retryCount + 1,
        errorMessage: null,
        completedAt: new Date(),
      })
      .where(eq(ingestionJobs.id, job.jobId))
  }

  console.log('[ingestion-retry] Retry pass complete')
}
