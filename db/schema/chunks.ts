import { pgTable, text, integer, timestamp, jsonb, customType } from "drizzle-orm/pg-core"
import { orgs } from "./orgs"
import { documents } from "./documents"
import { compartments } from "./compartments"
import { accessTierEnum, sourceTypeEnum, chunkStatusEnum } from "./documents"

// pgvector type for 1536-dimension embeddings
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return "vector(1536)" },
  toDriver(value: number[]) { return `[${value.join(",")}]` },
  fromDriver(value: string) {
    return value.slice(1, -1).split(",").map(Number)
  },
})

export const chunks = pgTable("chunks", {
  id:             text("id").primaryKey(),
  org_id:         text("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  document_id:    text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  compartment_id: text("compartment_id").notNull().references(() => compartments.id),
  content:        text("content").notNull(),
  embedding:      vector("embedding"),
  content_hash:   text("content_hash").notNull(),
  visibility:     jsonb("visibility"),
  access_tier:    accessTierEnum("access_tier").notNull(),
  source_type:    sourceTypeEnum("source_type").notNull(),
  chunk_index:    integer("chunk_index").notNull(),
  parent_chunk_id: text("parent_chunk_id"),
  status:         chunkStatusEnum("status").notNull().default("active"),
  created_at:     timestamp("created_at").notNull().defaultNow(),
})

export type Chunk = typeof chunks.$inferSelect
export type NewChunk = typeof chunks.$inferInsert
