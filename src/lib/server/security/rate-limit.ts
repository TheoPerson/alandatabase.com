import { db } from '$lib/server/db';
import { rateLimits } from '$lib/server/db/schema';
import { lte, sql } from 'drizzle-orm';
import {
	getRetryAfterSeconds,
	hashRateLimitSubject,
	type RateLimitPolicy
} from './rate-limit-policy';

export type RateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

export async function consumeRateLimit(
	subject: string,
	policy: RateLimitPolicy,
	now = new Date()
): Promise<RateLimitResult> {
	const subjectHash = hashRateLimitSubject(subject, process.env.RATE_LIMIT_HASH_KEY ?? '');
	const nextExpiry = new Date(now.getTime() + policy.windowMs);

	const [record] = await db
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
				hits: sql<number>`case when ${rateLimits.expiresAt} <= ${now} then 1 else ${rateLimits.hits} + 1 end`,
				expiresAt: sql<Date>`case when ${rateLimits.expiresAt} <= ${now} then ${nextExpiry} else ${rateLimits.expiresAt} end`
			}
		})
		.returning({ hits: rateLimits.hits, expiresAt: rateLimits.expiresAt });

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
