CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"name" varchar(500) NOT NULL,
	"overview" text,
	"poster_path" varchar(255),
	"backdrop_path" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_cast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"character" varchar(500),
	"cast_order" integer,
	"credit_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "movie_crew" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"department" varchar(100),
	"job" varchar(100),
	"credit_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "movie_genres" (
	"movie_id" uuid NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "movie_genres_movie_id_genre_id_pk" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "movie_keywords" (
	"movie_id" uuid NOT NULL,
	"keyword_id" integer NOT NULL,
	CONSTRAINT "movie_keywords_movie_id_keyword_id_pk" PRIMARY KEY("movie_id","keyword_id")
);
--> statement-breakpoint
CREATE TABLE "movie_production_companies" (
	"movie_id" uuid NOT NULL,
	"company_id" integer NOT NULL,
	CONSTRAINT "movie_production_companies_movie_id_company_id_pk" PRIMARY KEY("movie_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "movie_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"site" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(500),
	"official" boolean DEFAULT false,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" varchar(20),
	"title" varchar(500) NOT NULL,
	"original_title" varchar(500),
	"original_language" varchar(10),
	"overview" text,
	"tagline" text,
	"poster_path" varchar(255),
	"backdrop_path" varchar(255),
	"release_date" date,
	"runtime" integer,
	"status" varchar(50),
	"budget" bigint,
	"revenue" bigint,
	"popularity" numeric(10, 3),
	"vote_average" numeric(4, 2),
	"vote_count" integer,
	"adult" boolean DEFAULT false NOT NULL,
	"collection_id" uuid,
	"metadata" jsonb,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movies_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" varchar(20),
	"name" varchar(500) NOT NULL,
	"also_known_as" text[],
	"biography" text,
	"birthday" date,
	"deathday" date,
	"place_of_birth" varchar(500),
	"profile_path" varchar(255),
	"popularity" numeric(10, 3),
	"gender" smallint,
	"known_for_department" varchar(100),
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "people_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE TABLE "production_companies" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"logo_path" varchar(255),
	"origin_country" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_list_items" (
	"list_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_list_items_list_id_movie_id_pk" PRIMARY KEY("list_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "user_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_movie_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
	"watchlist" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"rating" numeric(2, 1),
	"watch_date" date,
	"rewatch_count" integer DEFAULT 0 NOT NULL,
	"personal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"content" text NOT NULL,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"avatar_path" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "movie_cast" ADD CONSTRAINT "movie_cast_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_cast" ADD CONSTRAINT "movie_cast_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_crew" ADD CONSTRAINT "movie_crew_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_crew" ADD CONSTRAINT "movie_crew_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_keywords" ADD CONSTRAINT "movie_keywords_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_keywords" ADD CONSTRAINT "movie_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_production_companies" ADD CONSTRAINT "movie_production_companies_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_production_companies" ADD CONSTRAINT "movie_production_companies_company_id_production_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."production_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_videos" ADD CONSTRAINT "movie_videos_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_list_id_user_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."user_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_interactions" ADD CONSTRAINT "user_movie_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movie_interactions" ADD CONSTRAINT "user_movie_interactions_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reviews" ADD CONSTRAINT "user_reviews_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_movie_cast_movie" ON "movie_cast" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "idx_movie_cast_person" ON "movie_cast" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_movie_crew_movie" ON "movie_crew" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "idx_movie_crew_person" ON "movie_crew" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_movies_tmdb_id" ON "movies" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "idx_movies_release_date" ON "movies" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "idx_movies_popularity" ON "movies" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "idx_movies_vote_average" ON "movies" USING btree ("vote_average");--> statement-breakpoint
CREATE INDEX "idx_people_tmdb_id" ON "people" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_lists_user" ON "user_lists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_umi_user_movie" ON "user_movie_interactions" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "idx_umi_user" ON "user_movie_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_reviews_user_movie" ON "user_reviews" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");