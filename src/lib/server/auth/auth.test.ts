import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashPassword, verifyPassword, generateSessionToken, isAdmin } from './index';

describe('Authentication Utilities', () => {
	it('should hash and verify a password correctly', async () => {
		const password = 'my_super_secret_password';
		const hash = await hashPassword(password);

		expect(hash).not.toEqual(password);
		expect(hash).toContain(':'); // Scrypt format string

		const isValid = await verifyPassword(password, hash);
		expect(isValid).toBe(true);
	});

	it('should fail verification for incorrect password', async () => {
		const password = 'correct_password';
		const hash = await hashPassword(password);

		const isValid = await verifyPassword('wrong_password', hash);
		expect(isValid).toBe(false);
	});

	it('should generate a 64 character session token', () => {
		const token = generateSessionToken();
		expect(token.length).toBe(64);
		expect(typeof token).toBe('string');
	});

	it('should reject a malformed stored hash instead of throwing', async () => {
		expect(await verifyPassword('anything', 'salt:abcd')).toBe(false);
		expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
	});
});

describe('isAdmin', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('should only grant admin to emails listed in ADMIN_EMAILS (case-insensitive)', () => {
		vi.stubEnv('ADMIN_EMAILS', 'owner@example.com, Second@Example.com');
		expect(isAdmin({ email: 'owner@example.com' })).toBe(true);
		expect(isAdmin({ email: 'second@example.com' })).toBe(true);
		expect(isAdmin({ email: 'someone@example.com' })).toBe(false);
	});

	it('should deny everyone when ADMIN_EMAILS is not configured', () => {
		vi.stubEnv('ADMIN_EMAILS', '');
		expect(isAdmin({ email: 'owner@example.com' })).toBe(false);
		expect(isAdmin(null)).toBe(false);
	});
});
