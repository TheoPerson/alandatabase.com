CREATE TABLE IF NOT EXISTS "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" varchar(20) DEFAULT 'account' NOT NULL,
	"profile_id" varchar(64) DEFAULT 'default' NOT NULL,
	"subscription_id" uuid NOT NULL,
	"episode_event_id" uuid NOT NULL,
	"notification_type" varchar(32) DEFAULT 'episode_release' NOT NULL,
	"offset_days" smallint NOT NULL,
	"due_date" date NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"target_path" varchar(512) NOT NULL,
	"read_at" timestamp,
	"push_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"push_attempt_count" integer DEFAULT 0 NOT NULL,
	"last_push_attempt_at" timestamp,
	"last_push_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_events_user_type_check" CHECK ("notification_events"."user_type" = 'account'),
	CONSTRAINT "notification_events_offset_check" CHECK ("notification_events"."offset_days" in (0, 1, 7)),
	CONSTRAINT "notification_events_type_check" CHECK ("notification_events"."notification_type" = 'episode_release'),
	CONSTRAINT "notification_events_push_status_check" CHECK ("notification_events"."push_status" in ('pending', 'sent', 'not_subscribed', 'failed')),
	CONSTRAINT "notification_events_attempt_check" CHECK ("notification_events"."push_attempt_count" >= 0),
	CONSTRAINT "notification_events_target_check" CHECK ("notification_events"."target_path" like '/%')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"push_subscription_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"last_error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_delivery_status_check" CHECK ("push_notification_deliveries"."status" in ('queued', 'sending', 'retry', 'sent', 'failed', 'uncertain', 'cancelled')),
	CONSTRAINT "push_delivery_attempts_check" CHECK ("push_notification_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" varchar(20) DEFAULT 'account' NOT NULL,
	"profile_id" varchar(64) DEFAULT 'default' NOT NULL,
	"endpoint" text NOT NULL,
	"endpoint_hash" varchar(64) NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" varchar(512),
	"enabled" boolean DEFAULT true NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_user_type_check" CHECK ("push_subscriptions"."user_type" = 'account'),
	CONSTRAINT "push_subscriptions_hash_check" CHECK (length("push_subscriptions"."endpoint_hash") = 64),
	CONSTRAINT "push_subscriptions_failure_check" CHECK ("push_subscriptions"."failure_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_episode_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_show_id" integer NOT NULL,
	"show_title" varchar(255) NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"episode_name" varchar(255) NOT NULL,
	"air_date" date,
	"source_hash" varchar(64) NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tv_episode_events_show_check" CHECK ("tv_episode_events"."tmdb_show_id" > 0),
	CONSTRAINT "tv_episode_events_season_check" CHECK ("tv_episode_events"."season_number" >= 0),
	CONSTRAINT "tv_episode_events_episode_check" CHECK ("tv_episode_events"."episode_number" > 0),
	CONSTRAINT "tv_episode_events_hash_check" CHECK (length("tv_episode_events"."source_hash") = 64)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_episode_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" varchar(20) DEFAULT 'account' NOT NULL,
	"profile_id" varchar(64) DEFAULT 'default' NOT NULL,
	"tmdb_show_id" integer NOT NULL,
	"show_title" varchar(255) NOT NULL,
	"poster_path" varchar(255),
	"offset_days" smallint DEFAULT 0 NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_successful_check_at" timestamp,
	"next_check_at" timestamp DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp,
	"monitoring_since" timestamp DEFAULT now() NOT NULL,
	"last_check_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tv_episode_subscriptions_tmdb_check" CHECK ("tv_episode_subscriptions"."tmdb_show_id" > 0),
	CONSTRAINT "tv_episode_subscriptions_offset_check" CHECK ("tv_episode_subscriptions"."offset_days" in (0, 1, 7)),
	CONSTRAINT "tv_episode_subscriptions_user_type_check" CHECK ("tv_episode_subscriptions"."user_type" = 'account'),
	CONSTRAINT "tv_episode_subscriptions_profile_check" CHECK (length("tv_episode_subscriptions"."profile_id") > 0),
	CONSTRAINT "tv_episode_subscriptions_status_check" CHECK ("tv_episode_subscriptions"."last_check_status" in ('pending', 'ok', 'rejected', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_episode_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"triggered_by" varchar(16) DEFAULT 'cron' NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"notifications_created" integer DEFAULT 0 NOT NULL,
	"push_sent" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tv_episode_sync_runs_trigger_check" CHECK ("tv_episode_sync_runs"."triggered_by" in ('cron', 'manual')),
	CONSTRAINT "tv_episode_sync_runs_status_check" CHECK ("tv_episode_sync_runs"."status" in ('running', 'partial', 'complete', 'failed')),
	CONSTRAINT "tv_episode_sync_runs_counters_check" CHECK ("tv_episode_sync_runs"."processed" >= 0 and "tv_episode_sync_runs"."inserted" >= 0 and "tv_episode_sync_runs"."updated" >= 0 and "tv_episode_sync_runs"."skipped" >= 0 and "tv_episode_sync_runs"."failed" >= 0 and "tv_episode_sync_runs"."notifications_created" >= 0 and "tv_episode_sync_runs"."push_sent" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_subscription_id_tv_episode_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tv_episode_subscriptions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_episode_event_id_tv_episode_events_id_fk" FOREIGN KEY ("episode_event_id") REFERENCES "public"."tv_episode_events"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_notification_deliveries" ADD CONSTRAINT "push_notification_deliveries_notification_id_notification_events_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_notification_deliveries" ADD CONSTRAINT "push_notification_deliveries_push_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tv_episode_subscriptions" ADD CONSTRAINT "tv_episode_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notification_events_episode_delivery" ON "notification_events" USING btree ("user_id","user_type","profile_id","episode_event_id","notification_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_events_inbox" ON "notification_events" USING btree ("user_id","profile_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_events_due" ON "notification_events" USING btree ("due_date","push_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_push_delivery_device_event" ON "push_notification_deliveries" USING btree ("notification_id","push_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_delivery_due" ON "push_notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_push_subscriptions_endpoint" ON "push_subscriptions" USING btree ("endpoint_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id","profile_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tv_episode_events_identity" ON "tv_episode_events" USING btree ("tmdb_show_id","season_number","episode_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_events_air_date" ON "tv_episode_events" USING btree ("air_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_events_show" ON "tv_episode_events" USING btree ("tmdb_show_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tv_episode_subscriptions_owner_show" ON "tv_episode_subscriptions" USING btree ("user_id","user_type","profile_id","tmdb_show_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_subscriptions_due" ON "tv_episode_subscriptions" USING btree ("enabled","next_check_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_subscriptions_user" ON "tv_episode_subscriptions" USING btree ("user_id","profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_sync_runs_started" ON "tv_episode_sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tv_episode_sync_runs_status" ON "tv_episode_sync_runs" USING btree ("status");
