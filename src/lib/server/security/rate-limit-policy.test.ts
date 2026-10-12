import { describe, expect, it } from 'vitest';
import {
	ADMIN_ACCESS_MUTATION_POLICY,
	getRetryAfterSeconds,
	hashRateLimitSubject
} from './rate-limit-policy';

describe('rate limit policy', () => {
	it('creates a stable keyed digest without retaining the source value', () => {
		const digest = hashRateLimitSubject(' Admin@Example.com ', 'test-only-key');

		expect(digest).toHaveLength(64);
		expect(digest).not.toContain('admin@example.com');
		expect(hashRateLimitSubject('admin@example.com', 'test-only-key')).toBe(digest);
	});

	it('requires an explicit digest key', () => {
		expect(() => hashRateLimitSubject('127.0.0.1', '')).toThrow('RATE_LIMIT_HASH_KEY');
	});

	it('returns a positive retry window rounded up to seconds', () => {
		const now = new Date('2026-08-21T10:00:00.000Z');
		expect(getRetryAfterSeconds(new Date('2026-08-21T10:00:01.001Z'), now)).toBe(2);
		expect(getRetryAfterSeconds(new Date('2026-08-21T09:59:00.000Z'), now)).toBe(1);
	});

	it('bounds privileged access mutations independently', () => {
		expect(ADMIN_ACCESS_MUTATION_POLICY.endpoint).toBe('auth:admin:mutation');
		expect(ADMIN_ACCESS_MUTATION_POLICY.limit).toBeLessThanOrEqual(60);
		expect(ADMIN_ACCESS_MUTATION_POLICY.windowMs).toBe(60 * 60 * 1000);
	});
});
