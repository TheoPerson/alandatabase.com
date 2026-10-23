-- Additive: per-user watchlist and favourite flags for series, keyed by TMDB id. No existing
-- table or column changes, and the statements are safe to re-run. Rollback: drop table
-- user_show_interactions; nothing else depends on it.
CREATE TABLE IF NOT EXISTS "user_show_interactions" (
	"user_id" uuid NOT NULL,
	"tmdb_id" integer NOT NULL,
	"watchlist" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_show_interactions_user_id_tmdb_id_pk" PRIMARY KEY("user_id","tmdb_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_show_interactions" ADD CONSTRAINT "user_show_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_usi_user_updated" ON "user_show_interactions" USING btree ("user_id","updated_at");
