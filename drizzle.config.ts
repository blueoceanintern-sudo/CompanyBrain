import { defineConfig } from 'drizzle-kit'
import { existsSync, readFileSync } from 'fs'

// bunx runs under Node.js and won't auto-load .env — parse it manually
if (existsSync('.env')) {
  readFileSync('.env', 'utf-8').split('\n').forEach((line) => {
    const m = line.match(/^([^#\s][^=]*)=(.*)$/)
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
