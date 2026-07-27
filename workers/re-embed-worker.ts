import { db } from '@company-brain/db'
import { chunks } from '@company-brain/db'
import { eq, sql } from 'drizzle-orm'
import { getEmbeddingProvider } from '@company-brain/ai-provider'

/**
 * Re-embeds all active chunks. Run manually after an embedding model change.
 * Processes in batches to stay within memory limits on the 2GB VPS.
 */
export async function runReEmbed(): Promise<void> {
  console.log('[re-embed] Starting re-embedding pass')
  const BATCH_SIZE = 10
  let offset = 0
  let totalProcessed = 0

  while (true) {
    const batch = await db
      .select({ id: chunks.id, content: chunks.content })
      .from(chunks)
      .where(eq(chunks.status, 'active'))
      // Stable order is required for LIMIT/OFFSET pagination — without it
      // Postgres can return rows in any order between pages, so some chunks
      // get re-embedded twice and others skipped entirely.
      .orderBy(chunks.id)
      .limit(BATCH_SIZE)
      .offset(offset)

    if (batch.length === 0) break

    const texts = batch.map((c) => c.content)
    const result = await getEmbeddingProvider().embed({ input: texts })

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i]
      const embedding = result.embeddings[i]
      if (!chunk || !embedding) continue
      const vectorLiteral = `[${embedding.join(',')}]`
      await db.execute(
        sql`UPDATE chunks SET embedding = ${vectorLiteral}::vector WHERE id = ${chunk.id}`
      )
    }

    totalProcessed += batch.length
    offset += BATCH_SIZE
    console.log(`[re-embed] Processed ${totalProcessed} chunks`)
  }

  console.log('[re-embed] Re-embedding complete')
}

// Runnable directly: `bun run re-embed` (root script) or `bun run workers/re-embed-worker.ts`.
// Manual-only by design — it rewrites every active chunk's embedding, so it must never be
// put on a schedule. Run it after changing AI_EMBEDDING_MODEL / AI_EMBEDDING_DIMENSIONS.
if (import.meta.main) {
  runReEmbed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[re-embed] Failed:', err)
      process.exit(1)
    })
}
