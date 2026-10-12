import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

// Swap the application database for an in-memory PostgreSQL with the real
// migrations applied, so the whole read path runs against real SQL.
vi.mock('../db', async () => {
	const { createMigratedTestDatabase } = await import('../testing/pglite');
	const schema = await import('../db/schema');
	const context = await createMigratedTestDatabase();
	return { db: context.database, schema, testContext: context };
});

import * as dbModule from '../db';
import { getPickerRecommendation, recordPickerEvent } from './index';

const { pg } = (dbModule as unknown as { testContext: { pg: PGlite } }).testContext;

let userId: string;
let movieId: string;

async function countActivities(): Promise<number> {
	const result = await pg.query<{ count: string }>(
		'select count(*)::text as count from activities'
	);
	return Number(result.rows[0].count);
}

beforeAll(async () => {
	const user = await pg.query<{ id: string }>(
		`insert into users (email, username, password_hash)
		 values ('picker@example.test', 'picker', 'not-a-real-hash') returning id`
	);
	userId = user.rows[0].id;

	const movie = await pg.query<{ id: string }>(
		`insert into movies
			(tmdb_id, title, overview, poster_path, runtime, release_date, vote_average, vote_count)
		 values
			(101, 'Standard Film', 'A long enough overview to satisfy the picker rules.',
			 '/poster.jpg', 110, '2001-05-05', 7.8, 5000)
		 returning id`
	);
	movieId = movie.rows[0].id;
});

afterAll(async () => {
	await pg.close();
});

describe('picker recommendation read path', () => {
	it('returns a recommendation without writing anything for the user', async () => {
		const result = await getPickerRecommendation({ userId, sessionId: 'session-1' });
		await new Promise((resolveTick) => setTimeout(resolveTick, 50));

		expect(result?.movie.title).toBe('Standard Film');
		expect(result?.movie.imdbRating).toBeNull();
		expect(await countActivities()).toBe(0);
	});

	it('still records an explicit picker event for the user', async () => {
		await recordPickerEvent(userId, {
			sessionId: 'session-1',
			movieId,
			action: 'not_tonight',
			position: 1
		});

		const rows = await pg.query<{ action_type: string }>('select action_type from activities');
		expect(rows.rows.map((row) => row.action_type)).toEqual(['picker_not_tonight']);
	});
});
