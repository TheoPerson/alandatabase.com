-- Additive: TV catalogue (tv_shows, tv_genres, tv_keywords, tv_seasons, tv_episodes) and the
-- owner's local media library (media_files). No existing table or column changes, and the
-- statements are safe to re-run. Rollback: drop the six new tables (media_files, tv_episodes,
-- tv_seasons, tv_keywords, tv_genres, tv_shows); nothing else depends on them.
CREATE TABLE IF NOT EXISTS "tv_shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"name" text NOT NULL,
	"original_name" text,
	"overview" text,
	"tagline" text,
	"poster_path" text,
	"backdrop_path" text,
	"first_air_date" date,
	"last_air_date" date,
	"status" text,
	"number_of_seasons" integer,
	"number_of_episodes" integer,
	"vote_average" numeric(3, 1),
	"vote_count" integer,
	"popularity" real,
	"original_language" varchar(10),
	"imdb_id" varchar(20),
	"adult" boolean DEFAULT false NOT NULL,
	"local_overrides" jsonb,
	"is_locked" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tv_shows_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_genres" (
	"show_id" uuid NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "tv_genres_show_id_genre_id_pk" PRIMARY KEY("show_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_keywords" (
	"show_id" uuid NOT NULL,
	"keyword_id" integer NOT NULL,
	CONSTRAINT "tv_keywords_show_id_keyword_id_pk" PRIMARY KEY("show_id","keyword_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"name" text,
	"overview" text,
	"poster_path" text,
	"air_date" date,
	"episode_count" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tv_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"name" text,
	"overview" text,
	"still_path" text,
	"air_date" date,
	"runtime" integer,
	"vote_average" numeric(3, 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"mtime_ms" bigint NOT NULL,
	"duration_seconds" real,
	"video" jsonb,
	"audio_tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtitle_tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_subtitles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"movie_id" uuid,
	"episode_id" uuid,
	"match_status" varchar(20) DEFAULT 'unmatched' NOT NULL,
	"match_note" text,
	"parsed" jsonb,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_files_path_unique" UNIQUE("path"),
	CONSTRAINT "media_files_single_link_check" CHECK ("media_files"."movie_id" is null or "media_files"."episode_id" is null)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_genres" ADD CONSTRAINT "tv_genres_show_id_tv_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."tv_shows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_genres" ADD CONSTRAINT "tv_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_keywords" ADD CONSTRAINT "tv_keywords_show_id_tv_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."tv_shows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_keywords" ADD CONSTRAINT "tv_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_seasons" ADD CONSTRAINT "tv_seasons_show_id_tv_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."tv_shows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_show_id_tv_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."tv_shows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "tv_episodes" ADD CONSTRAINT "tv_episodes_season_id_tv_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."tv_seasons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "media_files" ADD CONSTRAINT "media_files_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "media_files" ADD CONSTRAINT "media_files_episode_id_tv_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."tv_episodes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tv_seasons_show_season" ON "tv_seasons" USING btree ("show_id","season_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tv_episodes_show_season_episode" ON "tv_episodes" USING btree ("show_id","season_number","episode_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_files_movie" ON "media_files" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_files_episode" ON "media_files" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_media_files_match_status" ON "media_files" USING btree ("match_status");
