ALTER TABLE "documents" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size_bytes" integer;