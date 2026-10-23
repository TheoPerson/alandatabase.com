ALTER TABLE "movies" ADD COLUMN IF NOT EXISTS "imdb_rating" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN IF NOT EXISTS "imdb_vote_count" integer;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN IF NOT EXISTS "imdb_rating_updated_at" timestamp;
