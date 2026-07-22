ALTER TABLE IF EXISTS "desktop_releases" ADD COLUMN IF NOT EXISTS "workflow_run_id" varchar(64);--> statement-breakpoint
ALTER TABLE IF EXISTS "desktop_releases" ADD COLUMN IF NOT EXISTS "workflow_run_url" varchar(2048);
