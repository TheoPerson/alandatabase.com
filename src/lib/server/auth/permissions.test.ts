import { describe, expect, it } from 'vitest';
import { canAssignRole, hasPermission, parseUserRole } from './permissions';

describe('persistent role permissions', () => {
	it('fails closed for missing and unknown roles', () => {
		expect(parseUserRole('superadmin')).toBeNull();
		expect(hasPermission({ role: 'superadmin' }, 'account:access')).toBe(false);
		expect(hasPermission(null, 'system:manage')).toBe(false);
	});

	it('keeps owner-only and catalog permissions distinct', () => {
		expect(hasPermission({ role: 'owner' }, 'system:manage')).toBe(true);
		expect(hasPermission({ role: 'owner' }, 'catalog:manage')).toBe(true);
		expect(hasPermission({ role: 'admin' }, 'catalog:manage')).toBe(true);
		expect(hasPermission({ role: 'admin' }, 'roles:manage')).toBe(false);
		expect(hasPermission({ role: 'admin' }, 'account:access')).toBe(false);
		expect(hasPermission({ role: 'member' }, 'account:access')).toBe(false);
		expect(hasPermission({ role: 'member' }, 'catalog:manage')).toBe(false);
	});

	it('does not allow invitations to create another owner', () => {
		expect(canAssignRole('admin')).toBe(true);
		expect(canAssignRole('member')).toBe(true);
		expect(canAssignRole('owner')).toBe(false);
	});
});
