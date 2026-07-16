import { customType } from 'drizzle-orm/pg-core'

// drizzle-orm 0.31 + postgres.js double-encodes jsonb writes: drizzle JSON.stringifies
// the value, then the driver sends that string as a jsonb scalar string. Passing the
// raw value through lets postgres.js serialize it correctly. fromDriver re-parses rows
// written before this fix (migration 0008 rewrites them, but stray strings stay safe).
export const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return 'jsonb'
  },
  toDriver(value) {
    return value
  },
  fromDriver(value) {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  },
})
