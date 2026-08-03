import type OpenAI from 'openai'
import type { EmbeddingProvider, EmbedRequest, EmbedResult, EmbedUsage } from '../types'
import { AiProviderError, normalizeError } from '../errors'

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly dimensions: number,
    // The `dimensions` truncation param is only supported by OpenAI's own
    // text-embedding-3-* models. Arbitrary OpenAI-compatible / local servers
    // commonly reject unknown params, so it's only sent against real OpenAI.
    private readonly sendDimensionsParam: boolean
  ) {}

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: req.input,
        ...(this.sendDimensionsParam ? { dimensions: this.dimensions } : {}),
      })

      if (response.data.length === 0) {
        throw new AiProviderError('INVALID_RESPONSE', 'Embedding provider returned no vectors')
      }

      // OpenAI returns `data` in request order, but the spec documents each
      // item's `index` and third-party OpenAI-compatible servers don't all
      // preserve order — sort by index so embeddings line up with inputs.
      const embeddings = [...response.data]
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding)

      return {
        embeddings,
        meta: { provider: 'openai-compatible', model: this.model, usage: buildUsage(response.usage) },
      }
    } catch (err) {
      throw normalizeError(err, 'openai-compatible embedding')
    }
  }
}

function buildUsage(usage: { prompt_tokens: number; total_tokens: number } | undefined): EmbedUsage {
  if (!usage) return {}
  return { promptTokens: usage.prompt_tokens, totalTokens: usage.total_tokens }
}
