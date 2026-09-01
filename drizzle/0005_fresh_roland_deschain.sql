CREATE TABLE IF NOT EXISTS "calendar_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"candidate_tmdb_ids" integer[] NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_sync_runs_status_check" CHECK ("calendar_sync_runs"."status" in ('running', 'partial', 'complete', 'failed')),
	CONSTRAINT "calendar_sync_runs_cursor_check" CHECK ("calendar_sync_runs"."cursor" >= 0),
	CONSTRAINT "calendar_sync_runs_counters_check" CHECK ("calendar_sync_runs"."processed" >= 0 and "calendar_sync_runs"."inserted" >= 0 and "calendar_sync_runs"."updated" >= 0 and "calendar_sync_runs"."skipped" >= 0 and "calendar_sync_runs"."failed" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_provider_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"link" text,
	"providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"stale_after" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_release_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"country_code" varchar(8) NOT NULL,
	"release_date" date,
	"release_type" varchar(24) DEFAULT 'unknown' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"certification" varchar(40),
	"note" text,
	"source" varchar(20) DEFAULT 'tmdb' NOT NULL,
	"source_event_key" varchar(255) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movie_release_events_type_check" CHECK ("movie_release_events"."release_type" in ('premiere', 'theatrical_limited', 'theatrical', 'digital', 'physical', 'tv', 'unknown')),
	CONSTRAINT "movie_release_events_source_check" CHECK ("movie_release_events"."source" = 'tmdb')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_release_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"offset_days" smallint NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"due_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movie_release_reminders_offset_check" CHECK ("movie_release_reminders"."offset_days" in (0, 1, 7))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "calendar_sync_runs" ADD CONSTRAINT "calendar_sync_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_provider_snapshots" ADD CONSTRAINT "movie_provider_snapshots_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_release_events" ADD CONSTRAINT "movie_release_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_release_reminders" ADD CONSTRAINT "movie_release_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_release_reminders" ADD CONSTRAINT "movie_release_reminders_event_id_movie_release_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."movie_release_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_sync_runs_requested" ON "calendar_sync_runs" USING btree ("requested_by","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_calendar_sync_runs_status" ON "calendar_sync_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_provider_snapshots_movie_region" ON "movie_provider_snapshots" USING btree ("movie_id","country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_provider_snapshots_stale" ON "movie_provider_snapshots" USING btree ("stale_after");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_provider_snapshots_region" ON "movie_provider_snapshots" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_release_events_source_key" ON "movie_release_events" USING btree ("source_event_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_release_events_primary" ON "movie_release_events" USING btree ("movie_id") WHERE "movie_release_events"."is_primary" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_release_events_date" ON "movie_release_events" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_release_events_region_date" ON "movie_release_events" USING btree ("country_code","release_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_release_events_movie" ON "movie_release_events" USING btree ("movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_release_reminders_unique" ON "movie_release_reminders" USING btree ("user_id","event_id","offset_days");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_release_reminders_due" ON "movie_release_reminders" USING btree ("user_id","due_date");
