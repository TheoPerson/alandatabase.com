import { fail } from '@sveltejs/kit';

export const actions = {
	createCustomMovie: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'You must be logged in to add a custom movie.' });
		}

		// Consume no attacker-controlled fields and perform no write while custom
		// title classification, artwork isolation, and owner authorization are incomplete.
		await request.body?.cancel();
		return fail(503, {
			error:
				'Custom title creation is temporarily unavailable while its private safety boundary is completed.'
		});
	}
};
