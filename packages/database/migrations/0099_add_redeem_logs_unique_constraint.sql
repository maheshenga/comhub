-- Add UNIQUE constraint on redeem_logs(code_id, user_id) to prevent duplicate redemptions
CREATE UNIQUE INDEX IF NOT EXISTS "redeem_logs_code_id_user_id_unique" ON "redeem_logs" ("code_id", "user_id");
