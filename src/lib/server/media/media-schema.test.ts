import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMigratedTestDatabase } from '../testing/pglite';

type TestContext = Awaited<ReturnType<typeof createMigratedTestDatabase>>;

let context: TestContext;

async function migration(name: string) {
	return readFile(resolve(process.cwd(), 'drizzle', name), 'utf8');
}

beforeAll(async () => {
	context = await createMigratedTestDatabase();
});

afterAll(async () => {
	await context?.pg.close();
});

describe('owner media library migrations (0006 + 0007)', () => {
	it('are additive and safe to re-run on a database that already has them', async () => {
		await context.pg.exec(await migration('0006_owner_media_library.sql'));
		await context.pg.exec(await migration('0007_media_progress.sql'));

		const tables = await context.pg.query<{ table_name: string }>(`
			select table_name from information_schema.tables
			where table_schema = 'public'
				and table_name in ('tv_shows', 'tv_genres', 'tv_keywords', 'tv_seasons', 'tv_episodes',
					'media_files', 'media_progress')
			order by table_name
		`);
		expect(tables.rows.map((row) => row.table_name)).toEqual([
			'media_files',
			'media_progress',
			'tv_episodes',
			'tv_genres',
			'tv_keywords',
			'tv_seasons',
			'tv_shows'
		]);
	});

	it('keeps a file linked to a film or an episode, never both, and cascades progress', async () => {
		const { pg } = context;
		const movie = await pg.query<{ id: string }>(
			`insert into movies (tmdb_id, title) values (9001, 'Film') returning id`
		);
		const show = await pg.query<{ id: string }>(
			`insert into tv_shows (tmdb_id, name) values (9002, 'Show') returning id`
		);
		const season = await pg.query<{ id: string }>(
			`insert into tv_seasons (show_id, season_number) values ($1, 1) returning id`,
			[show.rows[0].id]
		);
		const episode = await pg.query<{ id: string }>(
			`insert into tv_episodes (show_id, season_id, season_number, episode_number)
			 values ($1, $2, 1, 1) returning id`,
			[show.rows[0].id, season.rows[0].id]
		);

		await expect(
			pg.query(
				`insert into media_files (path, size_bytes, mtime_ms, movie_id, episode_id)
				 values ('/x/both.mkv', 1, 1, $1, $2)`,
				[movie.rows[0].id, episode.rows[0].id]
			)
		).rejects.toThrow(/media_files_single_link_check/u);

		const file = await pg.query<{ id: string }>(
			`insert into media_files (path, size_bytes, mtime_ms, movie_id)
			 values ('/x/film.mkv', 1, 1, $1) returning id`,
			[movie.rows[0].id]
		);
		const user = await pg.query<{ id: string }>(
			`insert into users (email, username, password_hash) values ('m@example.test', 'm', 'x') returning id`
		);
		await pg.query(
			`insert into media_progress (user_id, file_id, position_seconds) values ($1, $2, 10)`,
			[user.rows[0].id, file.rows[0].id]
		);

		// Deleting the film unlinks the file (set null) but keeps it and its progress.
		await pg.query(`delete from movies where id = $1`, [movie.rows[0].id]);
		const unlinked = await pg.query<{ movie_id: string | null }>(
			`select movie_id from media_files where id = $1`,
			[file.rows[0].id]
		);
		expect(unlinked.rows[0].movie_id).toBeNull();

		// Deleting the file removes its progress rows.
		await pg.query(`delete from media_files where id = $1`, [file.rows[0].id]);
		const progress = await pg.query(`select 1 from media_progress where file_id = $1`, [
			file.rows[0].id
		]);
		expect(progress.rows).toHaveLength(0);
	});
});
