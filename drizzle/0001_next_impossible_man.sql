ALTER TABLE "movies" ADD COLUMN "local_overrides" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_movie_cast_unique" ON "movie_cast" USING btree ("movie_id","person_id","character");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_movie_crew_unique" ON "movie_crew" USING btree ("movie_id","person_id","job");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_movie_videos_unique" ON "movie_videos" USING btree ("movie_id","key");