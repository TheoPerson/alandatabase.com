// Shared, pure helpers for the sign-in and registration forms.

/** Id of the server error summary; fields reference it through aria-describedby. */
export const AUTH_ERROR_ID = 'auth-error';

/**
 * Appends `returnTo` (and optional extra parameters) to an action (`?/login`) or a page
 * path (`/auth/register`). Values are encoded, so the server reads back the exact string.
 */
export function withReturnTo(
	base: string,
	returnTo: string | null | undefined,
	extra: Record<string, string | null | undefined> = {}
): string {
	const pairs = Object.entries({ returnTo, ...extra })
		.filter((pair): pair is [string, string] => typeof pair[1] === 'string' && pair[1] !== '')
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
	if (pairs.length === 0) return base;
	return `${base}${base.includes('?') ? '&' : '?'}${pairs.join('&')}`;
}

export type ValidityLike = Pick<
	ValidityState,
	'valid' | 'valueMissing' | 'typeMismatch' | 'tooShort' | 'tooLong' | 'patternMismatch'
>;

export type FieldRules = {
	label: string;
	minLength?: number;
	maxLength?: number;
	/** Replaces the default "Enter your <label>." message. */
	missing?: string;
	/** Shown when the value does not match the field pattern or type. */
	patternHint?: string;
};

/**
 * English message for a native constraint failure. The browser's own message follows the
 * device language, while the UI copy is English.
 */
export function validityMessage(validity: ValidityLike, rules: FieldRules): string | null {
	if (validity.valid) return null;
	const label = rules.label.toLowerCase();
	if (validity.valueMissing) return rules.missing ?? `Enter your ${label}.`;
	if (validity.tooShort && rules.minLength) return `Use at least ${rules.minLength} characters.`;
	if (validity.tooLong && rules.maxLength) return `Use at most ${rules.maxLength} characters.`;
	if (validity.patternMismatch || validity.typeMismatch) {
		return rules.patternHint ?? `Enter a valid ${label}.`;
	}
	return `Check your ${label}.`;
}
