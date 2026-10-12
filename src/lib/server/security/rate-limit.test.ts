import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { createMigratedTestDatabase } from '../testing/pglite';
import { buildRateLimitUpsert } from './rate-limit';
import type { RateLimitPolicy } from './rate-limit-policy';

const policy: RateLimitPolicy = { endpoint: 'test:endpoint', limit: 2, windowMs: 60_000 };
const start = new Date('2026-01-01T00:00:00.000Z');

describe('rate limit statement', () => {
	// postgres-js, the driver the application runs on, has no serializer for JavaScript
	// Date objects inside a raw sql template (Drizzle replaces its timestamp serializers
	// with pass-through ones). A Date parameter therefore throws ERR_INVALID_ARG_TYPE
	// before the query reaches the database, which made every sign-in and registration fail.
	it('never sends a JavaScript Date as a statement parameter', () => {
		const statement = buildRateLimitUpsert(drizzle.mock({ schema }), 'hash', policy, start);
		const { params } = statement.toSQL();

		expect(params.length).toBeGreaterThan(0);
		expect(params.filter((param) => param instanceof Date)).toEqual([]);
	});
});

describe('rate limit behaviour on PostgreSQL', () => {
	let context: Awaited<ReturnType<typeof createMigratedTestDatabase>>;

	beforeAll(async () => {
		context = await createMigratedTestDatabase();
	});

	afterAll(async () => {
		await context?.pg.close();
	});

	async function hit(subjectHash: string, now: Date): Promise<number> {
		const [record] = await buildRateLimitUpsert(context.database, subjectHash, policy, now);
		return record.hits;
	}

	it('counts hits inside a window and restarts the count once the window has expired', async () => {
		expect(await hit('subject-a', start)).toBe(1);
		expect(await hit('subject-a', new Date(start.getTime() + 1_000))).toBe(2);
		expect(await hit('subject-a', new Date(start.getTime() + 2_000))).toBe(3);

		// 61 seconds after the first hit the 60-second window is over.
		expect(await hit('subject-a', new Date(start.getTime() + 61_000))).toBe(1);
	});

	it('keeps separate counters per subject', async () => {
		expect(await hit('subject-b', start)).toBe(1);
		expect(await hit('subject-c', start)).toBe(1);
		expect(await hit('subject-b', new Date(start.getTime() + 500))).toBe(2);
	});
});
