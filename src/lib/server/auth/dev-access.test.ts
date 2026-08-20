import { describe, expect, it } from 'vitest';
import { isDevAuthBypassEnabled } from './dev-access';

describe('development auth bypass', () => {
	it('requires an explicit development-only flag', () => {
		expect(isDevAuthBypassEnabled({ NODE_ENV: 'development', ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(
			true
		);
		expect(isDevAuthBypassEnabled({ NODE_ENV: 'production', ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(
			false
		);
		expect(
			isDevAuthBypassEnabled({ NODE_ENV: 'development', ALLOW_DEV_AUTH_BYPASS: 'false' })
		).toBe(false);
	});
});
