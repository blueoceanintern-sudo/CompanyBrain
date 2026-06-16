-- Run after: bun db:migrate
-- Creates performance indexes that Drizzle cannot generate automatically

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS chunks_content_fts_idx
  ON chunks USING gin (to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS chunks_org_id_access_tier_idx
  ON chunks (org_id, access_tier);

CREATE INDEX IF NOT EXISTS queries_org_id_created_at_idx
  ON queries (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_org_id_created_at_idx
  ON audit_logs (org_id, created_at DESC);
