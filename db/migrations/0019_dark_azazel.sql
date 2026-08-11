-- source_type duplicated what compartments already express: a document's
-- category was recorded twice, and only the folder version governed access or
-- retrieval. The retrieval filter it fed was never wired to any UI, so no query
-- ever used it. Folders replace it outright.
ALTER TABLE "documents" DROP COLUMN IF EXISTS "source_type";--> statement-breakpoint
ALTER TABLE "chunks" DROP COLUMN IF EXISTS "source_type";--> statement-breakpoint
-- Drizzle drops the columns but leaves the type behind (same omission that
-- required 0011). Nothing references it once the columns are gone.
DROP TYPE IF EXISTS "public"."source_type";