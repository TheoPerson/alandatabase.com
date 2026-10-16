import { describe, expect, it } from 'vitest';
import { signInReason } from './sign-in-reason';

describe('signInReason', () => {
	it('explains why a private page asked for a sign-in', () => {
		expect(signInReason('/cinema/picker')).toBe('Sign in to use the Picker.');
		expect(signInReason('/my/films?tab=stats')).toBe('Sign in to open your Library.');
		expect(signInReason('/my/lists/abc')).toBe('Sign in to see your lists.');
		expect(signInReason('/my/settings')).toBe('Sign in to change your settings.');
	});

	it('stays quiet for anything else, including other sites', () => {
		expect(signInReason(null)).toBeNull();
		expect(signInReason('/movies')).toBeNull();
		expect(signInReason('https://evil.example/my/films')).toBeNull();
		expect(signInReason('//evil.example/cinema/picker')).toBeNull();
	});
});
