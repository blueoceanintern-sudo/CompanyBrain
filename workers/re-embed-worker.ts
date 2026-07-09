import { db } from '@company-brain/db'
import { chunks } from '@company-brain/db'
import { eq, sql } from 'drizzle-orm'
import OpenAI from 'openai'
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@company-brain/shared'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })
}

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
      .limit(BATCH_SIZE)
      .offset(offset)

    if (batch.length === 0) break

    const texts = batch.map((c) => c.content)
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i]
      const embedding = response.data[i]?.embedding
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
