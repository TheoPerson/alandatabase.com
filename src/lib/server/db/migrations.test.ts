import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';

let database: PGlite | null = null;

afterEach(async () => {
	await database?.close();
	database = null;
});

async function migration(name: string) {
	return readFile(resolve(process.cwd(), 'drizzle', name), 'utf8');
}

describe('Drizzle migration chain', () => {
	it('reconciles auth objects and retires legacy sessions safely', async () => {
		database = new PGlite();
		const baseline = await migration('0000_aromatic_puma.sql');
		const schemaReconciliation = await migration('0001_next_impossible_man.sql');
		const serviceReconciliation = await migration('0002_wet_masque.sql');
		const authorization = await migration('0003_complete_skrulls.sql');

		await database.exec(baseline);
		await database.exec(schemaReconciliation);
		await database.exec(serviceReconciliation);
		await database.exec(`
			insert into users (id, email, username, password_hash)
			values ('00000000-0000-4000-8000-000000000001', 'legacy@example.test', 'legacy', 'not-a-real-hash');
			insert into sessions (id, user_id, expires_at)
			values (
				'legacy-raw-session-token',
				'00000000-0000-4000-8000-000000000001',
				now() + interval '1 day'
			);
		`);
		await database.exec(authorization);

		const legacySession = await database.query<{ expired: boolean; revoked_at: Date | null }>(`
			select expires_at <= now() as expired, revoked_at
			from sessions
			where id = 'legacy-raw-session-token'
		`);
		expect(legacySession.rows[0]?.expired).toBe(true);
		expect(legacySession.rows[0]?.revoked_at).not.toBeNull();

		await database.exec(`
			insert into sessions (id, user_id, expires_at)
			values (
				'post-migration-session-digest',
				'00000000-0000-4000-8000-000000000001',
				now() + interval '1 day'
			);
		`);

		// Reconciliation migrations are deliberately safe to execute after a
		// partially upgraded environment has already created their objects.
		await database.exec(serviceReconciliation);
		await database.exec(authorization);

		const currentSession = await database.query<{ active: boolean; revoked_at: Date | null }>(`
			select expires_at > now() as active, revoked_at
			from sessions
			where id = 'post-migration-session-digest'
		`);
		expect(currentSession.rows[0]?.active).toBe(true);
		expect(currentSession.rows[0]?.revoked_at).toBeNull();

		const authTables = await database.query<{ table_name: string }>(`
			select table_name
			from information_schema.tables
			where table_schema = 'public'
				and table_name in ('auth_invites', 'auth_audit_events')
			order by table_name
		`);
		expect(authTables.rows.map((row) => row.table_name)).toEqual([
			'auth_audit_events',
			'auth_invites'
		]);

		const userColumns = await database.query<{ column_name: string }>(`
			select column_name
			from information_schema.columns
			where table_schema = 'public'
				and table_name = 'users'
				and column_name in ('role', 'disabled_at')
			order by column_name
		`);
		expect(userColumns.rows.map((row) => row.column_name)).toEqual(['disabled_at', 'role']);

		await expect(
			database.exec(`
				insert into users (email, username, password_hash, role)
				values ('invalid@example.test', 'invalid-role', 'not-a-real-hash', 'superuser')
			`)
		).rejects.toThrow();

		await database.exec(`
			insert into users (email, username, password_hash, role)
			values ('owner@example.test', 'first-owner', 'not-a-real-hash', 'owner')
		`);
		await expect(
			database.exec(`
				insert into users (email, username, password_hash, role)
				values ('owner-2@example.test', 'second-owner', 'not-a-real-hash', 'owner')
			`)
		).rejects.toThrow();
	}, 15_000);

	it('applies the Alan Score migration twice and preserves owner-scoped integrity', async () => {
		database = new PGlite();
		for (const name of [
			'0000_aromatic_puma.sql',
			'0001_next_impossible_man.sql',
			'0002_wet_masque.sql',
			'0003_complete_skrulls.sql'
		]) {
			await database.exec(await migration(name));
		}

		await database.exec(`
			insert into users (id, email, username, password_hash, role)
			values
				('00000000-0000-4000-8000-000000000001', 'owner@example.test', 'owner', 'hash', 'owner'),
				('00000000-0000-4000-8000-000000000002', 'member@example.test', 'member', 'hash', 'member');
			insert into movies (id, tmdb_id, title)
			values ('00000000-0000-4000-8000-000000000010', 27205, 'Inception');
			insert into user_movie_interactions (user_id, movie_id, rating)
			values (
				'00000000-0000-4000-8000-000000000001',
				'00000000-0000-4000-8000-000000000010',
				4.5
			);
		`);

		const alanScore = await migration('0004_optimal_karma.sql');
		await database.exec(alanScore);
		await database.exec(alanScore);

		await expect(
			database.exec(`
				insert into movie_personal_scores (
					user_id, movie_id, realism, computed_score, coverage, status
				) values (
					'00000000-0000-4000-8000-000000000001',
					'00000000-0000-4000-8000-000000000010',
					4.2, 4.2, 20, 'partial'
				)
			`)
		).rejects.toThrow();

		const save = (realism: number) =>
			database!.exec(`
				insert into movie_personal_scores (
					user_id, movie_id, realism, computed_score, coverage, status, tags
				) values (
					'00000000-0000-4000-8000-000000000001',
					'00000000-0000-4000-8000-000000000010',
					${realism}, ${realism}, 20, 'partial', array['theatrical']
				)
				on conflict (user_id, movie_id) do update set
					realism = excluded.realism,
					computed_score = excluded.computed_score,
					updated_at = now()
			`);

		await Promise.all([save(7.5), save(8)]);
		const rows = await database.query<{ count: number }>(`
			select count(*)::int as count from movie_personal_scores
			where user_id = '00000000-0000-4000-8000-000000000001'
				and movie_id = '00000000-0000-4000-8000-000000000010'
		`);
		expect(rows.rows[0]?.count).toBe(1);

		await database.exec(`
			insert into movie_personal_scores (
				user_id, movie_id, realism, computed_score, coverage, status
			) values (
				'00000000-0000-4000-8000-000000000002',
				'00000000-0000-4000-8000-000000000010',
				6, 6, 20, 'partial'
			)
		`);
		const perOwner = await database.query<{ count: number }>(`
			select count(*)::int as count from movie_personal_scores
			where movie_id = '00000000-0000-4000-8000-000000000010'
		`);
		expect(perOwner.rows[0]?.count).toBe(2);

		const legacy = await database.query<{ rating: string }>(`
			select rating::text from user_movie_interactions
			where user_id = '00000000-0000-4000-8000-000000000001'
		`);
		expect(legacy.rows[0]?.rating).toBe('4.5');

		await database.exec(`
			delete from movie_personal_scores
			where user_id = '00000000-0000-4000-8000-000000000001'
				and movie_id = '00000000-0000-4000-8000-000000000010'
		`);
		const remaining = await database.query<{ count: number }>(`
			select count(*)::int as count from movie_personal_scores
		`);
		expect(remaining.rows[0]?.count).toBe(1);
	}, 15_000);
});
