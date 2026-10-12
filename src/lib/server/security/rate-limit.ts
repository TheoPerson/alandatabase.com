import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { rateLimits } from '$lib/server/db/schema';
import { lte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	getRetryAfterSeconds,
	hashRateLimitSubject,
	type RateLimitPolicy
} from './rate-limit-policy';

export type RateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

type RateLimitDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

// Split out so tests can inspect the exact statement and parameters that would be sent.
export function buildRateLimitUpsert(
	database: RateLimitDatabase,
	subjectHash: string,
	policy: RateLimitPolicy,
	now: Date
) {
	const nextExpiry = new Date(now.getTime() + policy.windowMs);
	// Inside a raw sql template a Date is sent as-is, and postgres-js cannot serialize it.
	// sql.param runs the value through the column's own encoder (an ISO string), like
	// every other timestamp Drizzle writes.
	const nowParam = sql.param(now, rateLimits.expiresAt);
	const nextExpiryParam = sql.param(nextExpiry, rateLimits.expiresAt);

	return database
		.insert(rateLimits)
		.values({
			subjectHash,
			endpoint: policy.endpoint,
			hits: 1,
			expiresAt: nextExpiry
		})
		.onConflictDoUpdate({
			target: [rateLimits.subjectHash, rateLimits.endpoint],
			set: {
				hits: sql<number>`case when ${rateLimits.expiresAt} <= ${nowParam} then 1 else ${rateLimits.hits} + 1 end`,
				expiresAt: sql<Date>`case when ${rateLimits.expiresAt} <= ${nowParam} then ${nextExpiryParam} else ${rateLimits.expiresAt} end`
			}
		})
		.returning({ hits: rateLimits.hits, expiresAt: rateLimits.expiresAt });
}

export async function consumeRateLimit(
	subject: string,
	policy: RateLimitPolicy,
	now = new Date()
): Promise<RateLimitResult> {
	const subjectHash = hashRateLimitSubject(subject, process.env.RATE_LIMIT_HASH_KEY ?? '');
	const [record] = await buildRateLimitUpsert(db, subjectHash, policy, now);

	if (!record) {
		throw new Error('Rate limit state was not persisted.');
	}
	if (record.hits === 1) {
		await db.delete(rateLimits).where(lte(rateLimits.expiresAt, now));
	}

	return {
		allowed: record.hits <= policy.limit,
		retryAfterSeconds: getRetryAfterSeconds(record.expiresAt, now)
	};
}
