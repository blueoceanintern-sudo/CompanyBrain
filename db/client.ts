import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const sql = postgres(connectionString, { max: 10 })

export const db = drizzle(sql, { schema })
export type DB = typeof db
