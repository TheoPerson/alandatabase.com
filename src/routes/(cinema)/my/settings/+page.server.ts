import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { redirect, fail } from '@sveltejs/kit';
import { logServerError } from '$lib/server/security/logging';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	return {
		user: locals.user
	};
}

export const actions = {
	updateSettings: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const data = await request.formData();
		const adultEnabled = data.get('adultEnabled') === 'on';

		try {
			await db
				.update(users)
				.set({
					settings: {
						...locals.user.settings,
						adultEnabled
					},
					updatedAt: new Date()
				})
				.where(eq(users.id, locals.user.id));

			return { success: true };
		} catch (err) {
			logServerError('Settings update failed', err);
			return fail(500, { error: 'Failed to save settings' });
		}
	}
};
