ALTER TABLE "compartments" ADD COLUMN "parent_compartment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compartments" ADD CONSTRAINT "compartments_parent_compartment_id_compartments_id_fk" FOREIGN KEY ("parent_compartment_id") REFERENCES "public"."compartments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
