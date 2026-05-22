import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as orgsSchema         from "./schema/orgs"
import * as usersSchema        from "./schema/users"
import * as compartmentsSchema from "./schema/compartments"
import * as documentsSchema    from "./schema/documents"
import * as chunksSchema       from "./schema/chunks"
import * as queriesSchema      from "./schema/queries"
import * as auditLogsSchema    from "./schema/audit-logs"
import * as ingestionJobsSchema from "./schema/ingestion-jobs"
import * as stripeEventsSchema  from "./schema/stripe-events"

const schema = {
  ...orgsSchema,
  ...usersSchema,
  ...compartmentsSchema,
  ...documentsSchema,
  ...chunksSchema,
  ...queriesSchema,
  ...auditLogsSchema,
  ...ingestionJobsSchema,
  ...stripeEventsSchema,
}

const connectionString = process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/blueocean"

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

export type DB = typeof db

export * from "./schema/orgs"
export * from "./schema/users"
export * from "./schema/compartments"
export * from "./schema/documents"
export * from "./schema/chunks"
export * from "./schema/queries"
export * from "./schema/audit-logs"
export * from "./schema/ingestion-jobs"
export * from "./schema/stripe-events"
