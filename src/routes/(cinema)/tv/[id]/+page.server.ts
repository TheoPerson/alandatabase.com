import { getTVShowDetails } from '$lib/server/services/tv.service';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const tmdbId = parseInt(params.id, 10);
	if (isNaN(tmdbId)) {
		throw error(404, { message: 'Invalid TV show ID' });
	}

	try {
		const show = await getTVShowDetails(tmdbId);
		if (!show || !show.name) {
			throw error(404, { message: 'TV Show not found' });
		}

		return {
			show
		};
	} catch {
		throw error(404, { message: 'TV Show not found in archive' });
	}
}
