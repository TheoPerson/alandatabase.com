import { error, isHttpError } from '@sveltejs/kit';
import { getPersonById } from '$lib/server/services/movie.service';
import { logServerError } from '$lib/server/security/logging';
import type { PageServerLoad } from './$types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const load: PageServerLoad = async ({ params }) => {
	if (!UUID_PATTERN.test(params.id)) throw error(404, 'Person not found');

	try {
		const person = await getPersonById(params.id);
		if (!person) throw error(404, 'Person not found');
		return { person };
	} catch (err) {
		if (isHttpError(err)) throw err;
		logServerError('Person details load failed', err);
		throw error(500, 'Failed to load person details');
	}
};
