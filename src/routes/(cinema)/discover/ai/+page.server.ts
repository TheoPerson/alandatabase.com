import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// /api/ai/chat builds its context from the user's ratings, so the curator needs an account
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	return {
		displayName: locals.user.displayName || locals.user.username
	};
};
