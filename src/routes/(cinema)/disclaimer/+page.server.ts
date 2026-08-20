import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const settings = locals.user.settings || {};
	if (settings.hasAcceptedAdultGate) {
		throw redirect(302, '/movies');
	}

	return {};
}

export const actions = {
	accept: async ({ locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}

		const currentSettings = locals.user.settings || {};
		const newSettings = {
			...currentSettings,
			hasAcceptedAdultGate: true
		};

		await db.update(users).set({ settings: newSettings }).where(eq(users.id, locals.user.id));

		throw redirect(302, '/movies');
	}
};
