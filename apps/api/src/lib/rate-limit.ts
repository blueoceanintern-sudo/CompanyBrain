// Minimal in-memory fixed-window rate limiter for the login endpoint. No Redis
// or external store (single API instance; see CLAUDE.md hosting notes) and no
// new dependency. The functions are pure over an injected store + `now` so they
// can be unit-tested; the store lives at the call site.

export interface RateWindow {
  count: number
  resetAt: number
}

export interface RateLimitCheck {
  limited: boolean
  retryAfterSeconds: number
}

// Read-only: is this key already at or over the limit for its current window?
export function isRateLimited(
  store: Map<string, RateWindow>,
  key: string,
  now: number,
  max: number
): RateLimitCheck {
  const w = store.get(key)
  if (!w || now >= w.resetAt) return { limited: false, retryAfterSeconds: 0 }
  if (w.count >= max) return { limited: true, retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000) }
  return { limited: false, retryAfterSeconds: 0 }
}

// Records one failed attempt against a key, starting a fresh window if needed.
export function recordFailure(
  store: Map<string, RateWindow>,
  key: string,
  now: number,
  windowMs: number
): void {
  const w = store.get(key)
  if (!w || now >= w.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  w.count += 1
}

// Clears a key's counter — called on a successful login so a legitimate user is
// not locked out by a few earlier typos.
export function clearRateLimit(store: Map<string, RateWindow>, key: string): void {
  store.delete(key)
}

// Drops keys whose window has elapsed so the store does not grow unbounded.
export function pruneRateLimit(store: Map<string, RateWindow>, now: number): void {
  for (const [key, w] of store) {
    if (now >= w.resetAt) store.delete(key)
  }
}
