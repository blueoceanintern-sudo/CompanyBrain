import type { EmbeddingProvider, EmbedRequest, EmbedResult } from './types'
import { AiProviderError } from './errors'

// The `chunks.embedding` column is a fixed-width `vector(N)` in Postgres —
// an embedding model swap that returns a different width would otherwise
// corrupt inserts silently. This wraps any EmbeddingProvider and checks the
// response, not the factory: the factory only constructs providers, it never
// sees a request/response, so validation has to live here or in the adapter.
export function withDimensionValidation(
  provider: EmbeddingProvider,
  expectedDimensions: number
): EmbeddingProvider {
  return {
    async embed(req: EmbedRequest): Promise<EmbedResult> {
      const result = await provider.embed(req)
      for (const vector of result.embeddings) {
        if (vector.length !== expectedDimensions) {
          throw new AiProviderError(
            'INVALID_RESPONSE',
            `Embedding provider returned ${vector.length} dimensions, expected ${expectedDimensions} ` +
              `(AI_EMBEDDING_DIMENSIONS). The embedding model likely changed without a matching database ` +
              `migration and re-embed pass.`
          )
        }
      }
      return result
    },
  }
}
