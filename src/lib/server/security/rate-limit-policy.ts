import { createHmac } from 'node:crypto';

export type RateLimitPolicy = {
	endpoint: string;
	limit: number;
	windowMs: number;
};

export const LOGIN_IP_POLICY: RateLimitPolicy = {
	endpoint: 'auth:login:ip',
	limit: 10,
	windowMs: 15 * 60 * 1000
};

export const LOGIN_ACCOUNT_POLICY: RateLimitPolicy = {
	endpoint: 'auth:login:account',
	limit: 6,
	windowMs: 15 * 60 * 1000
};

export const REGISTER_IP_POLICY: RateLimitPolicy = {
	endpoint: 'auth:register:ip',
	limit: 3,
	windowMs: 60 * 60 * 1000
};

export const ADMIN_ACCESS_MUTATION_POLICY: RateLimitPolicy = {
	endpoint: 'auth:admin:mutation',
	limit: 60,
	windowMs: 60 * 60 * 1000
};

export function hashRateLimitSubject(subject: string, secret: string): string {
	if (!secret.trim()) throw new Error('RATE_LIMIT_HASH_KEY is not configured.');
	return createHmac('sha256', secret).update(subject.trim().toLowerCase(), 'utf8').digest('hex');
}

export function getRetryAfterSeconds(expiresAt: Date, now = new Date()): number {
	return Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}
