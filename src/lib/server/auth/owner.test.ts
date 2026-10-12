import { describe, expect, it } from 'vitest';
import { isOwnerUser, requireCatalogManager, requireOwnerUser } from './owner';

describe('owner authorization', () => {
	it('fails closed without a persistent role', () => {
		expect(isOwnerUser({})).toBe(false);
		expect(isOwnerUser({ role: 'unknown' })).toBe(false);
	});

	it('allows only the stored owner role to manage the system', () => {
		expect(isOwnerUser({ role: 'owner' })).toBe(true);
		expect(isOwnerUser({ role: 'admin' })).toBe(false);
		expect(isOwnerUser({ role: 'member' })).toBe(false);
	});

	it('allows admins to manage the catalog without owner permissions', () => {
		expect(() => requireCatalogManager({ role: 'admin' })).not.toThrow();
		expect(() => requireOwnerUser({ role: 'admin' })).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});

	it('throws 403 for missing owner access', () => {
		expect(() => requireOwnerUser({ role: 'member' })).toThrow(
			expect.objectContaining({ status: 403 })
		);
	});
});
