import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hash';
import * as auth from './index';

describe('password hashing shared by the app and the operator script', () => {
	it('verifies the password it hashed and refuses another one', async () => {
		const stored = await hashPassword('correct horse battery');
		expect(stored).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/u);
		expect(await verifyPassword('correct horse battery', stored)).toBe(true);
		expect(await verifyPassword('correct horse batterz', stored)).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('same password here')).not.toBe(
			await hashPassword('same password here')
		);
	});

	it('is the very function the app signs in with', () => {
		expect(auth.hashPassword).toBe(hashPassword);
		expect(auth.verifyPassword).toBe(verifyPassword);
	});

	it('rejects a malformed stored hash', async () => {
		expect(await verifyPassword('anything long', 'not-a-hash')).toBe(false);
	});
});
