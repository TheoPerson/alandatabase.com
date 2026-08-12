import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateSessionToken } from './index';

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
});
