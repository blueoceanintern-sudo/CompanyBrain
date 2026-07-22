-- Both of these were declared/created in earlier migrations but are no
-- longer used as a column type anywhere in the schema:
--   visibility_class — created by 0000, never wired to a column. The actual
--     classification concept lives in chunks.visibility JSONB's
--     `classification` string field, not this enum.
--   compartment_mode — used by orgs.compartment_mode and compartments.mode,
--     but those columns were dropped in 0005_shallow_madelyne_pryor.sql
--     without also dropping the type.
-- IF EXISTS makes this safe to run against a fresh install or a DB that
-- already applied an earlier version of this cleanup.
DROP TYPE IF EXISTS "public"."visibility_class";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."compartment_mode";
