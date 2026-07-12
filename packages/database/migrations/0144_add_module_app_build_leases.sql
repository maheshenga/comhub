ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_token" text;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "module_app_builds" ADD CONSTRAINT "module_app_builds_attempt_count_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= 4);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "module_app_builds_claimable_idx"
  ON "module_app_builds" ("status", "next_attempt_at", "claim_expires_at", "created_at");
