import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { applyInteraction, parseInteractionUpdate } from './interaction.service';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;
let userId: string;
let movieId: string;
let adultId: string;

beforeAll(async () => {
	userId = (
		await pg.query<{ id: string }>(
			`insert into users (email, username, password_hash) values ('a@b.test', 'a', 'x') returning id`
		)
	).rows[0].id;
	movieId = (
		await pg.query<{ id: string }>(
			`insert into movies (tmdb_id, title) values (1, 'Film') returning id`
		)
	).rows[0].id;
	adultId = (
		await pg.query<{ id: string }>(
			`insert into movies (tmdb_id, title, adult) values (2, 'Adult', true) returning id`
		)
	).rows[0].id;
});

afterAll(async () => {
	await pg.close();
});

describe('applyInteraction', () => {
	it('creates then updates one row per user and movie, stamping the first watch date', async () => {
		const first = await applyInteraction(userId, movieId, {
			ok: true,
			type: 'watched',
			value: true
		});
		expect(first).toEqual({ watched: true, watchlist: false, favorite: false, rating: null });

		const second = await applyInteraction(userId, movieId, {
			ok: true,
			type: 'rating',
			value: 4.5
		});
		expect(second).toMatchObject({ watched: true, rating: 4.5 });

		const { rows } = await pg.query<{ n: number; watch_date: string | null }>(
			`select count(*)::int n, min(watch_date)::text watch_date from user_movie_interactions`
		);
		expect(rows[0].n).toBe(1);
		expect(rows[0].watch_date).not.toBeNull();
	});

	it('resolves a TMDB id and clears a rating with null', async () => {
		const result = await applyInteraction(userId, '1', { ok: true, type: 'rating', value: null });
		expect(result).toMatchObject({ rating: null, watched: true });
	});

	it('refuses quarantined and unknown movies without writing', async () => {
		expect(
			await applyInteraction(userId, adultId, { ok: true, type: 'favorite', value: true })
		).toBeNull();
		expect(
			await applyInteraction(userId, 'nope', { ok: true, type: 'favorite', value: true })
		).toBeNull();
		expect(await applyInteraction(userId, movieId, { ok: false, error: 'bad' })).toBeNull();
		const { rows } = await pg.query<{ n: number }>(
			`select count(*)::int n from user_movie_interactions`
		);
		expect(rows[0].n).toBe(1);
	});

	it('parses updates exactly like the catalogue action did', () => {
		expect(parseInteractionUpdate('watched', 'true')).toEqual({
			ok: true,
			type: 'watched',
			value: true
		});
		expect(parseInteractionUpdate('rating', '')).toEqual({ ok: true, type: 'rating', value: null });
		expect(parseInteractionUpdate('rating', '4.25').ok).toBe(false);
		expect(parseInteractionUpdate('watched', 'yes').ok).toBe(false);
		expect(parseInteractionUpdate('other', 'x').ok).toBe(false);
		expect(parseInteractionUpdate(undefined, undefined).ok).toBe(false);
	});
});
