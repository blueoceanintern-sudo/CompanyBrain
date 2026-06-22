ALTER TABLE "orgs" DROP COLUMN IF EXISTS "compartment_mode";--> statement-breakpoint
ALTER TABLE "compartments" DROP COLUMN IF EXISTS "mode";--> statement-breakpoint
ALTER TABLE "compartments" DROP COLUMN IF EXISTS "allowed_source_types";