import { describe, expect, test } from 'bun:test'
import { isRateLimited, recordFailure, clearRateLimit, pruneRateLimit, type RateWindow } from './rate-limit'

const WINDOW = 15 * 60 * 1000
const MAX = 3

describe('login rate limiter', () => {
  test('allows attempts below the limit and blocks at the limit', () => {
    const store = new Map<string, RateWindow>()
    const t0 = 1_000_000
    // 3 failures reach the cap.
    for (let i = 0; i < MAX; i++) {
      expect(isRateLimited(store, 'email:a', t0, MAX).limited).toBe(false)
      recordFailure(store, 'email:a', t0, WINDOW)
    }
    const check = isRateLimited(store, 'email:a', t0, MAX)
    expect(check.limited).toBe(true)
    expect(check.retryAfterSeconds).toBeGreaterThan(0)
  })

  test('a fresh window opens once the old one elapses', () => {
    const store = new Map<string, RateWindow>()
    const t0 = 1_000_000
    for (let i = 0; i < MAX; i++) recordFailure(store, 'email:a', t0, WINDOW)
    expect(isRateLimited(store, 'email:a', t0, MAX).limited).toBe(true)
    // After the window, the next check is clean.
    const later = t0 + WINDOW + 1
    expect(isRateLimited(store, 'email:a', later, MAX).limited).toBe(false)
  })

  test('a successful login clears the account counter', () => {
    const store = new Map<string, RateWindow>()
    const t0 = 1_000_000
    for (let i = 0; i < MAX; i++) recordFailure(store, 'email:a', t0, WINDOW)
    expect(isRateLimited(store, 'email:a', t0, MAX).limited).toBe(true)
    clearRateLimit(store, 'email:a')
    expect(isRateLimited(store, 'email:a', t0, MAX).limited).toBe(false)
  })

  test('keys are independent (one account being blocked does not block another)', () => {
    const store = new Map<string, RateWindow>()
    const t0 = 1_000_000
    for (let i = 0; i < MAX; i++) recordFailure(store, 'email:a', t0, WINDOW)
    expect(isRateLimited(store, 'email:a', t0, MAX).limited).toBe(true)
    expect(isRateLimited(store, 'email:b', t0, MAX).limited).toBe(false)
  })

  test('prune drops only elapsed windows', () => {
    const store = new Map<string, RateWindow>()
    const t0 = 1_000_000
    recordFailure(store, 'old', t0, WINDOW)
    recordFailure(store, 'fresh', t0 + WINDOW, WINDOW)
    pruneRateLimit(store, t0 + WINDOW + 1)
    expect(store.has('old')).toBe(false)
    expect(store.has('fresh')).toBe(true)
  })
})
