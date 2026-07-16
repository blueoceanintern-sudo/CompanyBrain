-- Rows written through drizzle-orm 0.31 + postgres.js were double-encoded: the jsonb
-- value is a JSON string containing the real document (e.g. '"[]"' instead of '[]').
-- (v #>> '{}') extracts the inner text, and the cast re-parses it as proper jsonb.
UPDATE chunks SET visibility = (visibility #>> '{}')::jsonb WHERE jsonb_typeof(visibility) = 'string';
--> statement-breakpoint
UPDATE audit_logs SET metadata = (metadata #>> '{}')::jsonb WHERE jsonb_typeof(metadata) = 'string';
--> statement-breakpoint
UPDATE queries SET citations = (citations #>> '{}')::jsonb WHERE jsonb_typeof(citations) = 'string';
--> statement-breakpoint
UPDATE queries SET missing = (missing #>> '{}')::jsonb WHERE jsonb_typeof(missing) = 'string';
--> statement-breakpoint
UPDATE stripe_events SET payload = (payload #>> '{}')::jsonb WHERE jsonb_typeof(payload) = 'string';
