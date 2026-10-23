// One line on the sign-in card saying why a private page sent the visitor here.
const REASONS: Array<[prefix: string, text: string]> = [
	['/cinema/picker', 'Sign in to use the Picker.'],
	['/my/films', 'Sign in to open your Library.'],
	['/my/lists', 'Sign in to see your lists.'],
	['/my/settings', 'Sign in to change your settings.']
];

export function signInReason(returnTo: string | null): string | null {
	if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
	const path = returnTo.split(/[?#]/u)[0];
	const match = REASONS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
	return match ? match[1] : null;
}
