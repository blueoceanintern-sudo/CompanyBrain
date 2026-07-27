export type AiProviderErrorCode = 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'UNKNOWN'

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode

  constructor(code: AiProviderErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AiProviderError'
    this.code = code
  }
}

// Both the OpenAI and Anthropic SDKs throw an APIError with a `.status` for
// any HTTP-level failure — that's a far more reliable signal than matching
// on `.message`, which changes shape between SDK versions.
export function normalizeError(err: unknown, provider: string): AiProviderError {
  if (err instanceof AiProviderError) return err

  const status = (err as { status?: number } | undefined)?.status
  const message = err instanceof Error ? err.message : String(err)

  if (status === 401 || status === 403) {
    return new AiProviderError('AUTH', `${provider} authentication failed`, { cause: err })
  }
  if (status === 429) {
    return new AiProviderError('RATE_LIMIT', `${provider} rate limit exceeded`, { cause: err })
  }
  if (status !== undefined && status >= 500) {
    return new AiProviderError('UNKNOWN', `${provider} server error`, { cause: err })
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return new AiProviderError('TIMEOUT', `${provider} request timed out`, { cause: err })
  }
  return new AiProviderError('UNKNOWN', `${provider} request failed: ${message}`, { cause: err })
}
