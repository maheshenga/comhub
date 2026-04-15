-- Audit logs for admin actions
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(64) NOT NULL,
  "target_type" varchar(64),
  "target_id" text,
  "details" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
