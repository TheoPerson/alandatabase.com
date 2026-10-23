CREATE TABLE IF NOT EXISTS "movie_watch_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"region" varchar(2) NOT NULL,
	"kind" varchar(10) NOT NULL,
	"provider_id" integer NOT NULL,
	"provider_name" varchar(200) NOT NULL,
	"logo_path" varchar(255),
	"display_priority" integer DEFAULT 0 NOT NULL,
	"link" text,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_watch_providers" ADD CONSTRAINT "movie_watch_providers_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_watch_providers_movie" ON "movie_watch_providers" USING btree ("movie_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_watch_providers_unique" ON "movie_watch_providers" USING btree ("movie_id","region","kind","provider_id");
