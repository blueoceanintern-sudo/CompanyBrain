// ─── Embedding capability ──────────────────────────────────────────────────

export interface EmbedRequest {
  input: string | string[]
}

export interface EmbedUsage {
  promptTokens?: number
  totalTokens?: number
}

export interface EmbedMeta {
  provider: string
  model: string
  usage?: EmbedUsage
}

export interface EmbedResult {
  embeddings: number[][]
  // Optional — callers that only need vectors (retrieval, ingestion) can
  // ignore this; kept for monitoring/debugging call sites.
  meta?: EmbedMeta
}

export interface EmbeddingProvider {
  embed(req: EmbedRequest): Promise<EmbedResult>
}

// ─── Chat capability ───────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  // Marks this message as a prompt-cache breakpoint. Providers without
  // caching support (most OpenAI-compatible / local runtimes) ignore it.
  cacheBoundary?: boolean
}

export interface ChatRequest {
  system?: string
  messages: ChatMessage[]
  maxTokens: number
}

export interface ChatUsage {
  promptTokens?: number
  completionTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface ChatMeta {
  provider: string
  model: string
  usage?: ChatUsage
}

export interface ChatResult {
  text: string
  meta?: ChatMeta
}

export interface ChatProvider {
  complete(req: ChatRequest): Promise<ChatResult>
}
