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
});
