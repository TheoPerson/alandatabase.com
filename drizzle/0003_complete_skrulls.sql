-- Persistent authorization, invitation lifecycle, and revocable sessions.
-- The migration is additive because some hosted environments may already
-- contain a subset of these objects. Existing accounts intentionally become
-- members; an owner must be promoted explicitly through the audited bootstrap.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'member' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp;
--> statement-breakpoint
DO $$
BEGIN
	-- The new application stores only token digests. Expire sessions created by
	-- the legacy raw-token application exactly once so an application rollback
	-- cannot reactivate them.
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'sessions'
			AND column_name = 'revoked_at'
	) THEN
		UPDATE "sessions" SET "expires_at" = LEAST("expires_at", now());
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
--> statement-breakpoint
UPDATE "sessions"
SET "revoked_at" = COALESCE("revoked_at", now())
WHERE "expires_at" <= now() AND "revoked_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"accepted_by" uuid,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"target_user_id" uuid,
	"invite_id" uuid,
	"action" varchar(80) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "users" WHERE "role" NOT IN ('owner', 'admin', 'member')) THEN
		RAISE EXCEPTION 'users contains unsupported roles; review them before migration';
	END IF;
	IF EXISTS (SELECT 1 FROM "auth_invites" WHERE "role" NOT IN ('admin', 'member')) THEN
		RAISE EXCEPTION 'auth_invites contains unsupported roles; review them before migration';
	END IF;
	IF (SELECT count(*) FROM "users" WHERE "role" = 'owner') > 1 THEN
		RAISE EXCEPTION 'users contains multiple owners; reconcile them before migration';
	END IF;
	IF EXISTS (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) THEN
		RAISE EXCEPTION 'users contains duplicate case-insensitive emails; reconcile them before migration';
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'public.users'::regclass) THEN
		ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" in ('owner', 'admin', 'member'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_invites_role_check' AND conrelid = 'public.auth_invites'::regclass) THEN
		ALTER TABLE "auth_invites" ADD CONSTRAINT "auth_invites_role_check" CHECK ("role" in ('admin', 'member'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_invites_token_hash_unique' AND conrelid = 'public.auth_invites'::regclass) THEN
		ALTER TABLE "auth_invites" ADD CONSTRAINT "auth_invites_token_hash_unique" UNIQUE ("token_hash");
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_invites_invited_by_users_id_fk' AND conrelid = 'public.auth_invites'::regclass) THEN
		ALTER TABLE "auth_invites" ADD CONSTRAINT "auth_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_invites_accepted_by_users_id_fk' AND conrelid = 'public.auth_invites'::regclass) THEN
		ALTER TABLE "auth_invites" ADD CONSTRAINT "auth_invites_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_audit_events_actor_user_id_users_id_fk' AND conrelid = 'public.auth_audit_events'::regclass) THEN
		ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_audit_events_target_user_id_users_id_fk' AND conrelid = 'public.auth_audit_events'::regclass) THEN
		ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_audit_events_invite_id_auth_invites_id_fk' AND conrelid = 'public.auth_audit_events'::regclass) THEN
		ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_invite_id_auth_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."auth_invites"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_audit_actor" ON "auth_audit_events" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_audit_target" ON "auth_audit_events" USING btree ("target_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_audit_created" ON "auth_audit_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_invites_email" ON "auth_invites" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_invites_pending" ON "auth_invites" USING btree ("email", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_active" ON "sessions" USING btree ("user_id", "revoked_at", "expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users" USING btree ("role");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_normalized" ON "users" USING btree (lower("email"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_single_owner" ON "users" USING btree ("role") WHERE "role" = 'owner';
