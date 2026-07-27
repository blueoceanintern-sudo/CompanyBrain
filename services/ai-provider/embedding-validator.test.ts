import { describe, expect, test } from 'bun:test'
import { withDimensionValidation } from './embedding-validator'
import { AiProviderError } from './errors'
import type { EmbeddingProvider } from './types'

function fakeProvider(vectors: number[][]): EmbeddingProvider {
  return { embed: async () => ({ embeddings: vectors }) }
}

describe('withDimensionValidation', () => {
  test('passes through embeddings matching the expected dimension', async () => {
    const provider = withDimensionValidation(fakeProvider([[1, 2, 3]]), 3)
    const result = await provider.embed({ input: 'x' })
    expect(result.embeddings).toEqual([[1, 2, 3]])
  })

  test('throws AiProviderError when a vector length does not match', async () => {
    const provider = withDimensionValidation(fakeProvider([[1, 2]]), 3)
    await expect(provider.embed({ input: 'x' })).rejects.toThrow(AiProviderError)
  })

  test('checks every vector in a batch, not just the first', async () => {
    const provider = withDimensionValidation(
      fakeProvider([
        [1, 2, 3],
        [4, 5],
      ]),
      3
    )
    await expect(provider.embed({ input: ['a', 'b'] })).rejects.toThrow(AiProviderError)
  })
})
