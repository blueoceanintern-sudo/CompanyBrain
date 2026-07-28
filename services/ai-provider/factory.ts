import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getAiConfig } from './config'
import { AnthropicChatProvider } from './adapters/anthropic-chat'
import { OpenAiCompatibleChatProvider } from './adapters/openai-compatible-chat'
import { OpenAiCompatibleEmbeddingProvider } from './adapters/openai-compatible-embedding'
import { withDimensionValidation } from './embedding-validator'
import type { ChatProvider, EmbeddingProvider } from './types'

let chatProvider: ChatProvider | undefined
let embeddingProvider: EmbeddingProvider | undefined

export function getChatProvider(): ChatProvider {
  if (!chatProvider) chatProvider = buildChatProvider()
  return chatProvider
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!embeddingProvider) {
    const config = getAiConfig()
    // Factory only composes — the wrapper is what actually inspects each
    // response's vector length at call time.
    embeddingProvider = withDimensionValidation(buildEmbeddingProvider(), config.embeddingDimensions)
  }
  return embeddingProvider
}

function buildChatProvider(): ChatProvider {
  const config = getAiConfig()

  if (config.chatProvider === 'anthropic') {
    const client = new Anthropic({
      apiKey: config.anthropicApiKey,
      timeout: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
    })
    return new AnthropicChatProvider(client, config.chatModel, config.logPrompts)
  }

  const client = new OpenAI({
    apiKey: config.openaiApiKey || 'local',
    baseURL: config.chatBaseUrl,
    timeout: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  })
  return new OpenAiCompatibleChatProvider(client, config.chatModel, config.logPrompts)
}

function buildEmbeddingProvider(): EmbeddingProvider {
  const config = getAiConfig()

  switch (config.embeddingProvider) {
    case 'openai-compatible': {
      const client = new OpenAI({
        apiKey: config.openaiApiKey || 'local',
        baseURL: config.embeddingBaseUrl,
        timeout: config.requestTimeoutMs,
        maxRetries: config.maxRetries,
      })
      return new OpenAiCompatibleEmbeddingProvider(
        client,
        config.embeddingModel,
        config.embeddingDimensions,
        !config.embeddingBaseUrl
      )
    }
    default: {
      // Exhaustiveness guard — adding a value to the embeddingProvider enum
      // without a branch here becomes a compile error rather than silently
      // falling through to the OpenAI-compatible path.
      const _exhaustive: never = config.embeddingProvider
      throw new Error(`Unsupported AI_EMBEDDING_PROVIDER: ${String(_exhaustive)}`)
    }
  }
}
