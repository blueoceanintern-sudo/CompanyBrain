import { describe, expect, test } from 'bun:test'
import { AiProviderError, normalizeError } from './errors'

describe('normalizeError', () => {
  test('maps 401/403 to AUTH', () => {
    expect(normalizeError({ status: 401 }, 'test').code).toBe('AUTH')
    expect(normalizeError({ status: 403 }, 'test').code).toBe('AUTH')
  })

  test('maps 429 to RATE_LIMIT', () => {
    expect(normalizeError({ status: 429 }, 'test').code).toBe('RATE_LIMIT')
  })

  test('maps 5xx to UNKNOWN', () => {
    expect(normalizeError({ status: 503 }, 'test').code).toBe('UNKNOWN')
  })

  test('maps connection-refused/timeout messages without a status to TIMEOUT', () => {
    expect(normalizeError(new Error('connect ECONNREFUSED'), 'test').code).toBe('TIMEOUT')
    expect(normalizeError(new Error('Request timeout'), 'test').code).toBe('TIMEOUT')
  })

  test('passes an existing AiProviderError through unchanged', () => {
    const original = new AiProviderError('INVALID_RESPONSE', 'no text block')
    expect(normalizeError(original, 'test')).toBe(original)
  })

  test('preserves the underlying error as cause', () => {
    const original = new Error('boom')
    const normalized = normalizeError(original, 'test')
    expect(normalized.cause).toBe(original)
  })
})
