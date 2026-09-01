CREATE TABLE IF NOT EXISTS "movie_personal_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"realism" numeric(3, 1),
	"cinematography" numeric(3, 1),
	"original_language_experience" numeric(3, 1),
	"tension" numeric(3, 1),
	"cast" numeric(3, 1),
	"atmosphere" numeric(3, 1),
	"rewatchability" numeric(3, 1),
	"computed_score" numeric(3, 1),
	"coverage" smallint DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'unrated' NOT NULL,
	"note" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movie_personal_scores_realism_check" CHECK ("movie_personal_scores"."realism" is null or ("movie_personal_scores"."realism" >= 0 and "movie_personal_scores"."realism" <= 10 and mod("movie_personal_scores"."realism" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_cinematography_check" CHECK ("movie_personal_scores"."cinematography" is null or ("movie_personal_scores"."cinematography" >= 0 and "movie_personal_scores"."cinematography" <= 10 and mod("movie_personal_scores"."cinematography" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_original_language_check" CHECK ("movie_personal_scores"."original_language_experience" is null or ("movie_personal_scores"."original_language_experience" >= 0 and "movie_personal_scores"."original_language_experience" <= 10 and mod("movie_personal_scores"."original_language_experience" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_tension_check" CHECK ("movie_personal_scores"."tension" is null or ("movie_personal_scores"."tension" >= 0 and "movie_personal_scores"."tension" <= 10 and mod("movie_personal_scores"."tension" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_cast_check" CHECK ("movie_personal_scores"."cast" is null or ("movie_personal_scores"."cast" >= 0 and "movie_personal_scores"."cast" <= 10 and mod("movie_personal_scores"."cast" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_atmosphere_check" CHECK ("movie_personal_scores"."atmosphere" is null or ("movie_personal_scores"."atmosphere" >= 0 and "movie_personal_scores"."atmosphere" <= 10 and mod("movie_personal_scores"."atmosphere" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_rewatchability_check" CHECK ("movie_personal_scores"."rewatchability" is null or ("movie_personal_scores"."rewatchability" >= 0 and "movie_personal_scores"."rewatchability" <= 10 and mod("movie_personal_scores"."rewatchability" * 2, 1) = 0)),
	CONSTRAINT "movie_personal_scores_computed_check" CHECK ("movie_personal_scores"."computed_score" is null or ("movie_personal_scores"."computed_score" >= 0 and "movie_personal_scores"."computed_score" <= 10)),
	CONSTRAINT "movie_personal_scores_coverage_check" CHECK ("movie_personal_scores"."coverage" >= 0 and "movie_personal_scores"."coverage" <= 100),
	CONSTRAINT "movie_personal_scores_status_check" CHECK ("movie_personal_scores"."status" in ('unrated', 'partial', 'complete')),
	CONSTRAINT "movie_personal_scores_result_check" CHECK (("movie_personal_scores"."status" = 'unrated' and "movie_personal_scores"."coverage" = 0 and "movie_personal_scores"."computed_score" is null)
					or ("movie_personal_scores"."status" = 'partial' and "movie_personal_scores"."coverage" > 0 and "movie_personal_scores"."coverage" < 100 and "movie_personal_scores"."computed_score" is not null)
					or ("movie_personal_scores"."status" = 'complete' and "movie_personal_scores"."coverage" = 100 and "movie_personal_scores"."computed_score" is not null))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_personal_scores" ADD CONSTRAINT "movie_personal_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "movie_personal_scores" ADD CONSTRAINT "movie_personal_scores_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_movie_personal_scores_user_movie" ON "movie_personal_scores" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_personal_scores_user" ON "movie_personal_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_movie_personal_scores_movie" ON "movie_personal_scores" USING btree ("movie_id");
