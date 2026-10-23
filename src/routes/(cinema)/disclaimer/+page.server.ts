import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { validateReturnTo } from '$lib/server/auth/cinema-access';

// The notice interrupts whatever page the person asked for; accepting it goes back there.
// validateReturnTo keeps the destination on this site and on a cinema page.
export async function load({ locals, url }) {
	const returnTo = validateReturnTo(url.searchParams.get('returnTo'));
	if (!locals.user) {
		// Sign in, then come back to this notice with the same destination.
		const resume = `/disclaimer?returnTo=${encodeURIComponent(returnTo)}`;
		throw redirect(302, `/auth/login?returnTo=${encodeURIComponent(resume)}`);
	}

	const settings = locals.user.settings || {};
	if (settings.hasAcceptedAdultGate) {
		throw redirect(302, returnTo);
	}

	return { returnTo };
}

export const actions = {
	accept: async ({ locals, request }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}

		const data = await request.formData();
		const returnTo = validateReturnTo(data.get('returnTo')?.toString() ?? null);
		const currentSettings = locals.user.settings || {};
		const newSettings = {
			...currentSettings,
			hasAcceptedAdultGate: true
		};

		await db.update(users).set({ settings: newSettings }).where(eq(users.id, locals.user.id));

		throw redirect(302, returnTo);
	}
};
