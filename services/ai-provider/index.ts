export type {
  EmbeddingProvider,
  EmbedRequest,
  EmbedResult,
  EmbedMeta,
  EmbedUsage,
  ChatProvider,
  ChatRequest,
  ChatResult,
  ChatMessage,
  ChatMeta,
  ChatUsage,
} from './types'
export { AiProviderError } from './errors'
export type { AiProviderErrorCode } from './errors'
export { getChatProvider, getEmbeddingProvider } from './factory'
// Only validateAiConfig (returns void) is public. getAiConfig / AiConfig are
// intentionally NOT re-exported — they carry the raw API keys, and keeping them
// off the public surface stops a caller outside this service from ever holding
// a secret-bearing config object. Consumers select providers via the factories.
export { validateAiConfig } from './config'
