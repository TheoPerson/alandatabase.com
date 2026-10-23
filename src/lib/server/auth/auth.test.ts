import { describe, it, expect } from 'vitest';
import {
	sessionCookieDeleteOptions,
	sessionCookieOptions,
	generateSessionToken,
	hashSessionToken,
	hashPassword,
	verifyPassword
} from './index';

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

	it('stores only a deterministic digest of a session token', () => {
		const token = 'a'.repeat(64);
		const digest = hashSessionToken(token);

		expect(digest).toHaveLength(64);
		expect(digest).not.toBe(token);
		expect(hashSessionToken(token)).toBe(digest);
	});

	it('rejects malformed password hashes without throwing', async () => {
		await expect(verifyPassword('password', 'salt:not-hex')).resolves.toBe(false);
	});

	describe('session cookie options', () => {
		// Derived from the request URL, not from a hosting platform’s environment variables:
		// Netlify does not expose NETLIFY/CONTEXT/NODE_ENV to functions at runtime.
		it.each([
			'https://alandatabase.com/',
			'https://www.alandatabase.com/',
			'https://auth.alandatabase.com/auth/login',
			'https://api.alandatabase.com/health',
			'https://status.alandatabase.com/'
		])('shares one hardened cookie across the production hosts (%s)', (address) => {
			expect(sessionCookieOptions(new URL(address))).toMatchObject({
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: true,
				domain: '.alandatabase.com'
			});
		});

		it.each([
			'https://the-alans-data-base.netlify.app/',
			'https://deploy-preview-4--the-alans-data-base.netlify.app/',
			'https://alans-database.vercel.app/',
			'https://evilalandatabase.com/',
			'https://alandatabase.com.evil.test/'
		])('keeps platform, preview and lookalike hosts host-only but secure (%s)', (address) => {
			const options = sessionCookieOptions(new URL(address));

			expect(options.domain).toBeUndefined();
			expect(options.secure).toBe(true);
		});

		it('stays Secure on a production host even when a proxy reports plain http', () => {
			expect(sessionCookieOptions(new URL('http://alandatabase.com/')).secure).toBe(true);
		});

		it('only relaxes Secure for plain-http local development', () => {
			expect(sessionCookieOptions(new URL('http://localhost:5173/')).secure).toBe(false);
			expect(sessionCookieOptions(new URL('http://localhost:5173/')).domain).toBeUndefined();
		});

		it.each([
			'https://alandatabase.com/',
			'https://the-alans-data-base.netlify.app/',
			'http://localhost:5173/'
		])('deletes with the same path, domain and attributes it was set with (%s)', (address) => {
			const url = new URL(address);
			const set = sessionCookieOptions(url);

			expect(sessionCookieDeleteOptions(url)).toEqual({
				path: set.path,
				domain: set.domain,
				httpOnly: set.httpOnly,
				sameSite: set.sameSite,
				secure: set.secure
			});
		});
	});
});
