CREATE TABLE "site_config" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" text,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_monthly" integer DEFAULT 0 NOT NULL,
	"price_yearly" integer DEFAULT 0 NOT NULL,
	"credits_per_month" bigint DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb,
	"sort" integer DEFAULT 0,
	"enabled" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"payment_channel" varchar(32),
	"external_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"total_earned" bigint DEFAULT 0 NOT NULL,
	"total_consumed" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"type" varchar(32) NOT NULL,
	"description" text,
	"reference_id" text,
	"model" varchar(150),
	"tokens_input" integer,
	"tokens_output" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redeem_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"credits_amount" bigint DEFAULT 0 NOT NULL,
	"plan_id" varchar(64),
	"plan_duration_days" integer,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redeem_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "redeem_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_config" ADD CONSTRAINT "site_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_logs" ADD CONSTRAINT "redeem_logs_code_id_redeem_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."redeem_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_logs" ADD CONSTRAINT "redeem_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_expires_at_idx" ON "user_subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions" USING btree ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_type_created_at_idx" ON "credit_transactions" USING btree ("type", "created_at");--> statement-breakpoint
CREATE INDEX "redeem_codes_code_idx" ON "redeem_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "redeem_codes_created_by_idx" ON "redeem_codes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "redeem_logs_code_id_idx" ON "redeem_logs" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "redeem_logs_user_id_idx" ON "redeem_logs" USING btree ("user_id");
--> statement-breakpoint
-- Seed default plans
INSERT INTO "plans" ("id", "name", "description", "price_monthly", "price_yearly", "credits_per_month", "features", "sort", "enabled") VALUES
('free', 'Free', '免费计划', 0, 0, 500000, '{"maxModels": 3}', 0, true),
('starter', 'Starter', '入门计划', 990, 9900, 5000000, '{"maxModels": 10}', 1, true),
('pro', 'Pro', '专业计划', 2990, 29900, 15000000, '{"maxModels": -1}', 2, true),
('ultimate', 'Ultimate', '旗舰计划', 4990, 49900, 35000000, '{"maxModels": -1, "priority": true}', 3, true);
--> statement-breakpoint
-- Seed default site config
INSERT INTO "site_config" ("key", "value", "encrypted") VALUES
('brand_name', 'LobeHub', false),
('brand_logo_url', null, false),
('brand_favicon_url', null, false),
('site_title', 'LobeHub', false),
('site_description', null, false),
('official_url', 'https://chat.vip.hezelove.cn', false),
('support_email', null, false),
('newapi_base_url', 'http://ai.hezebuy.cn/v1', false),
('newapi_api_key', null, true),
('newapi_enabled_models', null, false),
('newapi_enabled', 'false', false),
('model_pricing', '{}', false);
