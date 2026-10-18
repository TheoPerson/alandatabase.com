-- Additive: per-user playback progress for the owner's local media library. No existing table
-- or column changes, and the statements are safe to re-run. Rollback: drop table media_progress
-- (then, to roll back 0006 too, drop media_files, tv_episodes, tv_seasons, tv_keywords,
-- tv_genres, tv_shows); nothing else depends on them.
CREATE TABLE IF NOT EXISTS "media_progress" (
	"user_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position_seconds" real NOT NULL,
	"duration_seconds" real,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_progress_user_id_file_id_pk" PRIMARY KEY("user_id","file_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "media_progress" ADD CONSTRAINT "media_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "media_progress" ADD CONSTRAINT "media_progress_file_id_media_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_progress_user_updated" ON "media_progress" USING btree ("user_id","updated_at");
