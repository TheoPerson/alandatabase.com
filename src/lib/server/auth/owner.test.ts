import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOwnerUser, requireOwnerUser } from './owner';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('owner authorization', () => {
	it('fails closed without configured owner identifiers', () => {
		expect(isOwnerUser({ id: 'owner', email: 'alan@example.com' })).toBe(false);
	});

	it('allows configured owner ids', () => {
		vi.stubEnv('OWNER_USER_IDS', 'owner, other-owner');

		expect(isOwnerUser({ id: 'owner' })).toBe(true);
		expect(isOwnerUser({ id: 'viewer' })).toBe(false);
	});

	it('allows configured owner emails case-insensitively', () => {
		vi.stubEnv('OWNER_EMAILS', 'Alan@Example.com');

		expect(isOwnerUser({ email: 'alan@example.com' })).toBe(true);
		expect(isOwnerUser({ email: 'viewer@example.com' })).toBe(false);
	});

	it('throws 403 for missing owner access', () => {
		expect(() => requireOwnerUser({ id: 'viewer' })).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});
