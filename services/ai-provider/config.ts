import { z } from 'zod'

// Defaults mirror the values that were previously hardcoded in
// shared/constants.ts, so an existing deployment with no new env vars set
// behaves identically to before this provider layer existed.
const DEFAULT_CHAT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large'
const DEFAULT_EMBEDDING_DIMENSIONS = 1536

const configSchema = z.object({
  chatProvider: z.enum(['anthropic', 'openai-compatible']).default('anthropic'),
  embeddingProvider: z.enum(['openai-compatible']).default('openai-compatible'),
  chatModel: z.string().min(1).default(DEFAULT_CHAT_MODEL),
  embeddingModel: z.string().min(1).default(DEFAULT_EMBEDDING_MODEL),
  embeddingDimensions: z.coerce.number().int().positive().default(DEFAULT_EMBEDDING_DIMENSIONS),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  chatBaseUrl: z.string().url().optional(),
  embeddingBaseUrl: z.string().url().optional(),
  requestTimeoutMs: z.coerce.number().int().positive().default(30_000),
  maxRetries: z.coerce.number().int().min(0).default(2),
  allowInsecureBaseUrl: z.coerce.boolean().default(false),
  logPrompts: z.coerce.boolean().default(false),
})

export type AiConfig = z.infer<typeof configSchema>

let cached: AiConfig | undefined

export function getAiConfig(): AiConfig {
  if (!cached) cached = loadAiConfig()
  return cached
}

// Exposed separately from getAiConfig so callers (API/worker entrypoints)
// can fail fast at startup with an intentional call site, without needing
// to know that the first getAiConfig() call is what triggers validation.
export function validateAiConfig(): void {
  getAiConfig()
}

function loadAiConfig(): AiConfig {
  const parsed = configSchema.safeParse({
    chatProvider: process.env.AI_CHAT_PROVIDER,
    embeddingProvider: process.env.AI_EMBEDDING_PROVIDER,
    chatModel: process.env.AI_CHAT_MODEL,
    embeddingModel: process.env.AI_EMBEDDING_MODEL,
    embeddingDimensions: process.env.AI_EMBEDDING_DIMENSIONS,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    chatBaseUrl: process.env.AI_CHAT_BASE_URL,
    embeddingBaseUrl: process.env.AI_EMBEDDING_BASE_URL,
    requestTimeoutMs: process.env.AI_REQUEST_TIMEOUT_MS,
    maxRetries: process.env.AI_MAX_RETRIES,
    allowInsecureBaseUrl: process.env.AI_ALLOW_INSECURE_BASE_URL,
    logPrompts: process.env.AI_LOG_PROMPTS,
  })

  if (!parsed.success) {
    throw new Error(`Invalid AI provider configuration: ${parsed.error.message}`)
  }

  const config = parsed.data
  validateBaseUrl('AI_CHAT_BASE_URL', config.chatBaseUrl, config.allowInsecureBaseUrl)
  validateBaseUrl('AI_EMBEDDING_BASE_URL', config.embeddingBaseUrl, config.allowInsecureBaseUrl)

  if (config.chatProvider === 'anthropic' && !config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_CHAT_PROVIDER=anthropic')
  }
  if (config.chatProvider === 'openai-compatible' && !config.chatBaseUrl && !config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY is required when AI_CHAT_PROVIDER=openai-compatible targets api.openai.com ' +
        '(set AI_CHAT_BASE_URL to point at a local endpoint that needs no key)'
    )
  }
  if (!config.embeddingBaseUrl && !config.openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY is required for embeddings (set AI_EMBEDDING_BASE_URL to point at a local ' +
        'endpoint that needs no key)'
    )
  }

  return config
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function validateBaseUrl(envVar: string, url: string | undefined, allowInsecure: boolean): void {
  if (!url) return
  const parsed = new URL(url)
  if (parsed.protocol === 'https:') return
  if (parsed.protocol === 'http:' && (isLocalHost(parsed.hostname) || allowInsecure)) return
  throw new Error(
    `${envVar}="${url}" uses http:// — only allowed for localhost, or set AI_ALLOW_INSECURE_BASE_URL=true`
  )
}
