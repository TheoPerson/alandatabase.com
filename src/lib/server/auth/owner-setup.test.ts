import { describe, expect, it } from 'vitest';
import { verifyOwnerSetupKey } from './owner-setup';

describe('owner setup key', () => {
	it('fails closed when the key is missing or too short', () => {
		expect(verifyOwnerSetupKey('short', null)).toBe(false);
		expect(verifyOwnerSetupKey('short', 'short')).toBe(false);
	});

	it('uses an exact constant-time digest comparison', () => {
		const key = 'a-secure-owner-bootstrap-key-1234567890';
		expect(verifyOwnerSetupKey(key, key)).toBe(true);
		expect(verifyOwnerSetupKey(`${key}-wrong`, key)).toBe(false);
	});
});
